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
import { BALLS, ballById } from "./balls";
import { CATCH_LAW_FALLBACK } from "./catch-law";
import type { Creature } from "./types";

/** catchRate por id de bola (dado-verdade do jogo, em src/data/balls.json). */
const BALL_RATE = new Map<number, number>(BALLS.map((b) => [b.id, b.catchRate]));

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
  /** catchRate MEDIO das bolas gastas nesta especie. A chance e linear nele, entao sem
   *  dividir por ele a medida mistura "bicho dificil" com "joguei bola fraca". */
  ballRate: number;
  /** ja capturou esta especie alguma vez (o medidor zerou pelo menos uma vez) */
  everCaught: boolean;
}

export interface CatchData {
  bySpecies: Map<number, SpeciesCatch>;
  /** bolas gastas somadas — serve de amostra pra dizer se vale confiar */
  totalBalls: number;
  /** auto-catch LIGADO na conta. Desligado, nao existe renda de captura nenhuma — e o
   *  primeiro fato a conferir antes de projetar ouro de bicho vendido. */
  autoCatch: boolean;
  /** catchRate da bola que o auto-catch usa (a chance e linear nele) */
  ballRate: number;
  ballName: string;
  /** id da pocao que o auto-potion usa — o custo de cura sai dela */
  potionItemId: number;
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

  // o auto-catch decide se existe captura, e com que bola
  let autoCatch = false, ballRate = 1, ballName = "", potionItemId = 0;
  try {
    const r = await gameFetch("/api/game/auto-helper", tokens);
    if (r.changed) { tokens = r.tokens; await updateGameTokens(userId, tokens).catch(() => {}); }
    if (r.res.ok) {
      const h = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
      autoCatch = Boolean(h?.autoCatch);
      const ball = ballById(num(h?.autoCatchBallId));
      if (ball) { ballRate = ball.catchRate; ballName = ball.name; }
      potionItemId = num(h?.autoPotionItemId);
    }
  } catch { /* sem o auto-helper, assume a bola fraca (subestima, nao inventa) */ }

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

    let weighted = 0, counted = 0;
    const balls = p.balls;
    if (balls && typeof balls === "object") {
      for (const [id, qty] of Object.entries(balls as Record<string, unknown>)) {
        const n = num(qty);
        if (n <= 0) continue;
        weighted += (BALL_RATE.get(Number(id)) ?? 1) * n;
        counted += n;
      }
    }
    const ballRate = counted > 0 ? weighted / counted : 1;
    bySpecies.set(speciesId, {
      speciesId,
      attempts,
      total,
      goldSpent,
      ballCost: goldSpent > 0 ? goldSpent / total : 0,
      ballRate,
      // o medidor zera na captura: gastou mais na vida do que desde a ultima = ja capturou
      everCaught: attempts < total,
    });
  }

  const data: CatchData = { bySpecies, totalBalls, autoCatch, ballRate, ballName, potionItemId, at: now };
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


// --- A LEI: quanto vale mais, mais dificil de capturar ---------------------------------
//
// O jogo nao publica a chance de captura por especie, e exigir que o jogador cace em todo
// spot pra descobrir seria inutil — a pergunta que o painel responde e justamente "pra
// onde eu vou?". Entao a chance se DERIVA.
//
// Cada especie no /api/game/used-balls entrega uma observacao: bolas gastas desde a
// ultima captura. Dividindo pelo catchRate medio das bolas usadas nela (a chance e linear
// na bola — a formula do shiny, visivel no bundle do jogo, prova), sobra a chance BASE da
// especie. Cruzando as 51 especies com bola suficiente contra os atributos do catalogo, o
// que explica a dificuldade e o VALOR DE VENDA, e forte: correlacao -0,82 em log-log
// (contra -0,65 antes de normalizar pela bola). O jogo cobra pelo bicho caro.
//
//     chanceBase = A * sellValue^b        (A ~ 4,7 e b ~ -0,71 na conta do Eduardo)
//     chance     = min(1, chanceBase * catchRate da bola)
//
// Conferencia: pro Yanma (9.000) a lei da 2,98% por abate com Ultra Ball; a hunt real
// mediu 2,4% (14 capturas em 586 abates).
//
// ISTO NAO E A FORMULA DO JOGO. E um ajuste empirico sobre uma observacao por especie, com
// erro mediano de ~1,9x — serve pra ORDENAR alvos, nao pra prometer numero. E por isso o
// ajuste e refeito com os dados de QUEM PERGUNTA: quanto mais especies a conta tiver no
// medidor, mais a lei descreve aquele jogador (bolas, profissao e bonus de pokedex dele
// entram embutidos). Os valores abaixo sao so o ponto de partida de quem nao tem dado.

export interface CatchLaw {
  a: number;
  b: number;
  /** quantas especies sustentaram o ajuste; 0 = usando o fallback */
  sample: number;
  /** erro mediano do ajuste, em "vezes" (1,9 = erra por fator ~2 pra cima ou pra baixo) */
  spread: number;
}

/** Ajusta `chanceBase = a * sellValue^b` sobre as especies com bola suficiente. */
export function fitCatchLaw(data: CatchData | null, creatureOf: (id: number) => Creature | undefined): CatchLaw {
  const xs: number[] = [];
  const ys: number[] = [];
  if (data) {
    for (const s of data.bySpecies.values()) {
      const c = creatureOf(s.speciesId);
      if (!c || c.sellValue <= 0 || s.total < 30) continue;
      // capturou alguma vez -> o intervalo mede a chance; nunca capturou -> teto de 1/total
      const observed = (s.everCaught ? 1 / (s.attempts + 1) : 1 / (s.total + 1)) / Math.max(1, s.ballRate);
      if (!(observed > 0)) continue;
      xs.push(Math.log(c.sellValue));
      ys.push(Math.log(observed));
    }
  }
  if (xs.length < 12) return { ...CATCH_LAW_FALLBACK, sample: xs.length, spread: 0 };

  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx <= 0) return { ...CATCH_LAW_FALLBACK, sample: xs.length, spread: 0 };
  const b = sxy / sxx;
  const a = Math.exp(my - b * mx);
  // expoente fora do plausivel = ajuste dominado por ruido; melhor o fallback
  if (!Number.isFinite(a) || !Number.isFinite(b) || b > -0.2 || b < -1.5) {
    return { ...CATCH_LAW_FALLBACK, sample: xs.length, spread: 0 };
  }
  const errs = xs.map((x, i) => Math.abs(ys[i] - (Math.log(a) + b * x))).sort((p, q) => p - q);
  return { a, b, sample: xs.length, spread: Math.exp(errs[Math.floor(errs.length / 2)]) };
}


