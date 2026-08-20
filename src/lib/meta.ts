// Motor de meta do piwdex: quem presta, contra quem, e por que.
//
// O piwtools mede o ataque como `poder x stat base` e a defesa como `hp+def+spDef`,
// soma com 55/35/10 (o 10 e VELOCIDADE) e corta o tier por POSICAO na fila. Os tres
// pontos sao furados, e e aqui que o piwdex diverge de proposito:
//
//  1. COOLDOWN. `poder x stat` trata Solar Beam (160 de poder, 30s de recarga) igual a
//     um golpe de 160 com 5s. No Poke Idle World o combate nao tem turno — o golpe sai
//     quando a recarga acaba. Entao o que mata e DANO POR SEGUNDO, nao poder.
//  2. STAB. Golpe do proprio tipo bate 1.5x (mesma regra que o motor de hunt ja usa).
//  3. HP e DEFESA SE MULTIPLICAM. Somar `hp+def` diz que 200 de HP com 20 de Def e igual
//     a 20 de HP com 200 de Def; na pratica o primeiro aguenta 10x mais. O que se aguenta
//     e HP EFETIVO = hp x def.
//  E VELOCIDADE NAO ENTRA: a doc do jogo (pokepedia/systems/power) so usa Speed na soma
//  do Power exibido — nenhum sistema publico dá a ela efeito em combate. Peso em stat que
//  nao faz nada e ruido que empurra pokemon rapido e inutil pra cima.
//
// O TIER tambem muda de natureza. Cortar por posicao (top 10% = S) faz o tier significar
// "sua fila", nao "sua forca": se metade do catalogo fosse otima, 40% dela viraria B ou
// pior. Aqui o corte e por SCORE — tier vira nota. Ver TIER_CUTS.
//
// Tudo aqui e ESTIMATIVA de comparacao, igual ao combat.ts: serve pra ordenar espécie
// contra espécie, nao como numero exato do jogo.

import { amplify } from "./combat";
import { effectiveness } from "./typing";
import type { Attack, Creature, PokeType } from "./types";

export type MovePool = "natural" | "tm";

/** Pesos do metaScore. Bater e mais decisivo que aguentar numa hunt idle (o alvo morre
 *  antes de te derrubar), mas quem nao aguenta rende zero — dai o 55/45 em vez de 70/30. */
const W_OFFENSE = 0.55;
const W_BULK = 0.45;

export type Tier = "S" | "A" | "B" | "C" | "D" | "E";
export const TIERS: Tier[] = ["S", "A", "B", "C", "D", "E"];

// Cortes de tier por SCORE, um jogo por pool. Sao fixos: calibrados uma vez sobre a
// distribuicao real do catalogo e escritos aqui como numero, nao recalculados por tela.
// A diferenca pro corte por posicao (top 10% = S) aparece no patch: se o jogo buffar
// trinta especies, elas SOBEM de tier — no corte por posicao alguem teria que descer pra
// abrir vaga, porque a fila tem tamanho fixo.
//
// Sao dois jogos porque a forma da distribuicao muda com o pool: com TM ela e bimodal
// (o golpe de poder 600 abre um vale entre basico e evolucao final), sem TM ela e um
// morro so. O tier sempre responde "entre o que EU posso usar, quem presta?".
const TIER_CUTS: Record<MovePool, [Tier, number][]> = {
  natural: [["S", 66], ["A", 52], ["B", 45], ["C", 39], ["D", 31], ["E", -1]],
  tm: [["S", 74], ["A", 65], ["B", 44], ["C", 35], ["D", 27], ["E", -1]],
};

/** Cor do tier — escada quente->fria, mesma leitura do resto do site. */
export const TIER_COLOR: Record<Tier, string> = {
  S: "var(--yellow)", A: "var(--green)", B: "var(--cyan)",
  C: "var(--blue)", D: "var(--purple)", E: "var(--text-dim)",
};

export const tierOf = (score: number, pool: MovePool = "natural"): Tier =>
  (TIER_CUTS[pool].find(([, min]) => score >= min) ?? ["E", -1])[0] as Tier;

/** Score minimo de cada tier no pool — a tela usa pra mostrar a regua do corte. */
export const tierFloor = (tier: Tier, pool: MovePool): number =>
  TIER_CUTS[pool].find(([t]) => t === tier)?.[1] ?? 0;

// ---------------------------------------------------------------- pool de golpes

export const isTm = (a: Attack): boolean => a.tm != null;
export const inPool = (a: Attack, pool: MovePool): boolean => pool === "tm" || !isTm(a);

/** Golpe que causa dano (STATUS nao entra no calculo ofensivo). */
export const isOffensive = (a: Attack): boolean =>
  a.power > 0 && a.cooldownMs > 0 && (a.category === "PHYSICAL" || a.category === "SPECIAL");

/** Stat base que o golpe usa: Atk pro fisico, Sp.Atk pro especial. */
export const offStatOf = (c: Creature, a: Attack): number =>
  a.category === "SPECIAL" ? c.baseSpAtk : c.baseAtk;

export const hasStab = (c: Creature, a: Attack): boolean =>
  a.type === c.type1 || a.type === c.type2;

// ---------------------------------------------------------------- eixos do score

/** DPS neutro de UM golpe: dano por segundo contra um defensor generico, ja com STAB.
 *  Sem alvo, a defesa do outro lado e constante e nao muda ordem nenhuma — por isso ela
 *  fica de fora aqui e volta no matchup (dpsAgainst). */
export function moveDps(c: Creature, a: Attack): number {
  if (!isOffensive(a)) return 0;
  const stab = hasStab(c, a) ? 1.5 : 1;
  return (a.power * offStatOf(c, a) * stab) / (a.cooldownMs / 1000);
}

export interface ScoredMove {
  attack: Attack;
  dps: number;
  stab: boolean;
  tm: boolean;
}

/** Golpes ofensivos do pool, do maior DPS pro menor. */
export function scoredMoves(c: Creature, pool: MovePool): ScoredMove[] {
  return c.attacks
    .filter((a) => isOffensive(a) && inPool(a, pool))
    .map((a) => ({ attack: a, dps: moveDps(c, a), stab: hasStab(c, a), tm: isTm(a) }))
    .sort((x, y) => y.dps - x.dps || y.attack.power - x.attack.power || x.attack.learnLevel - y.attack.learnLevel);
}

/** O golpe que define a velocidade de kill da especie. */
export const bestMove = (c: Creature, pool: MovePool): ScoredMove | null =>
  scoredMoves(c, pool)[0] ?? null;

/** HP efetivo: quanto de dano a especie absorve antes de cair, na media dos dois lados
 *  (fisico e especial). E um PRODUTO — e por isso que somar hp+def esconde o tanque. */
export const effectiveHp = (c: Creature): number =>
  c.baseHp * ((c.baseDef + c.baseSpDef) / 2);

/** Bulk so contra um lado, pra quando a pergunta e "ele aguenta golpe fisico?". */
export const effectiveHpVs = (c: Creature, side: "physical" | "special"): number =>
  c.baseHp * (side === "physical" ? c.baseDef : c.baseSpDef);

// DPS e HP efetivo sao ambos PRODUTO de dois stats, entao crescem quadraticamente e a
// distribuicao fica com cauda longa. A raiz devolve os dois pra escala linear de stat,
// que e onde a normalizacao se comporta e o score fica legivel.
const lin = (x: number): number => Math.sqrt(Math.max(0, x));

// ---------------------------------------------------------------- catalogo e ranking

/** Conjunto jogavel: tira as variantes de skin (Brave Blastoise e companhia apontam pra
 *  base com `captureBase` e nao sao uma linha propria do catalogo) e mantem Orre, que tem
 *  stats proprios. Sem isso a mesma especie aparece 2x na tier list. */
export const playableSet = (creatures: Creature[]): Creature[] =>
  creatures.filter((c) => c.captureBase == null || c.area === "orre");

export interface MetaEntry {
  creature: Creature;
  /** Nota 0..100 combinando ataque e resistencia. */
  score: number;
  tier: Tier;
  position: number;
  /** Quanto do topo do catalogo esse pokemon alcanca em cada eixo (0..1). */
  offense: number;
  bulk: number;
  /** Numeros crus por tras dos eixos. */
  dps: number;
  ehp: number;
  best: ScoredMove | null;
  /** Power do jogo: soma dos 6 stats base (a Quality do individuo entra depois). */
  basePower: number;
}

/** Tier list completa do conjunto jogavel, no pool pedido.
 *  Cada eixo e normalizado pelo MAIOR do catalogo — assim "100 de ataque" quer dizer
 *  "o melhor golpe do jogo", uma referencia que nao muda quando o filtro da tela muda. */
export function metaTable(creatures: Creature[], pool: MovePool = "natural"): MetaEntry[] {
  const set = playableSet(creatures);
  const raw = set.map((c) => {
    const best = bestMove(c, pool);
    const dps = best?.dps ?? 0;
    const ehp = effectiveHp(c);
    return { creature: c, best, dps, ehp, o: lin(dps), b: lin(ehp) };
  });
  const maxO = Math.max(1, ...raw.map((r) => r.o));
  const maxB = Math.max(1, ...raw.map((r) => r.b));

  return raw
    .map((r) => {
      const offense = r.o / maxO;
      const bulk = r.b / maxB;
      const score = Math.round((W_OFFENSE * offense + W_BULK * bulk) * 1000) / 10;
      const c = r.creature;
      return {
        creature: c,
        score,
        tier: tierOf(score, pool),
        position: 0,
        offense,
        bulk,
        dps: r.dps,
        ehp: r.ehp,
        best: r.best,
        basePower: c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed,
      };
    })
    .sort((a, b) => b.score - a.score || b.offense - a.offense || a.creature.name.localeCompare(b.creature.name))
    .map((e, i) => ({ ...e, position: i + 1 }));
}

// ---------------------------------------------------------------- matchup

/** Efetividade JA amplificada pelo reforco de hunt (x2 vira x2.5) — a mesma que o
 *  Hunt Planner mostra, pra o site inteiro falar de efetividade do mesmo jeito. */
export const effOf = (atk: PokeType, target: Creature): number =>
  amplify(effectiveness(atk, target.type1, target.type2));

export interface Matchup {
  attacker: Creature;
  defender: Creature;
  move: Attack | null;
  /** Efetividade amplificada do melhor golpe contra este alvo. */
  eff: number;
  /** DPS contra ESTE alvo: ja divide pela defesa dele e aplica a efetividade. */
  dps: number;
  /** Segundos pra derrubar o alvo (HP de hunt, x5). Infinity = nao machuca. */
  ttk: number;
}

/** DPS de um golpe contra um alvo concreto: entra a defesa do alvo e a efetividade. */
function dpsAgainst(atk: Creature, a: Attack, def: Creature): number {
  const base = moveDps(atk, a);
  if (base <= 0) return 0;
  const eff = effOf(a.type, def);
  if (eff <= 0) return 0;
  const wall = a.category === "SPECIAL" ? def.baseSpDef : def.baseDef;
  return (base * eff) / Math.max(1, wall);
}

// HP de wild na hunt e x5 (doc do jogo). Como os dois lados usam a mesma escala, isso so
// muda a unidade do ttk — mas mantem o numero comparavel ao do Hunt Planner.
const HUNT_HP_MULT = 5;

/** Melhor golpe do atacante contra o defensor, e quanto ele demora pra derrubar. */
export function matchup(attacker: Creature, defender: Creature, pool: MovePool = "natural"): Matchup {
  let best: { a: Attack; dps: number } | null = null;
  for (const a of attacker.attacks) {
    if (!isOffensive(a) || !inPool(a, pool)) continue;
    const d = dpsAgainst(attacker, a, defender);
    if (d > 0 && (!best || d > best.dps)) best = { a, dps: d };
  }
  const hp = defender.baseHp * HUNT_HP_MULT;
  return {
    attacker,
    defender,
    move: best?.a ?? null,
    eff: best ? effOf(best.a.type, defender) : 0,
    dps: best?.dps ?? 0,
    ttk: best ? hp / best.dps : Infinity,
  };
}

export interface Duel {
  other: Creature;
  /** Meu golpe contra ele e o dele contra mim. */
  mine: Matchup;
  theirs: Matchup;
  /** >1 = eu derrubo ele antes de ele me derrubar. E a razao dos tempos de kill. */
  edge: number;
}

/** Duelo entre duas especies, medindo OS DOIS LADOS.
 *  O piwtools decide nemesis so por "tem golpe super efetivo contra voce" — o que promove
 *  qualquer pokemon fraco com o tipo certo. Aqui quem ganha e quem derruba primeiro. */
export function duel(mine: Creature, other: Creature, pool: MovePool = "natural"): Duel {
  const a = matchup(mine, other, pool);
  // O outro lado e sempre natural: o wild nao compra TM (mesma regra do combat.ts).
  const b = matchup(other, mine, "natural");
  const edge = b.ttk === Infinity ? Infinity : a.ttk === Infinity ? 0 : b.ttk / a.ttk;
  return { other, mine: a, theirs: b, edge };
}

/** Quem te derruba primeiro — as ameacas reais, ordenadas pela vantagem DELES.
 *  So entra quem realmente ganha de voce (edge < 1). */
export function nemeses(c: Creature, creatures: Creature[], n = 6, pool: MovePool = "natural"): Duel[] {
  return playableSet(creatures)
    .filter((o) => o.pokeId !== c.pokeId)
    .map((o) => duel(c, o, pool))
    .filter((d) => d.edge < 1 && Number.isFinite(d.theirs.ttk))
    .sort((x, y) => x.edge - y.edge)
    .slice(0, n);
}

/** Suas presas: quem voce derruba com folga e sem tomar de volta. */
export function preys(c: Creature, creatures: Creature[], n = 6, pool: MovePool = "natural"): Duel[] {
  return playableSet(creatures)
    .filter((o) => o.pokeId !== c.pokeId)
    .map((o) => duel(c, o, pool))
    .filter((d) => d.mine.eff > 1 && Number.isFinite(d.mine.ttk))
    .sort((x, y) => y.edge - x.edge)
    .slice(0, n);
}

// ---------------------------------------------------------------- perfil de stats

export const STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "speed"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const statOf = (c: Creature, k: StatKey): number =>
  k === "hp" ? c.baseHp : k === "atk" ? c.baseAtk : k === "def" ? c.baseDef
    : k === "spAtk" ? c.baseSpAtk : k === "spDef" ? c.baseSpDef : c.baseSpeed;

export interface StatStanding {
  key: StatKey;
  value: number;
  /** 0..1 — fatia do catalogo que este pokemon supera neste stat. */
  percentile: number;
  rank: number;
}

/** Onde cada stat base do pokemon cai dentro do catalogo jogavel. */
export function statStandings(c: Creature, creatures: Creature[]): Record<StatKey, StatStanding> {
  const set = playableSet(creatures);
  const out = {} as Record<StatKey, StatStanding>;
  for (const k of STAT_KEYS) {
    const values = set.map((x) => statOf(x, k)).sort((a, b) => b - a);
    const v = statOf(c, k);
    const rank = values.findIndex((x) => x <= v) + 1 || values.length;
    const below = values.filter((x) => x < v).length;
    out[k] = { key: k, value: v, rank, percentile: set.length <= 1 ? 1 : below / (set.length - 1) };
  }
  return out;
}

/** Papel que os stats sugerem. Chaves de i18n em `meta.role.*`. */
export type Role =
  | "glassCannon" | "sweeper" | "physicalAttacker" | "specialAttacker" | "mixedAttacker"
  | "bulkyAttacker" | "wall" | "physicalWall" | "specialWall" | "balanced" | "filler";

/** Le os percentis e da um nome ao formato. A ordem dos testes importa: do perfil mais
 *  especifico pro mais generico, senao tudo vira "equilibrado". */
export function roleOf(st: Record<StatKey, StatStanding>): Role {
  const atk = st.atk.percentile, spa = st.spAtk.percentile;
  const off = Math.max(atk, spa);
  const gap = Math.abs(atk - spa);
  const hp = st.hp.percentile, def = st.def.percentile, spd = st.spDef.percentile;
  const bulk = (hp + def + spd) / 3;
  const speed = st.speed.percentile;

  if (off >= 0.85 && bulk <= 0.35) return "glassCannon";
  if (off >= 0.8 && bulk >= 0.65) return "bulkyAttacker";
  if (off >= 0.8 && speed >= 0.8) return "sweeper";
  if (bulk >= 0.8 && off <= 0.45) {
    if (def >= spd + 0.15) return "physicalWall";
    if (spd >= def + 0.15) return "specialWall";
    return "wall";
  }
  if (off >= 0.65 && gap <= 0.12) return "mixedAttacker";
  if (spa >= 0.65 && spa >= atk + 0.1) return "specialAttacker";
  if (atk >= 0.65 && atk >= spa + 0.1) return "physicalAttacker";
  if (off >= 0.45 || bulk >= 0.45) return "balanced";
  return "filler";
}

// ---------------------------------------------------------------- analise por tipo

export interface TypeStanding {
  type: PokeType;
  /** Melhor DPS que o catalogo entrega com golpe DESTE tipo. */
  bestDps: number;
  bestUser: Creature | null;
  bestMove: Attack | null;
  /** Quantas especies jogaveis carregam golpe do tipo. */
  users: number;
  /** Quantas especies jogaveis SAO do tipo. */
  species: number;
}

/** Panorama ofensivo de cada tipo: quem bate mais forte com ele e quanta gente o tem. */
export function typeStandings(creatures: Creature[], pool: MovePool = "natural"): Map<PokeType, TypeStanding> {
  const set = playableSet(creatures);
  const out = new Map<PokeType, TypeStanding>();
  const bump = (t: PokeType) => {
    let s = out.get(t);
    if (!s) { s = { type: t, bestDps: 0, bestUser: null, bestMove: null, users: 0, species: 0 }; out.set(t, s); }
    return s;
  };
  for (const c of set) {
    bump(c.type1).species++;
    if (c.type2) bump(c.type2).species++;
    const seen = new Set<PokeType>();
    for (const a of c.attacks) {
      if (!isOffensive(a) || !inPool(a, pool)) continue;
      const s = bump(a.type);
      if (!seen.has(a.type)) { s.users++; seen.add(a.type); }
      const d = moveDps(c, a);
      if (d > s.bestDps) { s.bestDps = d; s.bestUser = c; s.bestMove = a; }
    }
  }
  return out;
}
