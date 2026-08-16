// Auto-Helper do jogo: le e escreve as configs de automacao NATIVA (autoCatch/bola,
// autoCatchShiny/bola, autoPotion/limite, autoRevive, bola selecionada). Escrita
// confirmada server-side por Bearer: POST /api/game/auto-helper { <campo>: valor }.
// Server-only. Nunca toca compra/venda — so config, reversivel.

import { gameFetch, gameSend, type Tokens } from "./game-auth";

const GAME = process.env.GAME_HOST || "https://poke.idleworld.online";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const abs = (u: string) => (u.startsWith("http") ? u : `${GAME}${u.startsWith("/") ? "" : "/"}${u}`);

export interface AutoState {
  autoCatch: boolean;
  autoCatchBallId: number;
  autoCatchShiny: boolean;
  autoCatchShinyBallId: number;
  autoPotion: boolean;
  autoPotionThreshold: number;
  autoRevive: boolean;
  selectedBallId: number;
  isVip: boolean; // autoCatch e recurso VIP do JOGO — se false, o toggle nao pega
}

export interface BallOpt {
  id: number;
  name: string;
  iconUrl: string;
  count: number;
  infinite: boolean;
}

// Campos gravaveis e como validar o valor (o resto e rejeitado pela rota).
export const AUTO_FIELDS = {
  autoCatch: "bool",
  autoCatchBallId: "int",
  autoCatchShiny: "bool",
  autoCatchShinyBallId: "int",
  autoPotion: "bool",
  autoPotionThreshold: "pct", // 0..100
  autoRevive: "bool",
  selectedBallId: "int",
} as const;
export type AutoField = keyof typeof AUTO_FIELDS;

function parseAuto(charRaw: unknown): AutoState {
  const c = ((charRaw as { character?: unknown })?.character ?? charRaw ?? {}) as Record<string, unknown>;
  return {
    autoCatch: Boolean(c.autoCatch),
    autoCatchBallId: num(c.autoCatchBallId),
    autoCatchShiny: Boolean(c.autoCatchShiny),
    autoCatchShinyBallId: num(c.autoCatchShinyBallId),
    autoPotion: Boolean(c.autoPotion),
    autoPotionThreshold: num(c.autoPotionThreshold),
    autoRevive: Boolean(c.autoRevive),
    selectedBallId: num(c.selectedBallId),
    isVip: Boolean(c.isVip),
  };
}

// Aceita tanto { catalog:[...], counts:{...} } (endpoint /balls) quanto um array cru
// com quantity inline (resposta do auto-helper).
function parseBalls(raw: unknown): BallOpt[] {
  const list = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : Array.isArray((raw as { catalog?: unknown })?.catalog)
      ? ((raw as { catalog: unknown[] }).catalog as Record<string, unknown>[])
      : [];
  const counts = ((raw as { counts?: unknown })?.counts ?? {}) as Record<string, unknown>;
  return list.map((b) => {
    const id = num(b.id);
    return {
      id,
      name: typeof b.name === "string" ? b.name : `#${id}`,
      iconUrl: typeof b.iconUrl === "string" ? abs(b.iconUrl) : "",
      count: num(b.quantity ?? b.count ?? counts[String(id)]),
      infinite: Boolean(b.infinite),
    };
  });
}

export interface AutoResult {
  auto: AutoState;
  balls: BallOpt[];
  tokens: Tokens;
  changed: boolean;
}

// Le o estado atual (auto + catalogo de bolas). null = inalcancavel; 'unauth' = 401.
export async function readAuto(initial: Tokens): Promise<AutoResult | { unauth: true } | null> {
  let tokens = initial;
  let changed = false;

  const me = await gameFetch("/api/characters/me", tokens).catch(() => null);
  if (!me) return null;
  if (me.changed) { tokens = me.tokens; changed = true; }
  if (me.res.status === 401) return { unauth: true };
  const meRaw = await me.res.json().catch(() => null);

  const ballsRes = await gameFetch("/api/game/balls", tokens).catch(() => null);
  if (ballsRes?.changed) { tokens = ballsRes.tokens; changed = true; }
  const ballsRaw = ballsRes ? await ballsRes.res.json().catch(() => null) : null;

  return { auto: parseAuto(meRaw), balls: parseBalls(ballsRaw), tokens, changed };
}

// Aplica UM campo (POST auto-helper). Retorna o novo estado (a resposta ja traz auto+balls).
export async function applyAuto(
  initial: Tokens,
  patch: Partial<Record<AutoField, number | boolean>>,
): Promise<{ ok: boolean; status: number; result?: AutoResult; tokens: Tokens; changed: boolean }> {
  const r = await gameSend("/api/game/auto-helper", initial, "POST", patch);
  const tokens = r.tokens;
  if (!r.res.ok) return { ok: false, status: r.res.status, tokens, changed: r.changed };
  const raw = await r.res.json().catch(() => null);
  // A resposta do auto-helper traz os campos de auto + balls; reusa os parsers.
  return {
    ok: true,
    status: r.res.status,
    result: { auto: parseAuto(raw), balls: parseBalls((raw as { balls?: unknown })?.balls), tokens, changed: r.changed },
    tokens,
    changed: r.changed,
  };
}
