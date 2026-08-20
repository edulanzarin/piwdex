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
  buildRoute, estimateHunt, pickHunt, enemyCombatStats, reachOf, SIM_IV,
  type EnemyCombat, type Species, type Move, type RouteStep, type HuntEstimate, type MovesOf, type RiskLevel,
} from "@/lib/combat";
import { goldPerKill, lootMultiplier, pricedDrops, type LootBonuses, type PricedDrop } from "@/lib/boost";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
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
  /** Drops do alvo com preco e quantidade media resolvidos — a materia-prima do ouro.
   *  O `goldEV` do EnemyCombat e a versao SEM bonus e SEM teto; pra medir o que um bonus
   *  de loot realmente adiciona e preciso a tabela drop a drop (ver lib/boost.ts). */
  dropsOf: (speciesId: number) => PricedDrop[];
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
  const dropCache = new Map<number, PricedDrop[]>();

  for (const c of db.creatures) {
    const bases = [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];
    const moves: Move[] = c.attacks.map((a) => ({
      type: a.type as PokeType, power: a.power, learn: a.learnLevel,
      category: a.category, cooldownMs: a.cooldownMs, tm: a.tm != null,
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

  const dropsOf = (speciesId: number): PricedDrop[] => {
    const hit = dropCache.get(speciesId);
    if (hit) return hit;
    const c = db.getCreature(speciesId);
    const list = c
      ? pricedDrops(c.loot, (n) => db.getItemByName(n)?.npcPrice ?? 0, (n) => {
          const it = db.getItemByName(n);
          return it ? itemIconUrl(it) : "";
        })
      : [];
    dropCache.set(speciesId, list);
    return list;
  };

  return { species, targets, movesOf, sellableLoot, dropsOf };
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

// --- Ranking de DINHEIRO (Tipo do Dia) ----------------------------------------------
// A pergunta que isto responde e outra da rota: nao "onde eu upo", e "com o que eu tenho,
// o que paga mais AGORA". Duas diferencas de motor:
//
//  1. o `goldEV` do alvo (usado pelo goldH do combat.ts) e ouro SEM bonus e SEM teto. Um
//     bonus de loot MULTIPLICA a chance de cada drop, e chance nao passa de 100% — entao
//     em alvo cujos drops comuns ja nascem em 95% o bonus vira quase nada. Aqui o ouro
//     por abate e recalculado drop a drop, com o teto (lib/boost.ts).
//  2. o Tipo do Dia so vale nos alvos DAQUELE tipo, entao ele reordena a lista em vez de
//     escalar todo mundo igual. E por isso que o ranking mede os dois cenarios: sem o
//     bonus do dia dizer quanto o dia esta realmente adicionando seria chute.
//
// Sai o MELHOR pokemon seu por alvo (a lista repetida com os 6 do time em cima do mesmo
// spot nao decide nada) e o alvo que te mata continua fora — hunt que te derruba rende
// zero, com bonus ou sem.

/** O seu pokemon, no minimo que a decisao precisa. */
export interface MoneyPoke {
  id: string;
  speciesId: number;
  name: string;
  level: number;
  team: boolean;
  leader: boolean;
  shiny: boolean;
}

export interface MoneyRow {
  poke: MoneyPoke;
  targetId: number;
  targetName: string;
  t1: PokeType;
  t2: PokeType | null;
  slug: string;
  huntName: string;
  area: string;
  huntLevel: number;
  /** ouro/h efetivo com os bonus de hoje (ja descontado o tempo caido na Joy) */
  goldH: number;
  /** o mesmo, num dia sem Tipo do Dia — a diferenca e o que o dia adiciona */
  plainGoldH: number;
  goldPerKill: number;
  kosH: number;
  xpH: number;
  eff: number;
  moveType: PokeType;
  risk: RiskLevel;
  killsPerLife: number;
  typeDayHits: boolean;
  /** fracao do bonus do dia que este alvo converte: 1 = tudo, 0 = tudo bateu no teto */
  dayUse: number;
}

const moneyPokeOf = (p: ActivePoke): MoneyPoke => ({
  id: p.id, speciesId: p.speciesId, name: p.name, level: p.level,
  team: p.team, leader: p.leader, shiny: p.shiny,
});

/** Teto de candidatos: com o box cheio a conta vira dezenas de milhares de simulacoes
 *  por alvo sem mudar a resposta — os fracos nunca ganham. Corta pelos mais fortes. */
const MAX_POKES = 60;

export async function rankMoney(
  pokes: ActivePoke[],
  bonuses: LootBonuses,
  vip: boolean,
  opts: { limit?: number; dayXpPct?: number } = {},
): Promise<MoneyRow[]> {
  const limit = opts.limit ?? 12;
  // o Tipo do Dia paga XP junto com o loot, e so nos mesmos alvos — sem isto o XP/h da
  // linha contradiria o proprio cabecalho do painel.
  const dayXp = opts.dayXpPct ?? 0;
  const data = await getBrainData();
  if (!pokes.length) return [];

  const pool = pokes.length > MAX_POKES
    ? [...pokes].sort((a, b) => b.power - a.power).slice(0, MAX_POKES)
    : pokes;

  // Economia por ALVO: independe de quem caca, entao sai uma vez so.
  const noDay: LootBonuses = { ...bonuses, typeDay: null };
  const econ = new Map<number, { gpk: number; gpkPlain: number; hits: boolean; dayUse: number }>();
  for (const t of data.targets) {
    const drops = data.dropsOf(t.pokeId);
    if (!drops.length) continue; // alvo sem drop vendavel nao e alvo de dinheiro
    const types = [t.t1, t.t2];
    const multDay = lootMultiplier(bonuses, types);
    const multPlain = lootMultiplier(noDay, types);
    const gpk = goldPerKill(drops, multDay);
    const gpkPlain = goldPerKill(drops, multPlain);
    if (gpk <= 0) continue;
    // Quanto do bonus do dia sobreviveu ao teto: o ganho REAL sobre o ganho que ele teria
    // se nenhuma chance esbarrasse em 100%.
    const hits = multDay > multPlain;
    const theoretical = hits ? gpkPlain * (multDay / multPlain - 1) : 0;
    const dayUse = theoretical > 0 ? Math.max(0, Math.min(1, (gpk - gpkPlain) / theoretical)) : 0;
    econ.set(t.pokeId, { gpk, gpkPlain, hits, dayUse });
  }

  const best = new Map<number, MoneyRow>();
  for (const p of pool) {
    const sp = data.species.get(p.speciesId);
    if (!sp) continue;
    const f = fighterOf(p);
    const ivs = ivsOf(f, sp);
    const reach = reachOf(f.level);
    for (const t of data.targets) {
      if (t.huntLevel > reach) continue;
      const e = econ.get(t.pokeId);
      if (!e) continue;
      const est = estimateHunt(sp, f.level, ivs, f.quality, t, data.movesOf(t.pokeId), vip);
      if (!est || est.threat.risk === "deadly") continue; // morrer nao paga
      const goldH = e.gpk * est.kosH;
      const cur = best.get(t.pokeId);
      if (cur && cur.goldH >= goldH) continue;
      best.set(t.pokeId, {
        poke: moneyPokeOf(p),
        targetId: t.pokeId, targetName: t.name, t1: t.t1, t2: t.t2,
        slug: t.slug, huntName: t.huntName, area: t.area, huntLevel: t.huntLevel,
        goldH,
        plainGoldH: e.gpkPlain * est.kosH,
        goldPerKill: e.gpk,
        kosH: est.kosH,
        xpH: est.xpH * (e.hits ? 1 + dayXp : 1),
        eff: est.eff,
        moveType: est.moveName,
        risk: est.threat.risk,
        killsPerLife: est.threat.killsPerLife,
        typeDayHits: e.hits,
        dayUse: e.dayUse,
      });
    }
  }

  return [...best.values()].sort((a, b) => b.goldH - a.goldH).slice(0, limit);
}
