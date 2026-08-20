// Dificuldade de CAPTURA por especie, lida do proprio jogo (server-only).
//
// O jogo nao publica a formula de captura — nao existe `pokepedia/systems/capture`, e
// nenhum JSON publico tem taxa por especie. O que ele publica sao as PECAS:
//
//   - cada arremesso e UMA bola ("Each capture attempt uses 1 ball");
//   - a chance por arremesso e `base x catchRate da bola`, travada em 100% (a formula do
//     shiny, visivel no bundle, prova que o termo da bola e linear);
//   - existe um MEDIDOR DE INVESTIMENTO por especie: "quanto mais bolas voce investe numa
//     especie, maior a chance" — e ele ZERA a cada captura;
//   - profissao multiplica ate x1,18; a pokedex da +1% aos 1.000 abates, +2% aos 50.000 e
//     +3% aos 100.000; VIP nao da chance nenhuma (so libera o auto-catch).
//
// Sem formula, a saida e medir. E o jogo guarda a medida em /api/game/used-balls:
// `attempts` = bolas gastas NESTA especie DESDE A ULTIMA CAPTURA. E o numero que separa o
// Ledian (22 bolas desde a ultima) do Furious Scyther (487) e do Parasect (920, nunca
// capturado) — e era exatamente essa diferenca que faltava quando o ranking projetou a
// taxa media do Yanma em cima do Tyrogue, que vale 75.000 por bicho.
//
// O que isto NAO e: a formula. E uma estimativa a partir de UMA observacao por especie, e
// o medidor de investimento faz a chance subir dentro de cada ciclo — entao o numero vale
// como ordem de grandeza pra ORDENAR alvos, nao como promessa.

import { gameFetch, type Tokens } from "./game-auth";
import { getGameLink, updateGameTokens } from "./game-link";

export interface SpeciesCatch {
  speciesId: number;
  /** bolas gastas nesta especie desde a ultima captura (o medidor de investimento) */
  attempts: number;
  /** bolas gastas nela na vida inteira */
  total: number;
  /** ouro gasto em bola nesta especie */
  goldSpent: number;
  /** preco medio da bola usada aqui — o custo real de uma tentativa */
  ballCost: number;
  /** ja capturou esta especie alguma vez (o medidor zerou pelo menos uma vez) */
  everCaught: boolean;
}

export interface CatchData {
  bySpecies: Map<number, SpeciesCatch>;
  /** bolas gastas somadas — serve de amostra pra dizer se vale confiar */
  totalBalls: number;
  at: number;
}

const CACHE_MS = 5 * 60_000; // muda devagar (e um acumulado de vida inteira)
const cache = new Map<string, { data: CatchData; exp: number }>();

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function fetchCatchData(userId: string, force = false): Promise<CatchData | null> {
  const now = Date.now();
  const hit = cache.get(userId);
  if (!force && hit && hit.exp > now) return hit.data;

  const link = await getGameLink(userId);
  if (!link || link.status !== "active") return null;

  let tokens: Tokens = link.tokens;
  let raw: unknown = null;
  try {
    const r = await gameFetch("/api/game/used-balls", tokens);
    if (r.changed) { tokens = r.tokens; await updateGameTokens(userId, tokens).catch(() => {}); }
    if (!r.res.ok) return null;
    raw = await r.res.json().catch(() => null);
  } catch {
    return null;
  }

  const list = (raw as { pokemons?: unknown[] } | null)?.pokemons;
  if (!Array.isArray(list)) return null;

  const bySpecies = new Map<number, SpeciesCatch>();
  let totalBalls = 0;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    // variante shiny tem entrada propria; a dificuldade que interessa e a da especie
    if (p.shiny === true) continue;
    const speciesId = num(p.speciesId ?? p.dexId);
    if (!speciesId) continue;
    const total = num(p.total);
    const attempts = num(p.attempts);
    const goldSpent = num(p.goldSpent);
    if (total <= 0) continue;
    totalBalls += total;
    bySpecies.set(speciesId, {
      speciesId,
      attempts,
      total,
      goldSpent,
      ballCost: goldSpent > 0 ? goldSpent / total : 0,
      // o medidor zera na captura: gastou mais na vida do que desde a ultima = ja capturou
      everCaught: attempts < total,
    });
  }

  const data: CatchData = { bySpecies, totalBalls, at: now };
  cache.set(userId, { data, exp: now + CACHE_MS });
  return data;
}

/**
 * Chance de captura por ABATE nesta especie, estimada do medidor de investimento.
 *
 * Tratamos `attempts` (bolas desde a ultima captura) como UMA amostra do intervalo entre
 * capturas: um intervalo tipico de N bolas corresponde a ~1/N de chance por arremesso, e
 * como o auto-catch joga ~1 bola por corpo (Ledian: 22.7k bolas em 25.7k abates), chance
 * por arremesso e chance por abate viram a mesma conta.
 *
 * `prior` puxa pra taxa geral quando a especie tem pouca bola gasta — uma especie com 3
 * bolas nao sustenta estimativa nenhuma.
 */
export function rateFromMeter(s: SpeciesCatch | undefined, globalRate: number, prior = 4): number | null {
  if (!s || s.total < 10) return null; // sem bola suficiente, sem evidencia
  return (1 + prior * globalRate) / (s.attempts + 1 + prior);
}
