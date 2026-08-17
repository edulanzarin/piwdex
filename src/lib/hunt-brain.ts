// Cerebro de hunt do robo (server-only). Reusa o motor de rota publico (combat.ts) pra:
//   - AUTO-HUNT: escolher a melhor hunt pro lider ATUAL no nivel atual (e re-escolher a
//     cada level-up, com a mesma margem de troca da rota, pra nao ficar pulando de hunt);
//   - LEVELING: montar o plano "do nivel X ao Y" (buildRoute) pra um pokemon escolhido e
//     dizer em que hunt ele deve estar em cada nivel.
// A conversao alvo->slug vem dos spots (locationsOf): o buildRoute pensa em ESPECIE-ALVO,
// o enter-hunt precisa do SLUG do spot. IVs por stat o jogo nao expoe na lista — usamos a
// media do ivTotal (a ordenacao de hunts e robusta a isso; ver header do combat.ts).

import {
  buildRoute, killEstimate, reachOf, enemyCombatStats, SIM_IV,
  type EnemyCombat, type Species, type Move, type RouteStep, type KillEstimate,
} from "@/lib/combat";
import { getData } from "@/lib/data";
import type { PokeType } from "@/lib/types";

export interface HuntTarget extends EnemyCombat {
  slug: string;        // spot pra enter-hunt (o de nivel mais proximo do huntLevel do alvo)
  huntName: string;
  area: string;
}

export interface BrainData {
  species: Map<number, Species>;
  targets: HuntTarget[];
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
      xp: c.experience, goldEV: Math.round(goldEV), hp: cs.hp, def: cs.def, spDef: cs.spDef,
      slug: spot.slug, huntName: spot.name, area: spot.area,
    });
  }

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

  return { species, targets, sellableLoot };
}

// Perfil de combate do pokemon que vai cacar. IVs por stat viram a media do ivTotal.
export interface FighterProfile {
  speciesId: number;
  level: number;
  ivTotal: number;
  quality: number;
}

const ivsOf = (p: FighterProfile): number[] => {
  const avg = p.ivTotal > 0 ? Math.max(1, Math.min(31, Math.round(p.ivTotal / 6))) : SIM_IV;
  return [avg, avg, avg, avg, avg, avg];
};

export interface BrainPick {
  target: HuntTarget;
  est: KillEstimate;
}

/** Melhor hunt pro pokemon no nivel dado (XP/h dentro do alcance). null = sem opcao. */
export async function pickBestHunt(p: FighterProfile, vip: boolean): Promise<BrainPick | null> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return null;
  const ivs = ivsOf(p);
  const reach = reachOf(p.level);
  let best: BrainPick | null = null;
  for (const t of data.targets) {
    if (t.huntLevel > reach) continue;
    const est = killEstimate(sp, p.level, ivs, p.quality, t, vip);
    if (!est) continue;
    if (!best || est.xpH > best.est.xpH) best = { target: t, est };
  }
  return best;
}

/** A hunt ATUAL ainda vale a pena neste nivel? Retorna a melhor troca so se ela ganhar da
 *  atual pela MESMA margem da rota (>8%) — evita pular de hunt a cada level-up. */
export async function reconsiderHunt(
  p: FighterProfile, currentTargetId: number, vip: boolean,
): Promise<BrainPick | null> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return null;
  const cur = data.targets.find((t) => t.pokeId === currentTargetId);
  const best = await pickBestHunt(p, vip);
  if (!best) return null;
  if (!cur) return best;
  const curEst = killEstimate(sp, p.level, ivsOf(p), p.quality, cur, vip);
  if (curEst && best.est.xpH <= curEst.xpH * 1.08) return null; // atual segura a margem
  return best.target.pokeId === currentTargetId ? null : best;
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
}

/** Plano de leveling `start`->`target`: faixas de nivel com o spot de cada uma (buildRoute). */
export async function buildLevelPlan(
  p: FighterProfile, targetLevel: number, vip: boolean,
): Promise<PlanStep[]> {
  const data = await getBrainData();
  const sp = data.species.get(p.speciesId);
  if (!sp) return [];
  const steps: RouteStep[] = buildRoute(sp, p.level, targetLevel, data.targets, p.quality, ivsOf(p), "xp", vip);
  const bySpecies = new Map(data.targets.map((t) => [t.pokeId, t]));
  return steps.map((s) => {
    const t = bySpecies.get(s.enemy.pokeId)!;
    return {
      from: s.from, to: s.to, slug: t.slug, huntName: t.huntName, area: t.area,
      targetId: t.pokeId, targetName: t.name,
      xpH: Math.round(s.est.xpH), goldH: Math.round(s.est.goldH), kosH: Math.round(s.est.kosH),
    };
  });
}

/** Em que hunt o plano manda estar no nivel dado (a faixa que contem o nivel; passou do
 *  fim, a ultima). null = plano vazio. */
export function stepForLevel(steps: PlanStep[], level: number): PlanStep | null {
  if (!steps.length) return null;
  return steps.find((s) => level >= s.from && level <= s.to) ?? steps[steps.length - 1];
}
