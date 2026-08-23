import type { Tokens } from "@/lib/robo/jogo/auth";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";
import {
  comprarBola,
  comprarItem,
  lerCadeados,
  lerLoja,
  ehConsumivel,
  lerMochila,
  venderItens,
  venderPokes,
  type ItemMochila,
  type Loja,
} from "@/lib/robo/jogo/loja";
import type { BolaEstoque } from "@/lib/robo/motor/tipos";
import type { ConfigAuto } from "@/lib/robo/motor/tipos";
import { fetchSource } from "@/lib/source";

/**
 * As DECISOES das automacoes.
 *
 * A camada `jogo/loja.ts` sabe comprar; esta sabe QUANDO comprar. A separacao
 * nao e arrumacao: as duas mudam por motivos diferentes e em ritmos diferentes —
 * a de baixo muda quando o jogo muda um endpoint, esta muda quando o Eduardo
 * muda de ideia sobre quanto e "bola de menos".
 *
 * Tres regras valem em tudo aqui:
 *
 * 1. **Nada roda desligado.** Cada job testa a propria chave antes de tocar na
 *    conta. Automacao que gasta ouro ou destroi pokemon nao ganha o beneficio da
 *    duvida.
 * 2. **Nada roda as cegas.** Toda decisao le o estado FRESCO (loja, mochila,
 *    cadeado) na hora. Decidir com o estoque de um minuto atras e como se compra
 *    duas vezes a mesma reposicao.
 * 3. **Toda recusa vira frase.** O jogo explica por que recusou; jogar isso fora
 *    e o que transforma um problema de 5 segundos ("sem ouro") num "não deu
 *    certo" que ninguem consegue resolver.
 *
 * Tudo aqui e REST — nao disputa a sessao de jogo. E por isso que a reposicao de
 * bola pode acontecer com a cacada correndo, sem derrubar o WebSocket.
 */

export interface Recado {
  ok: boolean;
  tipo: "compra" | "venda-item" | "venda-poke";
  /** a linha que aparece no feed, ja pronta */
  texto: string;
  detalhe?: string | null;
  /** ouro movimentado, sempre positivo (o sinal quem poe e quem exibe) */
  ouro: number;
  quantidade?: number;
  bolas?: number;
  pocoes?: number;
  revives?: number;
}

const ouroTxt = (n: number) => n.toLocaleString("pt-BR");

/** As duas categorias que a reposicao conhece. */
export type Consumivel = "heal" | "revive";

/**
 * A bolsa separada por categoria do CATALOGO do jogo.
 *
 * A categoria sai do catalogo e nao do campo `category` do depot porque o depot
 * cai pra "loot" quando o campo falta — e uma pocao contada como loot vira
 * estoque zero, que e exatamente a leitura que dispara compra.
 *
 * `null` quando o catalogo nao respondeu, e a distincao e o ponto: "nao tem
 * pocao" e "nao sei quantas pocoes tem" nao podem virar a mesma compra.
 */
export async function separarConsumivel(
  itens: ItemMochila[],
): Promise<Record<Consumivel, ItemMochila[]> | null> {
  const d = await fetchSource().catch(() => null);
  if (!d) return null;
  const categoria = new Map(d.items.map((i) => [i.id, i.category]));
  const out: Record<Consumivel, ItemMochila[]> = { heal: [], revive: [] };
  for (const i of itens) {
    if (i.quantidade <= 0) continue;
    const c = categoria.get(i.id);
    if (c === "heal" || c === "revive") out[c].push(i);
  }
  return out;
}

export const somar = (itens: ItemMochila[]): number =>
  itens.reduce((s, i) => s + i.quantidade, 0);

/** A opcao mais barata da loja dentro de uma categoria. */
function maisBarato(loja: Loja, categoria: string): { id: number; nome: string; preco: number } | null {
  const cand = loja.itens
    .filter((i) => i.categoria === categoria && i.preco > 0)
    .sort((a, b) => a.preco - b.preco)[0];
  return cand ? { id: cand.id, nome: cand.nome, preco: cand.preco } : null;
}

/**
 * Repoe consumivel.
 *
 * O piso e o alvo existem juntos por um motivo: comprar "quando acabar" deixa a
 * fila de captura do jogo travada em zero no intervalo entre a ultima bola e a
 * proxima compra, e uma hunt boa queima centenas por hora. Comprar do piso ate o
 * alvo transforma isso numa compra a cada tantas horas.
 *
 * O ouro disponivel para a rodada e o MENOR entre o que a conta tem e o teto que
 * o usuario definiu. O teto e o que impede a automacao de zerar a conta pra
 * comprar bola.
 */
export async function rodarCompras(
  tokens: Tokens,
  cfg: ConfigAuto,
  bolas: BolaEstoque[],
  aoTrocarTokens: (t: Tokens) => Promise<void>,
): Promise<Recado[]> {
  const r = await lerLoja(tokens);
  if (!r) return [];
  let t = r.tokens;
  if (r.mudou) await aoTrocarTokens(t);

  const loja = r.loja;
  let disponivel = Math.min(loja.ouro, cfg.tetoOuro);
  const recados: Recado[] = [];

  // --- bolas ---
  if (cfg.comprarBola) {
    const estoque = bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
    if (estoque <= cfg.pisoBola) {
      const alvo =
        (cfg.bolaId ? loja.bolas.find((b) => b.id === cfg.bolaId) : null) ??
        loja.bolas.filter((b) => b.preco > 0).sort((a, b) => a.preco - b.preco)[0];
      if (!alvo) {
        recados.push({ ok: false, tipo: "compra", texto: "sem bola à venda na loja", ouro: 0 });
      } else {
        const falta = cfg.alvoBola - estoque;
        const cabe = alvo.preco > 0 ? Math.floor(disponivel / alvo.preco) : 0;
        const qtd = Math.max(0, Math.min(falta, cabe));
        if (qtd <= 0) {
          recados.push({
            ok: false, tipo: "compra",
            texto: `sem dólares para repor ${alvo.nome}`,
            detalhe: `precisa de ${ouroTxt(alvo.preco * falta)}, disponível ${ouroTxt(disponivel)}`,
            ouro: 0,
          });
        } else {
          const c = await comprarBola(t, alvo.id, qtd);
          t = c.tokens;
          if (c.mudou) await aoTrocarTokens(t);
          const custo = alvo.preco * qtd;
          if (c.ok) disponivel -= custo;
          recados.push({
            ok: c.ok,
            tipo: "compra",
            texto: c.ok ? `${qtd}x ${alvo.nome}` : `não comprou ${alvo.nome}`,
            detalhe: c.motivo,
            ouro: c.ok ? custo : 0,
            bolas: c.ok ? qtd : 0,
          });
        }
      }
    }
  }

  // --- pocoes e revives ---
  // Sao mais caros que bola e gastam bem mais devagar (a pocao so entra no HP
  // baixo, o revive so quando desmaia), entao os pisos sao menores de proposito:
  // um alvo alto aqui drena o ouro sem ganho nenhum de cacada.
  //
  // O estoque e lido AQUI, por REST, e nao herdado do frame `inventory` do
  // socket. O frame e mais fresco, mas ele nasce vazio a cada conexao e e
  // limpo quando ela cai — e bolsa vazia le como "zero pocoes", que e piso
  // furado, que e compra. Uma conta com 400 pocoes comprava 100 a cada minuto
  // enquanto o socket nao mandasse o primeiro `inventory`.
  if (cfg.comprarPocao || cfg.comprarRevive) {
    const bolsa = await lerMochila(t);
    const separado = bolsa ? await separarConsumivel(bolsa.itens) : null;
    if (bolsa) {
      t = bolsa.tokens;
      if (bolsa.mudou) await aoTrocarTokens(t);
    }
    // Nao saber quanto tem e razao pra NAO comprar. Comprar assim mesmo e o
    // mesmo erro de antes com outro nome.
    if (!separado) {
      recados.push({
        ok: false,
        tipo: "compra",
        texto: "não consegui conferir a bolsa",
        detalhe: "a reposição de poção e revive fica de fora desta rodada",
        ouro: 0,
      });
      return recados;
    }

    for (const alvoCfg of [
      { liga: cfg.comprarPocao, cat: "heal" as const, piso: cfg.pisoPocao, alvo: cfg.alvoPocao, id: cfg.pocaoId, rotulo: "poção" },
      { liga: cfg.comprarRevive, cat: "revive" as const, piso: cfg.pisoRevive, alvo: cfg.alvoRevive, id: cfg.reviveId, rotulo: "revive" },
    ]) {
      if (!alvoCfg.liga) continue;
      const total = somar(separado[alvoCfg.cat]);
      if (total > alvoCfg.piso) continue;

      const item =
        (alvoCfg.id ? loja.itens.find((i) => i.id === alvoCfg.id) : null) ?? maisBarato(loja, alvoCfg.cat);
      if (!item) {
        recados.push({ ok: false, tipo: "compra", texto: `sem ${alvoCfg.rotulo} à venda na loja`, ouro: 0 });
        continue;
      }
      const falta = alvoCfg.alvo - total;
      const cabe = item.preco > 0 ? Math.floor(disponivel / item.preco) : 0;
      const qtd = Math.max(0, Math.min(falta, cabe));
      if (qtd <= 0) {
        recados.push({
          ok: false, tipo: "compra",
          texto: `sem dólares para repor ${item.nome}`,
          detalhe: `precisa de ${ouroTxt(item.preco * falta)}, disponível ${ouroTxt(disponivel)}`,
          ouro: 0,
        });
        continue;
      }
      const c = await comprarItem(t, item.id, qtd);
      t = c.tokens;
      if (c.mudou) await aoTrocarTokens(t);
      const custo = item.preco * qtd;
      if (c.ok) disponivel -= custo;
      recados.push({
        ok: c.ok,
        tipo: "compra",
        texto: c.ok ? `${qtd}x ${item.nome}` : `não comprou ${item.nome}`,
        detalhe: c.motivo,
        ouro: c.ok ? custo : 0,
        pocoes: c.ok && alvoCfg.cat === "heal" ? qtd : 0,
        revives: c.ok && alvoCfg.cat === "revive" ? qtd : 0,
      });
    }
  }

  return recados;
}

/**
 * Vende os drops marcados.
 *
 * A lista e BRANCA — o usuario marca o que pode sair. Uma lista negra venderia
 * sozinha todo item novo que o jogo lancar, o que e exatamente o tipo de
 * surpresa que faz alguem desligar a automacao pra sempre.
 *
 * O cadeado do jogador e lido antes porque o jogo recusa o LOTE inteiro quando
 * um item travado entra nele: um item protegido derrubaria a venda dos outros
 * quinze, e o erro nao diria qual foi.
 */
export async function rodarVendaDrops(
  tokens: Tokens,
  cfg: ConfigAuto,
  aoTrocarTokens: (t: Tokens) => Promise<void>,
): Promise<Recado[]> {
  if (!cfg.venderDrop || !cfg.dropIds.length) return [];

  const mochila = await lerMochila(tokens);
  if (!mochila) return [];
  let t = mochila.tokens;
  if (mochila.mudou) await aoTrocarTokens(t);

  const cad = await lerCadeados(t);
  if (cad) {
    t = cad.tokens;
    if (cad.mudou) await aoTrocarTokens(t);
  }
  const travados = cad?.travados ?? new Set<number>();
  const permitidos = new Set(cfg.dropIds);

  const lote = mochila.itens.filter(
    (i) =>
      i.quantidade > 0 &&
      permitidos.has(i.id) &&
      !travados.has(i.id) &&
      // Cinto e suspensorio: a tela ja nao oferece consumivel pra marcar, e uma
      // lista salva ANTES desta regra pode carregar um id de pocao. O motor e o
      // ultimo lugar onde isso ainda da pra barrar.
      !ehConsumivel(i.categoria),
  );
  if (!lote.length) return [];

  const ouro = lote.reduce((s, i) => s + i.quantidade * i.precoNpc, 0);
  const total = lote.reduce((s, i) => s + i.quantidade, 0);

  const v = await venderItens(t, lote.map((i) => ({ itemId: i.id, qty: i.quantidade })));
  t = v.tokens;
  if (v.mudou) await aoTrocarTokens(t);

  return [
    {
      ok: v.ok,
      tipo: "venda-item",
      texto: v.ok
        ? `${total} ${total === 1 ? "item vendido" : "itens vendidos"}`
        : "a venda de drops não passou",
      detalhe: v.ok ? lote.map((i) => `${i.quantidade}x ${i.nome}`).join(", ") : v.motivo,
      ouro: v.ok ? ouro : 0,
      quantidade: v.ok ? total : 0,
    },
  ];
}

/**
 * O que PODE ser vendido.
 *
 * Escrito como uma lista de vetos e nao como uma pontuacao, de proposito: venda
 * de pokemon e irreversivel, e a pergunta certa nao e "quanto vale" e sim "ha
 * alguma razao pra ficar?". Qualquer duvida mantem o bicho.
 *
 * Os vetos do JOGO (time, lider, starter, cadeado) vem primeiro porque a venda
 * falharia de qualquer jeito, e um item recusado derruba o lote inteiro.
 */
export function vendaveis(box: ActivePoke[], cfg: ConfigAuto): ActivePoke[] {
  // Qualidade e IV sao grandezas DIFERENTES e ambas seguram o bicho: um Ledian de
  // IV medio e qualidade DIVINE vale mais que um de IV alto e qualidade comum. Ter
  // so o IV como veto mandava o segundo caso pro NPC.
  const manter = new Set(cfg.manterEspecies);
  return box.filter((p) => {
    if (p.team || p.leader || p.starter || p.locked) return false;
    if (cfg.manterShiny && p.shiny) return false;
    if (manter.has(p.speciesId)) return false;
    if (p.ivTotal >= cfg.ivMinimo) return false;
    if (p.quality >= cfg.qualidadeMinima) return false;
    if (p.level >= cfg.nivelMinimo) return false;
    return true;
  });
}

/** Lote maximo por chamada. Vender 300 de uma vez e um corpo grande e uma
 *  resposta lenta; em pedaco, uma recusa custa 60 bichos e nao a lista toda. */
const LOTE_POKES = 60;

export async function rodarVendaPokes(
  tokens: Tokens,
  cfg: ConfigAuto,
  box: ActivePoke[],
  aoTrocarTokens: (t: Tokens) => Promise<void>,
): Promise<Recado[]> {
  if (!cfg.venderPoke) return [];
  const alvo = vendaveis(box, cfg);
  if (!alvo.length) return [];

  let t = tokens;
  const recados: Recado[] = [];

  for (let i = 0; i < alvo.length; i += LOTE_POKES) {
    const lote = alvo.slice(i, i + LOTE_POKES);
    const v = await venderPokes(t, lote.map((p) => p.id));
    t = v.tokens;
    if (v.mudou) await aoTrocarTokens(t);

    // O ouro do jogo manda: `sellValue` e estimativa nossa, e a diferenca (bonus
    // de VIP, evento) apareceria como um placar que nao bate com a conta.
    const ouro = v.dado?.goldGained ?? lote.reduce((s, p) => s + p.sellValue, 0);
    const qtd = v.dado?.sold ?? lote.length;

    recados.push({
      ok: v.ok,
      tipo: "venda-poke",
      texto: v.ok
        ? `${qtd} ${qtd === 1 ? "pokémon vendido" : "pokémons vendidos"}`
        : "a venda de pokémon não passou",
      detalhe: v.ok ? lote.slice(0, 6).map((p) => `${p.name} nv ${p.level}`).join(", ") : v.motivo,
      ouro: v.ok ? ouro : 0,
      quantidade: v.ok ? qtd : 0,
    });

    // Uma recusa no primeiro lote quase sempre vale pros seguintes (cadeado,
    // regra do jogo). Insistir gastaria chamadas pra colecionar o mesmo erro.
    if (!v.ok) break;
  }

  return recados;
}
