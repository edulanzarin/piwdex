// Motor da rota de hunt. Efetividade de tipo e a amplificacao de hunt sao do jogo
// (doc Combat); XP e ouro por kill idem. O dano-por-hit e os "hits pra derrubar" sao
// ESTIMATIVA (o jogo nao publica a formula de dano) — servidos sempre rotulados.
// A velocidade de ataque (cooldown -> intervalo via speed/haste) o jogo tambem nao
// publica, entao NAO cravamos KOs/h absoluto: como o golpe e fixo, o tempo de kill e
// proporcional aos hits, e xp/hits (ou ouro/hits) ordena "mais rapido" de forma justa.

import { projectStat } from "./stats";
import { effectiveness } from "./typing";
import type { PokeType } from "./types";

export const SIM_IV = 21;
const SAFE = 0.85; // enemyPower <= yourPower*SAFE -> seguro
const POWER_CEIL = 1.15; // nunca sugere alvo com Power acima de yourPower*isto
// Calibracao do dano estimado: ancorada pra um combate "no nivel" dar ~2 hits
// (bate com o Est. do PIW Tools). E fator de estimativa, nao formula do jogo.
const DMG_CAL = 0.35;

export type RouteMode = "xp" | "money";

/** Amplificacao elemental de hunt: vantagem (m-1)*1.5+1, resistencia m/1.5. */
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
  cat: "PHYSICAL" | "SPECIAL" | "STATUS";
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
  power: number; // Power no huntLevel
  effHp: number; // HP no huntLevel x5 (reforco de hunt)
  def: number;
  spDef: number;
}

export interface HuntPick {
  enemy: EnemyCombat;
  moveName: PokeType; // tipo do golpe principal usado
  eff: number;
  hits: number; // hits pra derrubar (estimativa)
  safe: "safe" | "risky";
}

interface PStats {
  atk: number;
  spAtk: number;
  power: number;
}

/** Golpe principal do pokemon: o de MAIOR nivel de aprendizado disponivel (desempate
 *  por poder). E o que o jogo/PIW usa — pro Electrode da Electric Storm, nao um golpe
 *  antigo nem um de cobertura pontual. Ignora golpes de status (poder 0). */
export function mainMove(stage: Species, level: number): Move | null {
  let best: Move | null = null;
  for (const mv of stage.moves) {
    if (mv.power <= 0 || mv.learn > level) continue;
    if (!best || mv.learn > best.learn || (mv.learn === best.learn && mv.power > best.power)) best = mv;
  }
  return best;
}

function pstatsAt(bases: number[], level: number, quality: number, ivs: number[]): PStats {
  const s = bases.map((b, i) => projectStat(b, ivs[i], level, quality, i));
  return { atk: s[1], spAtk: s[3], power: s.reduce((a, b) => a + b, 0) * quality };
}

/** Dano por hit — formula classica adaptada (ESTIMATIVA). eff ja amplificado. */
function hitDamage(level: number, power: number, atk: number, def: number, eff: number, stab: number): number {
  if (power <= 0 || eff <= 0) return 0;
  const base = ((2 * level) / 5 + 2) * power * (atk / Math.max(1, def)) / 50 + 2;
  return Math.max(1, base * eff * stab * DMG_CAL);
}

/** Melhor hunt pro nivel: dentro da janela de nivel e do teto de Power, a de maior
 *  score do modo (xp/hits pra upar, ouro/hits pra grana). */
function pickHunt(
  stage: Species,
  level: number,
  ps: PStats,
  move: Move,
  enemies: EnemyCombat[],
  mode: RouteMode,
): HuntPick | null {
  const windows: [number, number][] = [
    [level - 40, level + 20],
    [level - 80, level + 40],
    [0, level + 80],
    [0, Infinity],
  ];
  for (const [lo, hi] of windows) {
    let best: { score: number; pick: HuntPick } | null = null;
    for (const e of enemies) {
      if (e.huntLevel < lo || e.huntLevel > hi) continue;
      if (e.power > ps.power * POWER_CEIL) continue;
      const eff = huntEffectiveness(move.type, e.t1, e.t2);
      if (eff <= 0) continue;
      const atk = move.cat === "PHYSICAL" ? ps.atk : ps.spAtk;
      const def = move.cat === "PHYSICAL" ? e.def : e.spDef;
      const stab = move.type === stage.t1 || move.type === stage.t2 ? 1.5 : 1;
      const dmg = hitDamage(level, move.power, atk, def, eff, stab);
      // tempo de kill CONTINUO (nao arredonda) — assim a efetividade ainda pesa mesmo
      // quando voce da overkill (1 hit). O display arredonda pra cima.
      const killTime = e.effHp / dmg;
      const hits = Math.max(1, Math.ceil(killTime));
      const score = (mode === "money" ? e.goldEV : e.xp) / killTime;
      if (!best || score > best.score) {
        best = { score, pick: { enemy: e, moveName: move.type, eff, hits, safe: e.power <= ps.power * SAFE ? "safe" : "risky" } };
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
  mode: RouteMode,
): RouteStep[] {
  const steps: RouteStep[] = [];
  const s = Math.max(1, Math.floor(start));
  const t = Math.max(s + 1, Math.floor(target));

  for (let lvl = s; lvl <= t; lvl++) {
    const stage = activeStage(chain, lvl);
    const move = mainMove(stage, lvl);
    if (!move) continue;
    const ps = pstatsAt(stage.bases, lvl, quality, ivs);
    const pick = pickHunt(stage, lvl, ps, move, enemies, mode);
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
