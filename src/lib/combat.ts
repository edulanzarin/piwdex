// Motor da rota de hunt. Usa SO dados reais do jogo: efetividade de tipo (com a
// amplificacao de hunt da doc Combat), XP e ouro por kill, e o Power (soma dos stats
// x qualidade) pra saber o que voce encara. O jogo NAO publica a formula de dano nem
// a de velocidade de ataque, entao NAO estimamos hits/KOs-h — seria numero inventado
// (e enganoso: nao bate com o jogo real). A ordenacao usa XP x efetividade, que sao
// os dois sinais reais de "quanto XP mais rapido".

import { projectAll } from "./stats";
import { effectiveness } from "./typing";
import type { PokeType } from "./types";

export const SIM_IV = 21;
const SAFE = 0.85; // enemyPower <= yourPower*SAFE -> seguro (senao arriscado)
const POWER_CEIL = 1.15; // nunca sugere alvo com Power acima de yourPower*isto

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
  power: number; // Power do alvo no huntLevel
}

export interface HuntPick {
  enemy: EnemyCombat;
  moveName: PokeType; // tipo do golpe principal usado
  eff: number; // efetividade amplificada (real)
  safe: "safe" | "risky"; // pela comparacao de Power
}

/** Golpe principal do pokemon: o de MAIOR nivel de aprendizado disponivel (desempate
 *  por poder). E o que o jogo/PIW usa — pro Electrode da Electric Storm (raio). */
export function mainMove(stage: Species, level: number): Move | null {
  let best: Move | null = null;
  for (const mv of stage.moves) {
    if (mv.power <= 0 || mv.learn > level) continue;
    if (!best || mv.learn > best.learn || (mv.learn === best.learn && mv.power > best.power)) best = mv;
  }
  return best;
}

/** Melhor hunt pro nivel: entre os alvos que voce ENCARA (Power) e na janela de nivel,
 *  a de maior XP x efetividade. Empate desempata por OURO x efetividade (prioriza upar,
 *  mas entre iguais pega a que da mais dinheiro). */
function pickHunt(stage: Species, level: number, yourPower: number, enemies: EnemyCombat[]): HuntPick | null {
  const move = mainMove(stage, level);
  if (!move) return null;
  const windows: [number, number][] = [
    [level - 40, level + 20],
    [level - 80, level + 40],
    [0, level + 80],
    [0, Infinity],
  ];
  for (const [lo, hi] of windows) {
    let best: { primary: number; secondary: number; pick: HuntPick } | null = null;
    for (const e of enemies) {
      if (e.huntLevel < lo || e.huntLevel > hi) continue;
      if (e.power > yourPower * POWER_CEIL) continue;
      const eff = huntEffectiveness(move.type, e.t1, e.t2);
      if (eff <= 0) continue;
      const primary = e.xp * eff; // proxy de XP por tempo (efetividade = menos hits no jogo)
      const secondary = e.goldEV * eff;
      const better = !best || primary > best.primary * 1.0001 || (Math.abs(primary - best.primary) <= best.primary * 1e-4 && secondary > best.secondary);
      if (better) {
        best = { primary, secondary, pick: { enemy: e, moveName: move.type, eff, safe: e.power <= yourPower * SAFE ? "safe" : "risky" } };
      }
    }
    if (best) return best.pick;
  }
  return null;
}

export function activeStage(chain: Species[], level: number): Species {
  let cur = chain[0];
  for (const s of chain) {
    if (s.evolveLevel == null || s.evolveLevel <= level) cur = s;
    else break;
  }
  return cur;
}

export function buildChain(byId: Map<number, Species>, picked: Species): Species[] {
  let base = picked;
  const guard = new Set<number>();
  for (;;) {
    if (guard.has(base.pokeId)) break;
    guard.add(base.pokeId);
    let prev: Species | undefined;
    for (const s of byId.values()) if (s.evolvesToId === base.pokeId) { prev = s; break; }
    if (!prev) break;
    base = prev;
  }
  const chain: Species[] = [base];
  const seen = new Set<number>([base.pokeId]);
  let cur = base;
  while (cur.evolvesToId != null) {
    const next = byId.get(cur.evolvesToId);
    if (!next || seen.has(next.pokeId)) break;
    chain.push(next);
    seen.add(next.pokeId);
    cur = next;
  }
  return chain;
}

export interface RouteStep {
  from: number;
  to: number;
  stageId: number;
  stageName: string;
  pick: HuntPick;
}

export function buildRoute(
  chain: Species[],
  start: number,
  target: number,
  enemies: EnemyCombat[],
  quality: number,
  ivs: number[],
): RouteStep[] {
  const steps: RouteStep[] = [];
  const s = Math.max(1, Math.floor(start));
  const t = Math.max(s + 1, Math.floor(target));

  for (let lvl = s; lvl <= t; lvl++) {
    const stage = activeStage(chain, lvl);
    const yourPower = projectAll(stage.bases, ivs, lvl, quality).power;
    const pick = pickHunt(stage, lvl, yourPower, enemies);
    if (!pick) continue;

    const last = steps[steps.length - 1];
    if (last && last.stageId === stage.pokeId && last.pick.enemy.pokeId === pick.enemy.pokeId) {
      last.to = lvl;
    } else {
      steps.push({ from: lvl, to: lvl, stageId: stage.pokeId, stageName: stage.name, pick });
    }
  }
  return steps;
}
