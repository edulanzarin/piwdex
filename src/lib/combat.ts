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

/** Golpe do pokemon com maior DANO EFETIVO contra um alvo especifico:
 *  poder * STAB (1.5 se o tipo do golpe e o do pokemon) * efetividade amplificada.
 *  E o que o jogo faz — usa o soco de Luta no Tyranitar (super efetivo), nao um golpe
 *  Normal so por ter nivel de aprendizado maior. Ignora golpes imunes (eff 0). */
export function bestMoveVs(stage: Species, level: number, e: EnemyCombat): { move: Move; eff: number } | null {
  let best: { move: Move; eff: number; dmg: number } | null = null;
  for (const mv of stage.moves) {
    if (mv.power <= 0 || mv.learn > level) continue;
    const eff = huntEffectiveness(mv.type, e.t1, e.t2);
    if (eff <= 0) continue; // golpe sem efeito nesse alvo (imune)
    const stab = mv.type === stage.t1 || mv.type === stage.t2 ? 1.5 : 1;
    const dmg = mv.power * stab * eff;
    if (!best || dmg > best.dmg) best = { move: mv, eff, dmg };
  }
  return best ? { move: best.move, eff: best.eff } : null;
}

/** Melhor hunt pro nivel: entre TODOS os alvos que voce encara (Power <= o seu * teto),
 *  a de maior XP x efetividade, usando o melhor golpe seu contra cada alvo. Sem janela de
 *  nivel — um alvo de nivel mais baixo em que voce e super efetivo (mata rapido) vale mais
 *  que um da sua faixa em que voce bate 1x. O Power ja limita o que e forte demais.
 *  Empate desempata por OURO x efetividade (prioriza upar, mas entre iguais pega mais $). */
function pickHunt(stage: Species, level: number, yourPower: number, enemies: EnemyCombat[], mode: "xp" | "gold" = "xp"): HuntPick | null {
  // Prefere alvos SEGUROS (Power <= o seu * SAFE); so cai pro arriscado (ate o teto) se
  // nao houver nenhum seguro — assim nao recomenda risco quando ha uma opcao tranquila.
  for (const cap of [yourPower * SAFE, yourPower * POWER_CEIL]) {
    let best: { primary: number; secondary: number; pick: HuntPick } | null = null;
    for (const e of enemies) {
      if (e.power > cap) continue;
      const bm = bestMoveVs(stage, level, e);
      if (!bm) continue;
      // mode "xp": rankeia por XP (desempata por ouro); "gold": o inverso.
      const primary = (mode === "gold" ? e.goldEV : e.xp) * bm.eff;
      const secondary = (mode === "gold" ? e.xp : e.goldEV) * bm.eff;
      const better = !best || primary > best.primary * 1.0001 || (Math.abs(primary - best.primary) <= best.primary * 1e-4 && secondary > best.secondary);
      if (better) {
        best = { primary, secondary, pick: { enemy: e, moveName: bm.move.type, eff: bm.eff, safe: e.power <= yourPower * SAFE ? "safe" : "risky" } };
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

export type RouteMode = "xp" | "gold";

export function buildRoute(
  chain: Species[],
  start: number,
  target: number,
  enemies: EnemyCombat[],
  quality: number,
  ivs: number[],
  mode: RouteMode = "xp",
): RouteStep[] {
  const steps: RouteStep[] = [];
  const s = Math.max(1, Math.floor(start));
  const t = Math.max(s + 1, Math.floor(target));

  for (let lvl = s; lvl <= t; lvl++) {
    const stage = activeStage(chain, lvl);
    const yourPower = projectAll(stage.bases, ivs, lvl, quality).power;
    const pick = pickHunt(stage, lvl, yourPower, enemies, mode);
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
