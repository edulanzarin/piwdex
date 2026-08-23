import { enviarAoJogo, frasedoJogo, pedirAoJogo, type Tokens } from "@/lib/robo/jogo/auth";
import { gameAssetUrl } from "@/lib/robo/jogo/host";

/**
 * A loja do NPC e a mochila — comprar consumivel, vender drop, vender pokemon.
 *
 * Esta camada e de CAPACIDADE, e nao de decisao: ela sabe COMO comprar, nunca
 * QUANDO. Quem decide e o motor (`motor/jobs.ts`), com os pisos e as travas do
 * usuario. Misturar as duas coisas foi o que fez a venda automatica do v1 virar
 * um lugar onde ninguem mexia com confianca.
 *
 * Tudo aqui e REST, e essa e a diferenca que importa em relacao ao resto do
 * robo: REST NAO disputa a sessao de jogo. Comprar bola no meio da cacada nao
 * derruba o WebSocket — por isso a reposicao pode acontecer com o robo rodando.
 *
 * Endpoints conferidos contra o jogo (ago/2026): todos existem e respondem 401
 * sem credencial, nenhum 404.
 */

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const txt = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

export interface BolaLoja {
  id: number;
  nome: string;
  preco: number;
  icone: string;
  taxa: number;
}
export interface ItemLoja {
  id: number;
  nome: string;
  preco: number;
  icone: string;
  categoria: string;
}
export interface Loja {
  ouro: number;
  bolas: BolaLoja[];
  itens: ItemLoja[];
}

/** Catalogo + preco + o ouro que a conta tem AGORA. */
export async function lerLoja(tokens: Tokens): Promise<{ loja: Loja; tokens: Tokens; mudou: boolean } | null> {
  const r = await pedirAoJogo("/api/game/shop", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const bruto = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
  const bolas = (Array.isArray(bruto?.balls) ? bruto.balls : []) as Record<string, unknown>[];
  const itens = (Array.isArray(bruto?.items) ? bruto.items : []) as Record<string, unknown>[];
  return {
    loja: {
      ouro: num(bruto?.gold),
      bolas: bolas.map((b) => ({
        id: num(b.id),
        nome: txt(b.name),
        preco: num(b.priceGold),
        icone: gameAssetUrl(txt(b.iconUrl)),
        taxa: num(b.catchRate),
      })),
      itens: itens.map((i) => ({
        id: num(i.id),
        nome: txt(i.name),
        preco: num(i.priceGold),
        icone: gameAssetUrl(txt(i.icon)),
        categoria: txt(i.category),
      })),
    },
    tokens: r.tokens,
    mudou: r.mudou,
  };
}

export interface ItemMochila {
  id: number;
  nome: string;
  icone: string;
  quantidade: number;
  /** o que o NPC paga por unidade */
  precoNpc: number;
  categoria: string;
}

/** A mochila com preco de NPC — a base da venda de drop. */
export async function lerMochila(
  tokens: Tokens,
): Promise<{ itens: ItemMochila[]; tokens: Tokens; mudou: boolean } | null> {
  const r = await pedirAoJogo("/api/game/depot", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const bruto = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
  const bolsa = (Array.isArray(bruto?.inventory) ? bruto.inventory : []) as Record<string, unknown>[];
  return {
    itens: bolsa.map((i) => ({
      id: num(i.id),
      nome: txt(i.name),
      icone: i.icon ? gameAssetUrl(txt(i.icon)) : "",
      quantidade: num(i.quantity),
      precoNpc: num(i.npcPrice),
      categoria: txt(i.category, "loot"),
    })),
    tokens: r.tokens,
    mudou: r.mudou,
  };
}

/**
 * Os itens com CADEADO do jogador.
 *
 * O jogo recusa vender esses, e a recusa vem como erro da chamada inteira — um
 * item travado no lote derruba a venda dos outros. Ler o cadeado antes e o que
 * mantem a venda automatica funcionando pra quem usa o recurso.
 */
export async function lerCadeados(
  tokens: Tokens,
): Promise<{ travados: Set<number>; tokens: Tokens; mudou: boolean } | null> {
  const r = await pedirAoJogo("/api/game/item/lock", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const bruto = (await r.res.json().catch(() => null)) as { locked?: unknown } | null;
  const arr = Array.isArray(bruto?.locked) ? bruto.locked : [];
  return {
    travados: new Set(arr.filter((x): x is number => typeof x === "number")),
    tokens: r.tokens,
    mudou: r.mudou,
  };
}

/**
 * O que NUNCA entra na venda de drop.
 *
 * Pocao, revive e bola sao ferramenta de trabalho: o robo compra esses itens
 * numa aba e venderia na outra, e a conta ficaria sem cura no meio da cacada por
 * causa de um clique em "marcar tudo". Drop e o que a cacada PRODUZ; consumivel e
 * o que ela GASTA, e as duas coisas nao podem morar na mesma lista.
 */
const CONSUMIVEL = new Set(["heal", "revive", "ball", "balls", "potion"]);

export const ehConsumivel = (categoria: string): boolean => CONSUMIVEL.has(categoria.toLowerCase());

export interface Escrita<T = unknown> {
  ok: boolean;
  status: number;
  dado: T | null;
  /** a frase do jogo quando ele recusa — vai pra tela como esta */
  motivo: string | null;
  tokens: Tokens;
  mudou: boolean;
}

async function escrever<T = unknown>(path: string, tokens: Tokens, corpo: unknown): Promise<Escrita<T>> {
  const r = await enviarAoJogo(path, tokens, corpo);
  // O corpo e lido TAMBEM no erro: e nele que o jogo explica a recusa, e essa
  // frase e a unica coisa que transforma "não deu certo" em algo acionavel.
  const dado = (await r.res.json().catch(() => null)) as T | null;
  return {
    ok: r.res.ok,
    status: r.res.status,
    dado,
    motivo: r.res.ok ? null : frasedoJogo(dado),
    tokens: r.tokens,
    mudou: r.mudou,
  };
}

export const comprarBola = (t: Tokens, ballId: number, qty: number) =>
  escrever("/api/game/shop/buy", t, { ballId, qty });

export const comprarItem = (t: Tokens, itemId: number, qty: number) =>
  escrever("/api/game/shop/buy", t, { itemId, qty });

export const venderItens = (t: Tokens, itens: { itemId: number; qty: number }[]) =>
  escrever("/api/game/shop/sell", t, { items: itens });

export interface ResultadoVendaPokes {
  sold: number;
  goldGained: number;
  gold: number;
}

export const venderPokes = (t: Tokens, pokeIds: string[]) =>
  escrever<ResultadoVendaPokes>("/api/game/pokemon/sell", t, { pokeIds });
