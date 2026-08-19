// Cerebro de hunt do robo (server-only). Reusa o motor de rota publico (combat.ts) pra:
//   - AUTO-HUNT: escolher a melhor hunt pro lider ATUAL no nivel atual (e re-escolher a
//     cada level-up, com a mesma margem de troca da rota, pra nao ficar pulando de hunt);
//   - LEVELING: montar o plano "do nivel X ao Y" (buildRoute) pra um pokemon escolhido e
//     dizer em que hunt ele deve estar em cada nivel.
// A conversao alvo->slug vem dos spots (locationsOf): o buildRoute pensa em ESPECIE-ALVO,
// o enter-hunt precisa do SLUG do spot.
//
// O motor ja recusa hunt que te MATA (ver combat.ts): o que sobe daqui e sempre o alvo de
// maior XP/h efetivo entre os que voce aguenta. `avoid` e a rede de seguranca por cima
// disso — o robo banha o alvo em que o bicho desmaiou de verdade (modelo errado > realidade).
//
// IVs: quando o jogo entrega os stats REAIS do pokemon (frame `pokes`), invertemos a
// formula por stat (estimateIvs) — e o unico jeito de o lado defensivo saber que o Abra
// tem 9 de HP. Sem stats, cai na media do ivTotal.

import {
  buildRoute, estimateHunt, pickHunt, enemyCombatStats, SIM_IV,
  type EnemyCombat, type Species, type Move, type RouteStep, type HuntEstimate, type MovesOf, type RiskLevel,
} from "@/lib/combat";
import { getData } from "@/lib/data";
import type { ActivePoke } from "@/lib/game-account";
import { estimateIvs } from "@/lib/stats";
import type { PokeType } from "@/lib/types";

export interface HuntTarget extends EnemyCombat {
  slug: string;        // spot pra enter-hunt (o de nivel mais proximo do huntLevel do alvo)
  huntName: string;
  area: string;
}

export interface BrainData {
  species: Map<number, Species>;
  targets: HuntTarget[];
  movesOf: MovesOf;                              // golpes do wild (o alvo nao os carrega)
  sellableLoot: (speciesId: number) => number[]; // itemIds com preco de NPC > 0 (drops vendaveis)
}

// Dados de combate derivados do piwdex.json (estatico) — memo de modulo, montado 1x por processo.
let brainData: Promise<BrainData> | null = null;

export function getBrainData(): Promise<BrainData> {
  if (!brainData) brainData = build();
  return brainData;
}

async function build(): Promise<BrainData> {
  const db = await getData();
  const species = new Map<number, Species>();
  const targets: HuntTarget[] = [];
  const lootCache = new Map<number, number[]>();

  for (const c of db.creatures) {
    const bases = [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];
    const moves: Move[] = c.attacks.map((a) => ({
      type: a.type as PokeType, power: a.power, learn: a.learnLevel,
      category: a.category, cooldownMs: a.cooldownMs,
    }));
    species.set(c.pokeId, {
      pokeId: c.pokeId, name: c.name, t1: c.type1, t2: c.type2, bases,
      evolvesToId: c.evolvesToId, evolveLevel: c.evolveLevel, moves,
    });

    const locs = db.locationsOf(c);
    if (!locs.length) continue;

    let goldEV = 0;
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      goldEV += (l.chance / 100000) * ((l.minCount + l.maxCount) / 2) * (it?.npcPrice ?? 0);
    }
    const hl = Math.max(1, c.huntLevel);
    const cs = enemyCombatStats(bases, hl);
    // spot de nivel mais proximo do huntLevel do alvo (varios spots -> o mais "na faixa")
    const spot = [...locs].sort((a, b) => Math.abs(a.level - hl) - Math.abs(b.level - hl))[0];
    targets.push({
      pokeId: c.pokeId, name: c.name, t1: c.type1, t2: c.type2, huntLevel: hl,
      areas: [...new Set(locs.map((h) => h.area))].sort(), spotCount: locs.length,
      xp: c.experience, goldEV: Math.round(goldEV), ...cs,
      slug: spot.slug, huntName: spot.name, area: spot.area,
    });
  }

  const movesOf: MovesOf = (pokeId) => species.get(pokeId)?.moves ?? [];

  const sellableLoot = (speciesId: number): number[] => {
    const hit = lootCache.get(speciesId);
    if (hit) return hit;
    const c = db.getCreature(speciesId);
    const ids = (c?.loot ?? [])
      .map((l) => db.getItemByName(l.name))
      .filter((it): it is NonNullable<typeof it> => !!it && it.npcPrice > 0)
      .map((it) => it.id);
    const uniq = [...new Set(ids)];
    lootCache.set(speciesId, uniq);
    return uniq;
  };

  return { species, targets, movesOf, sellableLoot };
}

// Perfil de combate do pokemon que vai cacar. `stats` sao os stats REAIS do jogo (frame
// `pokes`, ordem hp/atk/def/spAtk/spDef/speed) — quando vem, o IV por stat sai deles.
export interface FighterProfile {
  speciesId: number;
  level: number;
  ivTotal: number;
  quality: number;
  stats?: number[];
  statsAt?: number; // nivel em que os stats foram lidos (o nivel corrente anda sozinho)
}

/** Perfil de combate a partir do pokemon ATIVO da conta (frame `pokes`/snapshot do time).
 *  Leva os stats REAIS — e deles que sai o HP/Def de verdade pro lado defensivo do motor. */
export function fighterOf(p: ActivePoke): FighterProfile {
  const s = p.stats;
  const stats = [s.hp, s.atk, s.def, s.spAtk, s.spDef, s.speed];
  const ok = stats.every((n) => Number.isFinite(n) && n > 0);
  return {
    speciesId: p.speciesId, level: p.level, ivTotal: p.ivTotal, quality: p.quality,
    stats: ok ? stats : undefined, statsAt: ok ? p.level : undefined,
  };
}

const ivsOf = (p: FighterProfile, sp: Species): number[] => {
  // stats reais -> IV exato por stat (inverte a formula). E o que separa "9 de HP" de
  // "IV medio 21 em tudo" — sem isso o lado defensivo do motor chuta.
  // o IV se inverte no nivel em que o stat FOI LIDO — usar o nivel corrente (que anda a
  // cada level-up) devolveria um IV menor a cada nivel ganho.
  if (p.stats?.length === 6 && p.stats.every((n) => Number.isFinite(n) && n > 0)) {
    return estimateIvs(sp.bases, p.stats, p.statsAt ?? p.level, p.quality).ivs;
  }
  const avg = p.ivTotal > 0 ? Math.max(1, Math.min(31, Math.round(p.ivTotal / 6))) : SIM_IV;
  return [avg, avg, avg, avg, avg, avg];
};

export interface BrainPick {
  target: HuntTarget;
  est: HuntEstimate;
}

/** Alvos que o robo baniu (o bicho desmaiou neles de verdade). */
export type Avoid = (targetId: number) => boolean;

/** Melhor hunt pro pokemon no nivel dado: maior XP/h EFETIVO (rendimento x sobrevivencia)
 *  entre os alvos ao alcance. Hunt que te mata so entra se nao houver outra. */
export async function pickBestHunt(p: FighterProfile, vip: boolean, avoid?: Avoid): Promise<BrainPick | null> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return null;
  const pick = pickHunt(
    sp, p.level, ivsOf(p, sp), p.quality, data.targets, data.movesOf, "xp", vip,
    avoid ? (e) => avoid(e.pokeId) : undefined,
  );
  return pick ? { target: pick.enemy as HuntTarget, est: pick.est } : null;
}

/** A hunt ATUAL ainda vale a pena neste nivel? Retorna a melhor troca so se ela ganhar da
 *  atual pela MESMA margem da rota (>8%) — evita pular de hunt a cada level-up. Se a atual
 *  virou letal (ou sumiu), troca na hora: nao ha margem que pague desmaiar. */
export async function reconsiderHunt(
  p: FighterProfile, currentTargetId: number, vip: boolean, avoid?: Avoid,
): Promise<BrainPick | null> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return null;
  const cur = data.targets.find((t) => t.pokeId === currentTargetId);
  const best = await pickBestHunt(p, vip, avoid);
  if (!best) return null;
  if (!cur || avoid?.(cur.pokeId)) return best;
  const curEst = estimateHunt(sp, p.level, ivsOf(p, sp), p.quality, cur, data.movesOf(cur.pokeId), vip);
  if (!curEst) return best;
  const curDeadly = curEst.threat.risk === "deadly";
  if (curDeadly && best.est.threat.risk !== "deadly") return best; // fugir da armadilha nao espera margem
  if (best.est.xpH <= curEst.xpH * 1.08) return null; // atual segura a margem
  return best.target.pokeId === currentTargetId ? null : best;
}

export interface TeamPick {
  poke: ActivePoke;
  est: HuntEstimate;
}

/** Quem do SEU TIME rende mais nesta hunt: maior XP/h EFETIVO, nao maior efetividade de
 *  tipo. E a mesma correcao da rota — o glass cannon que bate x2.5 e desmaia no primeiro
 *  golpe nao e "o melhor do time" pra hunt nenhuma. Quem morre la so entra se ninguem
 *  aguentar. */
export async function bestFighterFor(pokes: ActivePoke[], targetId: number, vip: boolean): Promise<TeamPick | null> {
  const data = await getBrainData();
  const target = data.targets.find((t) => t.pokeId === targetId);
  if (!target) return null;
  let best: TeamPick | null = null;
  let lastResort: TeamPick | null = null;
  for (const p of pokes) {
    const sp = data.species.get(p.speciesId);
    if (!sp) continue;
    const f = fighterOf(p);
    const est = estimateHunt(sp, f.level, ivsOf(f, sp), f.quality, target, data.movesOf(targetId), vip);
    if (!est) continue;
    const pick: TeamPick = { poke: p, est };
    if (est.threat.risk === "deadly") {
      if (!lastResort || est.xpH > lastResort.est.xpH) lastResort = pick;
      continue;
    }
    if (!best || est.xpH > best.est.xpH) best = pick;
  }
  return best ?? lastResort;
}

export interface PlanStep {
  from: number;
  to: number;
  slug: string;
  huntName: string;
  area: string;
  targetId: number;
  targetName: string;
  xpH: number;
  goldH: number;
  kosH: number;
  risk: RiskLevel;      // como essa faixa te trata (o efetivo ja desconta o desmaio)
  killsPerLife: number; // quantos kills a vida cheia aguenta nessa faixa
}

/** Plano de leveling `start`->`target`: faixas de nivel com o spot de cada uma (buildRoute). */
export async function buildLevelPlan(
  p: FighterProfile, targetLevel: number, vip: boolean, avoid?: Avoid,
): Promise<PlanStep[]> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return [];
  const pool = avoid ? data.targets.filter((t) => !avoid(t.pokeId)) : data.targets;
  const steps: RouteStep[] = buildRoute(sp, p.level, targetLevel, pool, data.movesOf, p.quality, ivsOf(p, sp), "xp", vip);
  const bySpecies = new Map(data.targets.map((t) => [t.pokeId, t]));
  return steps.map((s) => {
    const t = bySpecies.get(s.enemy.pokeId)!;
    return {
      from: s.from, to: s.to, slug: t.slug, huntName: t.huntName, area: t.area,
      targetId: t.pokeId, targetName: t.name,
      xpH: Math.round(s.est.xpH), goldH: Math.round(s.est.goldH), kosH: Math.round(s.est.kosH),
      risk: s.est.threat.risk, killsPerLife: s.est.threat.killsPerLife,
    };
  });
}

/** Em que hunt o plano manda estar no nivel dado (a faixa que contem o nivel; passou do
 *  fim, a ultima). null = plano vazio. */
export function stepForLevel(steps: PlanStep[], level: number): PlanStep | null {
  if (!steps.length) return null;
  return steps.find((s) => level >= s.from && level <= s.to) ?? steps[steps.length - 1];
}
