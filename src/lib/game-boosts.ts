// Bonus ATIVOS na conta, lidos do JOGO (server-only). O que o piwdex quer daqui e o
// TIPO DO DIA: o jogo premia um tipo por dia e paga +X% de loot e de XP — mas SO nos
// pokemons daquele tipo (o unico bonus condicional do jogo; ver lib/boost.ts).
//
// Contrato verificado com token real (ago/2026):
//   GET /api/game/boosts -> { boosts: [...], events: [{ key, name, desc, pct, emoji, until }] }
//   GET /api/game/streak -> { tracks: { loot }, bonusPct: { exp, loot, shiny }, ... }
//
// Duas armadilhas do payload, e sao as duas que decidem o desenho do parser:
//
//  - o `pct` do evento veio ZERO no dia em que conferimos; o numero de verdade estava na
//    FRASE (`desc`: "+20% de XP e +20% de loot em Pokemon do tipo Sombrio"). Entao a
//    frase e a fonte primaria e o campo e o plano B, nao o contrario.
//  - o tipo vem no IDIOMA DA CONTA ("Sombrio", nao "DARK"). A traducao e por tabela de
//    apelidos nos tres idiomas do jogo, casando por PALAVRA INTEIRA — procurar substring
//    faria "ACO" casar dentro de qualquer palavra que o jogo escrevesse.
//
// O numero que sai daqui SUBSTITUI o palpite do site: TYPE_DAY_BONUS agora e so o valor
// de fallback pra quem nao tem conta conectada.

import { gameFetch, type Tokens } from "./game-auth";
import { getGameLink, updateGameTokens } from "./game-link";
import { STREAK_STEP, TYPE_DAY_BONUS, type LootBonuses } from "./boost";
import type { PokeType } from "./types";

/** Chave do evento de tipo do dia no payload do jogo. */
const TYPE_DAY_KEY = "type-of-day";

/** Acentos fora, tudo maiusculo — o jogo escreve "Sombrio", "Eletrico", "Psiquico". */
const norm = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

// Apelidos do tipo nos idiomas em que o jogo escreve (pt/en/es). Nao reusa o TYPE_LABEL
// do i18n de proposito: aquilo e o rotulo do SITE (e arrastaria 200KB de dicionario pro
// bundle do servidor); isto aqui e o vocabulario da FONTE, que pode divergir do nosso.
const TYPE_WORDS: Record<PokeType, string[]> = {
  NORMAL: ["NORMAL"],
  FIRE: ["FIRE", "FOGO", "FUEGO"],
  WATER: ["WATER", "AGUA"],
  ELECTRIC: ["ELECTRIC", "ELETRICO", "ELECTRICO"],
  GRASS: ["GRASS", "PLANTA", "GRAMA"],
  ICE: ["ICE", "GELO", "HIELO"],
  FIGHTING: ["FIGHTING", "LUTA", "LUCHA"],
  POISON: ["POISON", "VENENO"],
  GROUND: ["GROUND", "TERRA", "TIERRA"],
  FLYING: ["FLYING", "VOADOR", "VOLADOR"],
  PSYCHIC: ["PSYCHIC", "PSIQUICO"],
  BUG: ["BUG", "INSETO", "BICHO"],
  ROCK: ["ROCK", "PEDRA", "ROCA"],
  GHOST: ["GHOST", "FANTASMA"],
  DRAGON: ["DRAGON", "DRAGAO"],
  DARK: ["DARK", "SOMBRIO", "SINIESTRO", "OSCURO", "NOTURNO"],
  STEEL: ["STEEL", "ACO", "ACERO"],
  FAIRY: ["FAIRY", "FADA", "HADA"],
};

const WORD_TO_TYPE: Map<string, PokeType> = new Map();
for (const t of Object.keys(TYPE_WORDS) as PokeType[]) {
  for (const w of TYPE_WORDS[t]) WORD_TO_TYPE.set(w, t);
}

/** Tipo citado no texto, casando PALAVRA por PALAVRA. null = nao reconheceu nenhum. */
export function typeFromText(text: string): PokeType | null {
  for (const word of norm(text).split(/[^A-Z]+/)) {
    const hit = WORD_TO_TYPE.get(word);
    if (hit) return hit;
  }
  return null;
}

/** Porcentagem escrita PERTO de uma palavra-chave, em fracao (20% -> 0.2). Pega a
 *  ocorrencia mais proxima porque a mesma frase costuma trazer duas ("+20% de XP e
 *  +20% de loot") e cada uma pertence a uma palavra. null = a frase nao tem numero. */
function pctNear(text: string, words: string[]): number | null {
  const t = norm(text);
  const hits = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)];
  if (!hits.length) return null;
  let best: { dist: number; value: number } | null = null;
  for (const w of words) {
    const at = t.indexOf(w);
    if (at < 0) continue;
    for (const m of hits) {
      const dist = Math.abs((m.index ?? 0) - at);
      const value = parseFloat(m[1].replace(",", ".")) / 100;
      if (!best || dist < best.dist) best = { dist, value };
    }
  }
  return best ? best.value : null;
}

const LOOT_WORDS = ["LOOT", "DROP", "BOTIN", "SAQUE"];
const XP_WORDS = ["XP", "EXP"];

/** O tipo premiado hoje, ja com o quanto ele paga. `type` null = o jogo anunciou um
 *  tipo que a tabela de apelidos nao conhece — a UI mostra o `label` cru em vez de
 *  fingir que sabe. */
export interface TypeDayBonus {
  type: PokeType | null;
  /** nome do evento como o jogo escreveu (com emoji) */
  label: string;
  lootPct: number;
  xpPct: number;
  /** epoch ms em que o bonus acaba; null = o jogo nao disse */
  until: number | null;
}

/** Tudo que multiplica o loot AGORA nesta conta. */
export interface GameBoosts {
  typeDay: TypeDayBonus | null;
  /** trilha Loot do Streak, em fracao (30 pontos -> 0,03) */
  streakLootPct: number;
  /** boosts temporarios ativos que mexem no loot, somados */
  boostLootPct: number;
  boostXpPct: number;
  at: number;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const textOf = (b: Record<string, unknown>): string =>
  [b.key, b.name, b.desc, b.description, b.type]
    .filter((v): v is string => typeof v === "string")
    .join(" ");

function parseTypeDay(events: unknown): TypeDayBonus | null {
  if (!Array.isArray(events)) return null;
  for (const raw of events) {
    const e = asRecord(raw);
    if (!e) continue;
    const text = textOf(e);
    if (norm(String(e.key ?? "")) !== norm(TYPE_DAY_KEY) && !norm(text).includes("TIPO DO DIA")) continue;

    // frase primeiro, campo depois: o `pct` chegou zerado na conferencia de ago/2026
    const fieldPct = typeof e.pct === "number" && e.pct > 0 ? e.pct / 100 : null;
    const lootPct = pctNear(text, LOOT_WORDS) ?? fieldPct ?? TYPE_DAY_BONUS;
    const xpPct = pctNear(text, XP_WORDS) ?? fieldPct ?? lootPct;
    // o nome ("Tipo do Dia: Sombrio") e onde o tipo aparece limpo; a desc e a reserva
    const type = typeFromText(String(e.name ?? "")) ?? typeFromText(String(e.desc ?? ""));
    const until = typeof e.until === "number" && e.until > 0 ? e.until : null;
    return { type, label: String(e.name ?? "").trim(), lootPct, xpPct, until };
  }
  return null;
}

/** Soma dos boosts temporarios que citam a palavra-chave. Forma NAO confirmada (o array
 *  veio vazio na conferencia), entao o parser e tolerante: se o jogo mudar o formato o
 *  resultado e 0 — que e o caso comum — e nunca um numero inventado. */
function activeBoostPct(boosts: unknown, words: string[]): number {
  if (!Array.isArray(boosts)) return 0;
  let sum = 0;
  for (const raw of boosts) {
    const b = asRecord(raw);
    if (!b) continue;
    const text = textOf(b);
    if (!words.some((w) => norm(text).includes(w))) continue;
    const fieldPct = typeof b.pct === "number" && b.pct > 0 ? b.pct / 100 : null;
    sum += pctNear(text, words) ?? fieldPct ?? 0;
  }
  return sum;
}

function parseStreakLoot(streak: unknown): number {
  const s = asRecord(streak);
  if (!s) return 0;
  const b = asRecord(s.bonusPct);
  if (b && typeof b.loot === "number") return b.loot / 100; // ja vem em % (3 -> 0,03)
  const tracks = asRecord(s.tracks);
  if (tracks && typeof tracks.loot === "number") return tracks.loot * STREAK_STEP; // pontos
  return 0;
}

// O tipo do dia e global e dura horas; os boosts temporarios sao do jogador e podem
// entrar/sair a qualquer momento. Um TTL curto atende os dois sem martelar o jogo a cada
// abertura do painel.
const CACHE_MS = 60_000;
const cache = new Map<string, { data: GameBoosts; exp: number }>();

/** Le os bonus da conta vinculada. null = sem vinculo utilizavel ou o jogo nao respondeu. */
export async function fetchGameBoosts(userId: string, force = false): Promise<GameBoosts | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (!force && hit && hit.exp > now) return hit.data;

  const link = await getGameLink(userId);
  if (!link || link.status !== "active") return null;

  let tokens: Tokens = link.tokens;
  let changed = false;
  // sequencial de proposito: em paralelo as duas chamadas partiriam do MESMO access
  // vencido e cada uma dispararia o proprio refresh.
  const json = async (path: string): Promise<unknown> => {
    try {
      const r = await gameFetch(path, tokens);
      if (r.changed) { tokens = r.tokens; changed = true; }
      if (!r.res.ok) return null;
      return await r.res.json().catch(() => null);
    } catch {
      return null;
    }
  };

  const boostsRes = asRecord(await json("/api/game/boosts"));
  const streakRes = await json("/api/game/streak");
  if (changed) await updateGameTokens(userId, tokens).catch(() => {});
  if (!boostsRes && !streakRes) return null;

  const data: GameBoosts = {
    typeDay: parseTypeDay(boostsRes?.events),
    streakLootPct: parseStreakLoot(streakRes),
    boostLootPct: activeBoostPct(boostsRes?.boosts, LOOT_WORDS),
    boostXpPct: activeBoostPct(boostsRes?.boosts, XP_WORDS),
    at: now,
  };
  cache.set(userId, { data, exp: now + CACHE_MS });
  return data;
}

/** Traduz os bonus da conta pro cenario que o motor de loot entende (lib/boost.ts).
 *  `typeOverride`: `undefined` usa o tipo do dia real; um tipo simula outro dia; `null`
 *  desliga o bonus condicional (e o cenario "sem tipo do dia" da comparacao). */
export function lootBonusesOf(b: GameBoosts | null, typeOverride?: PokeType | null): LootBonuses {
  const typeDay = typeOverride === undefined ? b?.typeDay?.type ?? null : typeOverride;
  return {
    // a trilha do Streak vive em PONTOS no motor; a conta entrega em %
    streakLoot: Math.round((b?.streakLootPct ?? 0) / STREAK_STEP),
    lootBoost: false, // boost ativo entra por eventPct, com o % que o jogo informou
    eventPct: (b?.boostLootPct ?? 0) * 100,
    typeDay,
    typeDayPct: b?.typeDay?.lootPct,
  };
}
