// Rota de hunt. Usa SO o que e exato: efetividade de tipo (com a amplificacao de
// hunt que a doc Combat publica) + XP e ouro por kill (dados do jogo). O jogo NAO
// publica a formula de dano nem a de velocidade de ataque (cooldown vira intervalo
// via speed/haste, sem doc), entao NAO estimamos KOs/h aqui — seria numero
// inventado. O rendimento por hora vem do kills/min que o jogador informa.

import { effectiveness } from "./typing";
import { projectAll } from "./stats";
import type { PokeType } from "./types";

// IV de simulacao quando o jogador nao informa stats (mesmo padrao do PIW Tools).
export const SIM_IV = 21;
const SAFE = 0.85; // enemyPower <= yourPower * SAFE -> seguro (senao arriscado)
const POWER_CEIL = 1.15; // nunca sugere alvo com Power acima de yourPower * isto

/** Amplificacao elemental de hunt: vantagem (m-1)*1.5+1, resistencia m/1.5.
 *  Confere com a doc: x1.5->x1.75, x2->x2.5, x4->x5.5, x0.5->x0.33. Neutro/imune iguais. */
export function amplify(m: number): number {
  if (m === 0 || m === 1) return m;
  if (m > 1) return (m - 1) * 1.5 + 1;
  return m / 1.5;
}

/** Efetividade de um golpe contra o defensor, ja amplificada pelo reforco de hunt. */
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

// Inimigo (um pokemon com ponto de hunt). Sem stats de combate — a rota nao simula
// dano; usa nivel + tipos + XP/ouro por kill, tudo do jogo.
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
  power: number; // Power do alvo no huntLevel (soma dos stats) — metrica real do jogo
}

export interface HuntPick {
  enemy: EnemyCombat;
  moveType: PokeType; // seu melhor golpe contra ele
  eff: number; // efetividade amplificada
  safe: "safe" | "risky"; // pela comparacao de Power (nao por simulacao de dano)
}

/** Melhor golpe do stage contra um inimigo: maior efetividade (desempate por poder).
 *  null se todo golpe util e imune (efetividade 0). */
function bestMoveType(stage: Species, level: number, enemy: EnemyCombat): { type: PokeType; eff: number } | null {
  let best: { type: PokeType; eff: number; power: number } | null = null;
  for (const mv of stage.moves) {
    if (mv.power <= 0 || mv.learn > level) continue;
    const eff = huntEffectiveness(mv.type, enemy.t1, enemy.t2);
    if (eff <= 0) continue;
    if (!best || eff > best.eff || (eff === best.eff && mv.power > best.power)) {
      best = { type: mv.type, eff, power: mv.power };
    }
  }
  return best ? { type: best.type, eff: best.eff } : null;
}

/** Escolhe a melhor hunt: dentro de uma janela de nivel apropriada (alvo ~ perto do
 *  seu nivel, subindo conforme voce cresce) e que voce ENCARA (teto de Power), a de
 *  maior XP ponderado pela sua efetividade. Afrouxa a janela se nao achar nada. */
export function pickHunt(stage: Species, level: number, yourPower: number, enemies: EnemyCombat[]): HuntPick | null {
  const windows: [number, number][] = [
    [level - 40, level + 15],
    [level - 80, level + 30],
    [0, level + 60],
    [0, Infinity],
  ];
  for (const [lo, hi] of windows) {
    let best: { score: number; pick: HuntPick } | null = null;
    for (const e of enemies) {
      if (e.huntLevel < lo || e.huntLevel > hi) continue;
      if (e.power > yourPower * POWER_CEIL) continue; // nunca sugere algo que voce nao aguenta
      const mv = bestMoveType(stage, level, e);
      if (!mv) continue;
      const score = e.xp * Math.max(mv.eff, 0.5);
      if (!best || score > best.score) {
        best = {
          score,
          pick: { enemy: e, moveType: mv.type, eff: mv.eff, safe: e.power <= yourPower * SAFE ? "safe" : "risky" },
        };
      }
    }
    if (best) return best.pick;
  }
  return null;
}

/** Stage de evolucao ativo num nivel: o mais avancado cujo evolveLevel ja passou. */
export function activeStage(chain: Species[], level: number): Species {
  let cur = chain[0];
  for (const s of chain) {
    if (s.evolveLevel == null || s.evolveLevel <= level) cur = s;
    else break;
  }
  return cur;
}

/** Monta a cadeia evolutiva ordenada (base -> final) a partir do pokemon escolhido. */
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

/** Gera a rota por faixa de nivel, trocando de evolucao conforme sobe. Junta niveis
 *  consecutivos que caem na mesma hunt numa faixa unica. ivs (6) e a qualidade dao o
 *  Power do jogador em cada nivel — usado pra decidir o que ele encara. */
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
