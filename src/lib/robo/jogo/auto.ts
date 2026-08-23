import { enviarAoJogo, pedirAoJogo, type Tokens } from "@/lib/robo/jogo/auth";
import { gameAssetUrl } from "@/lib/robo/jogo/host";
import type { BolaEstoque, EstadoAuto } from "@/lib/robo/motor/tipos";

export type { BolaEstoque, EstadoAuto };

/**
 * O Auto-Helper — a automacao NATIVA do proprio jogo.
 *
 * Existe uma distincao que decide o desenho inteiro do robo e vale escrever:
 * captura, pocao e revive automaticos sao coisa do SERVIDOR do jogo, ligada por
 * uma config da conta. O robo nao precisa (nem consegue) capturar corpo a corpo
 * — o que ele faz e ligar o interruptor certo e manter a bolsa cheia.
 *
 * Consequencia pratica: o robo nao "captura melhor", ele CAPTURA MAIS, porque
 * garante que nunca falte bola. A fila de captura do jogo trava com zero bolas,
 * e uma hunt boa queima centenas por hora.
 *
 * `autoCatch` e recurso VIP DO JOGO. Sem VIP la, o interruptor nao pega — e a
 * tela precisa dizer isso, senao o usuario liga, nao acontece nada e a culpa
 * cai no robo.
 */

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Os campos gravaveis, e o formato que cada um aceita. O que nao esta aqui nao
 *  vai pro jogo — a rota valida contra esta tabela. */
export const CAMPOS_AUTO = {
  autoCatch: "bool",
  autoCatchBallId: "int",
  autoCatchShiny: "bool",
  autoCatchShinyBallId: "int",
  autoPotion: "bool",
  autoPotionThreshold: "pct",
  autoRevive: "bool",
  selectedBallId: "int",
} as const;
export type CampoAuto = keyof typeof CAMPOS_AUTO;

function lerEstado(bruto: unknown): EstadoAuto {
  const c = ((bruto as { character?: unknown })?.character ?? bruto ?? {}) as Record<string, unknown>;
  return {
    autoCatch: Boolean(c.autoCatch),
    autoCatchBallId: num(c.autoCatchBallId),
    autoCatchShiny: Boolean(c.autoCatchShiny),
    autoCatchShinyBallId: num(c.autoCatchShinyBallId),
    autoPotion: Boolean(c.autoPotion),
    autoPotionThreshold: num(c.autoPotionThreshold),
    autoRevive: Boolean(c.autoRevive),
    selectedBallId: num(c.selectedBallId),
    vipNoJogo: Boolean(c.isVip),
  };
}

/**
 * O estoque de bolas.
 *
 * Aceita os dois formatos porque o jogo manda os dois: `/api/game/balls` e o
 * frame `balls` vem como `{catalog, counts}`, e a resposta do auto-helper vem
 * como array com `quantity` embutido. Um parser so evita a divergencia calada
 * entre "o que a tela mostra" e "o que o gatilho de compra le".
 */
export function lerBolas(bruto: unknown): BolaEstoque[] {
  const lista = Array.isArray(bruto)
    ? (bruto as Record<string, unknown>[])
    : Array.isArray((bruto as { catalog?: unknown })?.catalog)
      ? ((bruto as { catalog: unknown[] }).catalog as Record<string, unknown>[])
      : [];
  const contagens = ((bruto as { counts?: unknown })?.counts ?? {}) as Record<string, unknown>;
  return lista.map((b) => {
    const id = num(b.id);
    return {
      id,
      nome: typeof b.name === "string" ? b.name : `#${id}`,
      icone: typeof b.iconUrl === "string" ? gameAssetUrl(b.iconUrl) : "",
      quantidade: num(b.quantity ?? b.count ?? contagens[String(id)]),
      infinita: Boolean(b.infinite),
    };
  });
}

export interface LeituraAuto {
  auto: EstadoAuto;
  bolas: BolaEstoque[];
  tokens: Tokens;
  mudou: boolean;
}

/** Le config + estoque. `null` = inalcancavel; `{vencido:true}` = 401. */
export async function lerAuto(inicial: Tokens): Promise<LeituraAuto | { vencido: true } | null> {
  let tokens = inicial;
  let mudou = false;

  const me = await pedirAoJogo("/api/characters/me", tokens).catch(() => null);
  if (!me) return null;
  if (me.mudou) {
    tokens = me.tokens;
    mudou = true;
  }
  if (me.res.status === 401) return { vencido: true };
  const meBruto = await me.res.json().catch(() => null);

  const bolasRes = await pedirAoJogo("/api/game/balls", tokens).catch(() => null);
  if (bolasRes?.mudou) {
    tokens = bolasRes.tokens;
    mudou = true;
  }
  const bolasBruto = bolasRes ? await bolasRes.res.json().catch(() => null) : null;

  return { auto: lerEstado(meBruto), bolas: lerBolas(bolasBruto), tokens, mudou };
}

/** Aplica um patch de config. A resposta ja devolve o estado novo. */
export async function aplicarAuto(
  inicial: Tokens,
  patch: Partial<Record<CampoAuto, number | boolean>>,
): Promise<{ ok: boolean; status: number; leitura?: LeituraAuto; tokens: Tokens; mudou: boolean }> {
  const r = await enviarAoJogo("/api/game/auto-helper", inicial, patch);
  if (!r.res.ok) return { ok: false, status: r.res.status, tokens: r.tokens, mudou: r.mudou };
  const bruto = await r.res.json().catch(() => null);
  return {
    ok: true,
    status: r.res.status,
    leitura: {
      auto: lerEstado(bruto),
      bolas: lerBolas((bruto as { balls?: unknown })?.balls),
      tokens: r.tokens,
      mudou: r.mudou,
    },
    tokens: r.tokens,
    mudou: r.mudou,
  };
}

/** Sanea um patch vindo da tela contra `CAMPOS_AUTO`. O que nao casa cai fora —
 *  a rota nunca repassa campo desconhecido pro jogo. */
export function limparPatch(bruto: unknown): Partial<Record<CampoAuto, number | boolean>> {
  const entrada = (bruto ?? {}) as Record<string, unknown>;
  const saida: Partial<Record<CampoAuto, number | boolean>> = {};
  for (const [campo, forma] of Object.entries(CAMPOS_AUTO) as [CampoAuto, string][]) {
    const v = entrada[campo];
    if (v === undefined) continue;
    if (forma === "bool" && typeof v === "boolean") saida[campo] = v;
    if (forma === "int" && typeof v === "number" && Number.isFinite(v)) saida[campo] = Math.trunc(v);
    if (forma === "pct" && typeof v === "number" && Number.isFinite(v)) {
      saida[campo] = Math.max(0, Math.min(100, Math.round(v)));
    }
  }
  return saida;
}
