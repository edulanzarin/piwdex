// Motor da rota de hunt do Poke Idle World.
//
// Fundamentado nos sistemas publicos do jogo (pokepedia/systems):
//  - Combate na hunt: HP do wild x5, dano x1.8/hit, vantagem elemental +50% (ambos os
//    lados). A amplificacao elemental esta em amplify().
//  - Evolucao reseta pro Lv.1 (ou mantem o nivel com Evolution Stones) e NAO re-rola
//    IV/Quality. Ou seja: o pokemon que voce escolhe E o pokemon — a rota nao "volta"
//    pra forma anterior. Por isso a rota usa a especie escolhida em todos os niveis.
//  - Stats: stat = round((base + 2*IV) * nivel/100 * Quality^exp). XP/kill fixo por especie.
//
// O jogo NAO publica a formula de dano nem a de captura. Entao KOs/h, XP/h e ouro/h sao
// ESTIMATIVA: modelamos a velocidade de kill por dano-por-segundo (poder do golpe x razao
// de stats x STAB x efetividade) contra o HP reforcado, mais um overhead fixo por kill.
// As constantes (DMG_K, OVERHEAD_S) sao calibradas pra bater a ordem de grandeza do jogo;
// servem pra COMPARAR hunts, nao como numero exato. A ordenacao e robusta a elas.

import { projectStat } from "./stats";
import { effectiveness } from "./typing";
import type { AttackCategory, PokeType } from "./types";

export const SIM_IV = 21;

// Reforco de hunt + calibracao do modelo de kill-speed.
export const WILD_HP_MULT = 5; // HP do wild x5 (doc do jogo)
const WILD_Q = 1.0; // qualidade base do wild (capturas ~common)
const WILD_IV = 15;
const DMG_K = 0.06; // constante de calibracao do dano estimado
const OVERHEAD_S = 5; // segundos fixos por kill (spawn/aproximacao/animacao), estimativa

/** Amplificacao elemental de hunt: vantagem (m-1)*1.5+1, resistencia m/1.5.
 *  Confere com a doc: x1.5->x1.75, x2->x2.5, x4->x5.5, x0.5->x0.33. */
export function amplify(m: number): number {
  if (m === 0 || m === 1) return m;
  if (m > 1) return (m - 1) * 1.5 + 1;
  return m / 1.5;
}
export function huntEffectiveness(atk: PokeType, d1: PokeType, d2: PokeType | null): number {
  return amplify(effectiveness(atk, d1, d2));
}

export interface Move {
  type: PokeType;
  power: number;
  learn: number;
  category: AttackCategory;
  cooldownMs: number;
}

export interface Species {
  pokeId: number;
  name: string;
  t1: PokeType;
  t2: PokeType | null;
  bases: number[]; // hp, atk, def, spAtk, spDef, speed
  evolvesToId: number | null;
  evolveLevel: number | null;
  moves: Move[];
}

export interface EnemyCombat {
  pokeId: number;
  name: string;
  t1: PokeType;
  t2: PokeType | null;
  huntLevel: number;
  areas: string[];
  spotCount: number;
  xp: number;
  goldEV: number;
  hp: number; // HP reforcado no huntLevel (ja x5), baseline de wild
  def: number; // Def no huntLevel (baseline)
  spDef: number; // Sp.Def no huntLevel (baseline)
}

export interface KillEstimate {
  moveName: PokeType; // tipo do golpe de maior DPS
  category: AttackCategory;
  eff: number; // efetividade amplificada desse golpe
  hits: number; // hits pra derrubar (estimativa)
  kosH: number; // KOs/h estimado
  xpH: number; // XP/h estimado (com VIP se ligado)
  goldH: number; // ouro/h estimado (loot)
}

// Golpe de maior DANO-POR-SEGUNDO contra o alvo (poder x razao de stats x STAB x eff,
// dividido pelo cooldown). E o que decide a velocidade de kill.
function bestMoveDps(species: Species, level: number, ivs: number[], quality: number, e: EnemyCombat) {
  const atk = projectStat(species.bases[1], ivs[1], level, quality, 1);
  const spa = projectStat(species.bases[3], ivs[3], level, quality, 3);
  let best: { mv: Move; eff: number; dmg: number; dps: number } | null = null;
  for (const mv of species.moves) {
    if (mv.power <= 0 || mv.learn > level || mv.cooldownMs <= 0) continue;
    const eff = huntEffectiveness(mv.type, e.t1, e.t2);
    if (eff <= 0) continue; // imune
    const stab = mv.type === species.t1 || mv.type === species.t2 ? 1.5 : 1;
    const off = mv.category === "SPECIAL" ? spa : atk;
    const def = mv.category === "SPECIAL" ? e.spDef : e.def;
    const dmg = Math.max(1, DMG_K * mv.power * (off / Math.max(1, def)) * stab * eff);
    const dps = dmg / (mv.cooldownMs / 1000);
    if (!best || dps > best.dps) best = { mv, eff, dmg, dps };
  }
  return best;
}

/** Estimativa de rendimento contra um alvo: velocidade de kill -> KOs/h, XP/h, ouro/h. */
export function killEstimate(
  species: Species,
  level: number,
  ivs: number[],
  quality: number,
  e: EnemyCombat,
  vip: boolean,
): KillEstimate | null {
  const bm = bestMoveDps(species, level, ivs, quality, e);
  if (!bm) return null;
  const hits = Math.max(1, Math.ceil(e.hp / bm.dmg));
  const timePerKill = e.hp / bm.dps + OVERHEAD_S;
  const kosH = 3600 / timePerKill;
  return {
    moveName: bm.mv.type,
    category: bm.mv.category,
    eff: bm.eff,
    hits,
    kosH,
    xpH: e.xp * kosH * (vip ? 1.5 : 1),
    goldH: e.goldEV * kosH,
  };
}

/** Stats de combate do wild no huntLevel (baseline de captura). HP ja reforcado (x5). */
export function enemyCombatStats(bases: number[], huntLevel: number): { hp: number; def: number; spDef: number } {
  return {
    hp: projectStat(bases[0], WILD_IV, huntLevel, WILD_Q, 0) * WILD_HP_MULT,
    def: projectStat(bases[2], WILD_IV, huntLevel, WILD_Q, 2),
    spDef: projectStat(bases[4], WILD_IV, huntLevel, WILD_Q, 4),
  };
}

export type RouteMode = "xp" | "gold";

// Alcance de nivel: voce caca em torno do seu nivel (sem limite pra baixo, margem pra
// cima). Impede rota mandar um lvl 48 pra uma hunt lvl 150, e deixa alvos super-efetivos
// um pouco acima ao alcance. Acima disso o wild fica tanky demais (kill-speed ja pune).
export const reachOf = (level: number): number => level + Math.max(8, level * 0.15);

export interface RoutePick {
  score: number;
  enemy: EnemyCombat;
  est: KillEstimate;
}

function pickHunt(
  species: Species,
  level: number,
  ivs: number[],
  quality: number,
  enemies: EnemyCombat[],
  mode: RouteMode,
  vip: boolean,
): RoutePick | null {
  const reach = reachOf(level);
  let best: RoutePick | null = null;
  for (const e of enemies) {
    if (e.huntLevel > reach) continue;
    const est = killEstimate(species, level, ivs, quality, e, vip);
    if (!est) continue;
    const score = mode === "gold" ? est.goldH : est.xpH;
    if (!best || score > best.score) best = { score, enemy: e, est };
  }
  return best;
}

export interface RouteStep {
  from: number;
  to: number;
  enemy: EnemyCombat;
  est: KillEstimate;
}

/** Rota do nivel `start` ao `target` com a especie ESCOLHIDA (sem evoluir/voltar).
 *  Em cada nivel pega a hunt de maior XP/h (ou ouro/h) dentro do alcance; so troca de
 *  hunt quando a nova ganha da atual por margem (>8%), pra as faixas ficarem limpas. */
export function buildRoute(
  species: Species,
  start: number,
  target: number,
  enemies: EnemyCombat[],
  quality: number,
  ivs: number[],
  mode: RouteMode = "xp",
  vip = false,
): RouteStep[] {
  const steps: RouteStep[] = [];
  const s = Math.max(1, Math.floor(start));
  const t = Math.max(s + 1, Math.floor(target));
  const SWITCH_MARGIN = 1.08;

  for (let lvl = s; lvl <= t; lvl++) {
    const p = pickHunt(species, lvl, ivs, quality, enemies, mode, vip);
    if (!p) continue;
    const last = steps[steps.length - 1];
    if (last) {
      // rendimento do alvo ATUAL neste nivel — so troca se o novo ganha por margem.
      const curEst = killEstimate(species, lvl, ivs, quality, last.enemy, vip);
      const curScore = curEst ? (mode === "gold" ? curEst.goldH : curEst.xpH) : 0;
      if (curEst && p.score <= curScore * SWITCH_MARGIN) {
        last.to = lvl;
        last.est = curEst; // atualiza o rendimento pro nivel corrente da faixa
        continue;
      }
    }
    steps.push({ from: lvl, to: lvl, enemy: p.enemy, est: p.est });
  }
  return steps;
}
