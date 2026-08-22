// Motor da tela de hunt: o que se pode perguntar sobre uma caçada e como ordenar.
//
// O `combat.ts` responde "quanto rende ESTE alvo pra ESTE pokemon" — dois lados do
// combate, sobrevivencia e rendimento efetivo. Aqui em cima disso entram as tres
// coisas que sao escolha do JOGADOR, e nao do motor:
//
//  1. **O que conta como ganho.** XP, ouro do loot, ou ouro contando a captura.
//     Sao ordens diferentes: a hunt que mais paga em drop raramente e a que mais
//     paga em pokemon vendido.
//  2. **O Tipo do Dia.** Ele MULTIPLICA a chance de cada drop e a chance tem teto
//     (`boost.ts`), entao o bonus tem que ser refeito drop a drop. Aplicar "+20%
//     no ouro total" e o erro que o teto desmente: um drop que ja nasce em 95%
//     converte 5% do bonus, nao 20%.
//  3. **A bola.** Capturar nao e de graça: o jogo gasta uma bola por abate e a
//     chance por abate e pequena. Bola melhor sobe a chance E o custo — e em alvo
//     barato ela chega a torrar mais ouro do que a captura devolve. Por isso a
//     conta de captura aqui e LIQUIDA (o que a captura rende menos o que ela
//     custa), e nao so o que ela rende.
//
// A lei de captura e ajuste empirico com erro mediano de ~1,9x (ver `catch-law.ts`):
// serve pra ORDENAR alvos e dar a ordem de grandeza do custo, nao como numero exato.

import { ballByKey, type Ball } from "./balls";
import { CHANCE_MAX, TYPE_DAY_BONUS } from "./boost";
import { CATCH_LAW_FALLBACK, predictCatchRate } from "./catch-law";
import { estimateHunt, type HuntEstimate, type Move, type MovePool, type MovesOf, type Species } from "./combat";
import type { HuntTarget, PackedDrops, PackedMove, PackedSpecies } from "./hunt-data";
import type { PokeType } from "./types";

// ------------------------------------------------------------------ desempacotar

const unpackMove = (m: PackedMove): Move => ({
  type: m[0],
  power: m[1],
  learn: m[2],
  category: m[3] === 1 ? "SPECIAL" : "PHYSICAL",
  cooldownMs: m[4],
  tm: m[5] === 1,
});

/** A especie no formato do motor. `evolvesToId` vai null de proposito: a rota usa
 *  a especie ESCOLHIDA em todos os niveis (evoluir nao re-rola IV nem devolve o
 *  pokemon anterior), entao o motor nunca evolui ninguem. */
export const unpackSpecies = (p: PackedSpecies): Species => ({
  pokeId: p.id,
  name: p.name,
  t1: p.t1,
  t2: p.t2,
  bases: p.bases,
  evolvesToId: null,
  evolveLevel: null,
  moves: p.mv.map(unpackMove),
});

/** Resolve os golpes de qualquer especie pelo id — e o que o motor pede pro lado
 *  selvagem do combate (`threatOf`). */
export function movesResolver(species: PackedSpecies[]): MovesOf {
  const cache = new Map<number, Move[]>();
  const byId = new Map<number, PackedSpecies>();
  for (const s of species) byId.set(s.id, s);
  return (pokeId: number): Move[] => {
    const hit = cache.get(pokeId);
    if (hit) return hit;
    const mv = (byId.get(pokeId)?.mv ?? []).map(unpackMove);
    cache.set(pokeId, mv);
    return mv;
  };
}

// ------------------------------------------------------------------ Tipo do Dia

/** Ouro por abate sob um multiplicador de loot, RESPEITANDO o teto de chance. */
export function goldUnder(drops: [number, number, number][] | undefined, mult: number): number {
  if (!drops?.length) return 0;
  let g = 0;
  for (const [chance, qty, price] of drops) {
    g += (Math.min(CHANCE_MAX, chance * mult) / CHANCE_MAX) * qty * price;
  }
  return g;
}

/** O alvo e do tipo premiado hoje? So nele o bonus do dia vale. */
export const dayHits = (day: PokeType | "", t1: PokeType, t2: PokeType | null): boolean =>
  day !== "" && (t1 === day || t2 === day);

// ------------------------------------------------------------------ entrada

/** O pokemon e o cenario: o que exige um CALCULAR pra valer. Mora aqui, e nao no
 *  componente, porque as duas vistas (rota e tabela) leem a mesma coisa e nenhuma
 *  delas deve importar do pai — isso fecharia um ciclo de import. */
export interface HuntEntrada {
  id: number;
  level: number;
  quality: number;
  /** os seis stats como o jogo mostra; tudo zero = IV medio */
  stats: number[];
  pool: MovePool;
  vip: boolean;
  day: PokeType | "";
  /** contar a captura no ouro */
  cap: boolean;
  ball: string;
}

// ------------------------------------------------------------------ economia

export interface CatchEconomy {
  /** chance de capturar POR ABATE, com a bola escolhida */
  chance: number;
  /** abates esperados ate uma captura (1/chance) */
  tries: number;
  /** ouro gasto em bolas ate capturar um */
  cost: number;
  /** o que a captura rende POR ABATE, ja descontando a bola gasta nele */
  net: number;
  ball: Ball;
}

export interface TargetEconomy {
  /** ouro do loot por abate, ja com o Tipo do Dia onde ele vale */
  loot: number;
  dayHit: boolean;
  /** null quando o alvo nao tem valor de venda: a lei nao tem como estimar */
  catch: CatchEconomy | null;
  /** o que o alvo paga por abate no total — e o numero que vira ouro/h */
  perKill: number;
}

export interface EconomyOptions {
  /** tipo premiado hoje; "" = nenhum */
  day: PokeType | "";
  /** quanto o dia paga (fracao); ausente cai no padrao do jogo */
  dayPct?: number;
  drops: PackedDrops;
  ballKey: string;
  /** contar a captura no ouro (o jogo gasta uma bola por abate) */
  withCatch: boolean;
}

/** Quanto cada alvo paga por abate, no cenario escolhido. */
export function economyOf(targets: HuntTarget[], o: EconomyOptions): Map<number, TargetEconomy> {
  const ball = ballByKey(o.ballKey) ?? ballByKey("poke")!;
  const pct = o.dayPct ?? TYPE_DAY_BONUS;
  const out = new Map<number, TargetEconomy>();

  for (const t of targets) {
    const dayHit = dayHits(o.day, t.t1, t.t2);
    // Sem Tipo do Dia o ouro ja veio pronto do servidor; com ele a conta e refeita
    // drop a drop, porque o teto de chance engole parte do bonus.
    const loot = dayHit ? goldUnder(o.drops[t.pokeId], 1 + pct) : t.goldEV;

    let economy: CatchEconomy | null = null;
    if (t.sell > 0) {
      const chance = predictCatchRate(CATCH_LAW_FALLBACK, t.sell, ball.catchRate);
      const price = ball.priceGold ?? 0;
      economy = {
        chance,
        tries: chance > 0 ? 1 / chance : Infinity,
        cost: chance > 0 ? price / chance : Infinity,
        // Captura nao e de graça: cada abate gasta uma bola, capturando ou nao.
        // Em alvo barato com bola cara isso fica NEGATIVO — e e informacao, nao erro.
        net: chance * t.sell - price,
        ball,
      };
    }

    out.set(t.pokeId, {
      loot,
      dayHit,
      catch: economy,
      perKill: loot + (o.withCatch ? economy?.net ?? 0 : 0),
    });
  }
  return out;
}

/** Os alvos com o `goldEV` trocado pelo ouro TOTAL por abate. O motor de combate
 *  multiplica esse campo pelos KOs/h efetivos, entao trocar aqui faz o ouro/h (e a
 *  rota por ouro) ja sairem com o Tipo do Dia e a captura dentro — sem que o motor
 *  precise conhecer nenhum dos dois. */
export const withEconomy = (targets: HuntTarget[], econ: Map<number, TargetEconomy>): HuntTarget[] =>
  targets.map((t) => {
    const e = econ.get(t.pokeId);
    return e && e.perKill !== t.goldEV ? { ...t, goldEV: e.perKill } : t;
  });

// ------------------------------------------------------------------ ranking

export interface HuntRow {
  target: HuntTarget;
  est: HuntEstimate;
  econ: TargetEconomy;
}

export interface RankOptions {
  /** alvos JA com a economia aplicada (`withEconomy`) */
  targets: HuntTarget[];
  econ: Map<number, TargetEconomy>;
  movesOf: MovesOf;
  level: number;
  ivs: number[];
  quality: number;
  vip: boolean;
  pool: MovePool;
}

/** Rendimento de CADA alvo pro pokemon informado. Alvo que voce nao consegue
 *  machucar sai da lista: nao e hunt, e parede. */
export function rankHunts(fighter: Species, o: RankOptions): HuntRow[] {
  const rows: HuntRow[] = [];
  for (const t of o.targets) {
    const est = estimateHunt(fighter, o.level, o.ivs, o.quality, t, o.movesOf(t.pokeId), o.vip, o.pool);
    const econ = o.econ.get(t.pokeId);
    if (!est || !econ) continue;
    rows.push({ target: t, est, econ });
  }
  return rows;
}

// ------------------------------------------------------------------ ordenacao

export type HuntSort = "xp" | "gold" | "kos" | "eff" | "risk" | "level" | "name";

export const SORT_LABEL: Record<HuntSort, string> = {
  xp: "XP por hora",
  gold: "Ouro por hora",
  kos: "Abates por hora",
  eff: "Efetividade do golpe",
  risk: "Segurança",
  level: "Nível da hunt",
  name: "Nome",
};

const SORTERS: Record<HuntSort, (a: HuntRow, b: HuntRow) => number> = {
  xp: (a, b) => b.est.xpH - a.est.xpH,
  gold: (a, b) => b.est.goldH - a.est.goldH,
  kos: (a, b) => b.est.kosH - a.est.kosH,
  // Empate de efetividade e comum (meio catalogo bate x2.5); o desempate pelo XP/h
  // evita uma lista alfabetica disfarcada de ranking.
  eff: (a, b) => b.est.eff - a.est.eff || b.est.xpH - a.est.xpH,
  risk: (a, b) => b.est.threat.killsPerLife - a.est.threat.killsPerLife || b.est.xpH - a.est.xpH,
  level: (a, b) => b.target.huntLevel - a.target.huntLevel || b.est.xpH - a.est.xpH,
  name: (a, b) => b.target.name.localeCompare(a.target.name),
};

export function sortRows(rows: HuntRow[], sort: HuntSort, dir: "asc" | "desc"): HuntRow[] {
  const out = [...rows].sort(SORTERS[sort]);
  return dir === "asc" ? out.reverse() : out;
}

// ------------------------------------------------------------------ rotulos

export const RISK_LABEL = { safe: "Seguro", risky: "Arriscado", deadly: "Letal" } as const;

/** Multiplicador de efetividade como o jogo mostra: x2.5, x1, x0.33. */
export const effLabel = (m: number): string =>
  m === 0 ? "imune" : Number.isInteger(m) ? `${m}x` : `${+m.toFixed(2)}x`;

/** Numero por hora em notacao compacta — a coluna nao pode esticar com "1.234.567". */
export function perHourLabel(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const neg = n < 0 ? "−" : "";
  const v = Math.abs(n);
  if (v >= 1e6) return `${neg}${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}M/h`;
  if (v >= 1000) return `${neg}${(v / 1000).toFixed(v >= 1e4 ? 0 : 1).replace(".", ",").replace(/,0$/, "")}k/h`;
  return `${neg}${Math.round(v)}/h`;
}

/** Tempo em horas legivel: "2h 30min", "45min", "3min". */
export function horasLabel(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "—";
  if (h >= 1) {
    const inteiras = Math.floor(h);
    const min = Math.round((h - inteiras) * 60);
    return min > 0 ? `${inteiras}h ${min}min` : `${inteiras}h`;
  }
  const min = Math.round(h * 60);
  return min >= 1 ? `${min}min` : "<1min";
}
