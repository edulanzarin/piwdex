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
import { getData, type DB } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import type { ActivePoke } from "@/lib/game-account";
import { estimateIvs, projectStat } from "@/lib/stats";
import type { PokeType } from "@/lib/types";

export interface HuntTarget extends EnemyCombat {
  slug: string;        // spot pra enter-hunt (o de nivel mais proximo do huntLevel do alvo)
  huntName: string;
  area: string;
  /** ouro que o NPC paga pelo pokemon capturado. Numa hunt de verdade ISTO costuma ser a
   *  maior fonte de ouro — no Yanma do Eduardo, 81k de captura contra 12k de loot. */
  sellValue: number;
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

// Dados de combate derivados do catalogo, guardados por VERSAO da fonte.
//
// Isto era um memo SEM CHAVE ("montado 1x por processo") e foi o pior vazamento de dado
// velho do projeto: o container do Railway nao reinicia sozinho (restart ON_FAILURE,
// 1 replica), entao o cerebro do robo ficava com o catalogo do boot PARA SEMPRE. No patch
// de 20/08/2026 o Ledian caiu de 493 pra 38 de ouro por abate — um robo ligado antes do
// patch seguiria escolhendo hunt por um numero 13x maior que o real, e nada na tela
// denunciaria. A chave e o `version` do catalogo (ETag da fonte): o jogo publica, a
// proxima leitura reconstroi.
let brainData: { version: string; data: Promise<BrainData> } | null = null;

export async function getBrainData(): Promise<BrainData> {
  const db = await getData();
  if (brainData && brainData.version === db.version) return brainData.data;
  const data = build(db);
  brainData = { version: db.version, data };
  return data;
}

async function build(db: DB): Promise<BrainData> {
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
      slug: spot.slug, huntName: spot.name, area: spot.area, sellValue: c.sellValue,
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

// --- Ranking de rendimento (o que paga/upa mais agora) --------------------------------
// A pergunta que isto responde e outra da rota: nao "onde eu upo", e "com o que eu tenho,
// o que rende mais AGORA". Tres diferencas de motor:
//
//  1. o `goldEV` do alvo (usado pelo goldH do combat.ts) e ouro SEM bonus e SEM teto. Um
//     bonus de loot MULTIPLICA a chance de cada drop, e chance nao passa de 100% — entao
//     em alvo cujos drops comuns ja nascem em 95% o bonus vira quase nada. Aqui o ouro
//     por abate e recalculado drop a drop, com o teto (lib/boost.ts).
//  2. LOOT NAO E A RENDA. Medir so o loot foi o erro da primeira versao: numa hunt real
//     do Eduardo (Yanma, 30 min) o loot deu 12.321 e a VENDA DOS CAPTURADOS deu 81.000,
//     com 47.710 gastos em bola e pocao. O ranking que via so o loot mostrava 23k/h onde
//     o jogo pagava 91k/h de saldo — e ordenava pela parcela errada.
//     Entao o rendimento e `loot + captura - supply`, e as duas taxas novas saem da SUA
//     hunt (o analyzer ao vivo, ou o acumulado do robo), nao de um chute nosso.
//  3. o Tipo do Dia so vale nos alvos DAQUELE tipo, entao ele reordena a lista em vez de
//     escalar todo mundo igual. Por isso o ranking mede os dois cenarios: sem o bonus,
//     dizer quanto o dia esta adicionando seria chute.
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

/** Como voce joga, medido do SEU historico — e o que transforma "ouro do loot" em renda.
 *  Zerado, o ranking vira o de loot puro (que e o que sobra pra quem nunca cacou). */
export interface PlayStyle {
  /** capturas por abate, no geral (14 capturas em 586 abates = 0,024) */
  capturePerKill: number;
  /** ouro de bola + pocao gasto por abate, MEDIDO (media de tudo que voce cacou) */
  supplyPerKill: number;
  /**
   * Custo de BOLA por abate. O auto-catch joga uma bola em cada corpo, entao esta parte
   * e ~constante por abate — nao depende do alvo.
   */
  ballCost?: number;
  /**
   * A pocao que o auto-potion usa: quanto cura e quanto custa. Com ela o gasto de cura
   * deixa de ser media e passa a sair do DANO QUE O ALVO TE CAUSA — que e o que decide
   * se a hunt paga. Um alvo que te obriga a potar sem parar pode render MENOS que um que
   * paga menos e nao te toca.
   */
  potion?: { heal: number; price: number; threshold: number } | null;
  /** de onde veio a medida, pra a tela poder dizer */
  from: "live" | "totals" | "default";
  /** abates que sustentam a medida (amostra pequena = numero fraco) */
  sample: number;
  /** taxa medida POR SPOT (slug -> abates/capturas), do historico de hunts */
  bySlug?: Map<string, { kills: number; captures: number }>;
  /** dificuldade de captura POR ESPECIE, do medidor de investimento do jogo
   *  (speciesId -> chance por abate). Ver lib/game-catch.ts. */
  bySpecies?: Map<number, number>;
  /** A LEI: chance prevista pra QUALQUER especie a partir do valor de venda dela, sem
   *  precisar ter cacado la. E o que responde "pra onde eu vou?" — evidencia propria so
   *  existe onde voce ja esteve. Ver o cabecalho de lib/game-catch.ts. */
  predictRate?: (sellValue: number) => number;
  /** o ajuste da lei (amostra e dispersao), so pra a tela poder dizer em que se apoia */
  law?: { sample: number; spread: number } | null;
  /** auto-catch ligado na conta; desligado, nao ha renda de captura */
  autoCatch?: boolean;
  /** bola que o auto-catch usa */
  ballName?: string;
  /**
   * Quanto da renda de captura que o modelo projeta REALMENTE virou ouro na sua conta.
   *
   * E a ancora final, e ela existe porque o modelo continuava otimista mesmo com a taxa
   * por especie: projetava +774 por abate no Tyrogue enquanto a hunt real pagava -130.
   * Entre "capturei" e "recebi" ha coisa que nenhuma formula ve — pokemon que a config
   * manda GUARDAR em vez de vender, venda recusada pelo jogo (403), bicho que fica no
   * acervo. Este fator e a razao entre o ouro de venda de pokemon que o robo REGISTROU e
   * o que o modelo teria previsto no mesmo periodo. 1 = o modelo acerta.
   */
  sellShare?: number;
  /**
   * Correcao simples da velocidade (fator unico). Mantida como rede quando nao ha pontos
   * suficientes pro ajuste de verdade abaixo. 1 = sem medida.
   */
  speedFactor: number;
  /**
   * VELOCIDADE MEDIDA: `ttk = perHp * HP_do_wild + overhead`, ajustado nas SUAS hunts.
   *
   * O motor de combate estima o dano com uma constante de calibracao inventada, e o erro
   * nao e um fator: como o overhead e fixo, subestimar o dano castiga alvo TANQUE e
   * favorece lixo de nivel baixo. Media na conta do Eduardo: o motor dava 16 abates/h no
   * Pinsir (231s por abate) quando a hunt real fazia ~530 — e por isso o painel enchia de
   * bicho nivel 10 e escondia a melhor hunt de Kanto.
   *
   * Dois pontos com HP diferente identificam os dois termos (e uma reta), e a conferencia
   * bateu: Tyrogue 900 abates/h e Yanma 713 dao DPS 133 e overhead 3,25s — contra os 5s
   * fixos que o motor assumia.
   */
  killSpeed?: { perHp: number; overhead: number; points: number } | null;
  /**
   * A quem a velocidade medida pertence. A calibracao do motor divide o DPS medido pelo
   * DPS que o motor daria PARA ESTE bicho — se a ancora for "o lider de agora", trocar o
   * ativo re-escala o ranking inteiro sem nada ter mudado no jogo. Vem do ultimo
   * `hunt-summary` etiquetado; null = cai no lider atual (e a tela avisa).
   */
  speedRef?: { speciesId: number; level: number; quality: number } | null;
}

/**
 * Duas taxas de captura por spot, e a diferenca entre elas E a incerteza:
 *
 *  - `floor`  — o que os SEUS abates naquele spot sustentam (piso de Wilson). Spot sem
 *               historico vale ZERO aqui: nao ha evidencia de que voce captura la.
 *  - `guess`  — o cenario otimista: a sua taxa geral, encolhida pela amostra do spot.
 *
 * O ranking ordena pelo piso (o que da pra defender) e a tela mostra o otimista ao lado.
 * Ordenar pelo otimista foi o que mandou o Eduardo pro Tyrogue.
 */
const RATE_PRIOR = 60;

function captureRatesFor(style: PlayStyle, slug: string, speciesId: number, sellValue: number): { floor: number; guess: number } {
  const geral = style.capturePerKill;
  // 1) o mais forte: os SEUS abates e capturas naquele spot, medidos pelo robo.
  const spot = style.bySlug?.get(slug);
  if (spot && spot.kills > 0) {
    return {
      floor: rateFloor(spot.captures, spot.kills),
      guess: (spot.captures + RATE_PRIOR * geral) / (spot.kills + RATE_PRIOR),
    };
  }
  // 2) sem historico de hunt, o medidor de investimento do JOGO por especie: ele sabe
  // quantas bolas voce ja queimou nesta especie desde a ultima captura.
  const meter = style.bySpecies?.get(speciesId);
  if (meter != null) return { floor: meter, guess: Math.max(meter, geral) };
  // 3) nunca pisou la nem gastou bola: a LEI preve pelo valor do bicho. Nao e evidencia
  // sua, entao entra como piso conservador — mas e previsao, nao a taxa media herdada,
  // que era o que fazia bicho de 75.000 liderar por engano.
  const law = style.predictRate?.(sellValue);
  if (law != null && law > 0) return { floor: law, guess: Math.max(law, geral) };
  return { floor: 0, guess: geral };
}

export const NO_STYLE: PlayStyle = {
  capturePerKill: 0, supplyPerKill: 0, from: "default", sample: 0, speedFactor: 1,
};

/**
 * Piso do intervalo de confianca de uma proporcao (Wilson, ~90% de um lado).
 *
 * E o que separa "nao ha evidencia" de "a evidencia diz zero". Sem isto, um spot NUNCA
 * cacado herdava a taxa media e o ranking projetava 646k/h de captura no Tyrogue (que
 * vale 75.000 por bicho) enquanto o jogo pagava MENOS 117k/h. Com o piso, spot sem
 * historico entra valendo o que da pra defender — o loot, que e exato — e a captura so
 * pesa depois que os seus proprios abates a sustentarem.
 */
export function rateFloor(successes: number, trials: number, z = 1.2816): number {
  if (trials <= 0) return 0;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return Math.max(0, (center - margin) / denom);
}

export type MoneyMode = "gold" | "xp";

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
  /** renda liquida por hora: loot + captura - supply, ja descontado o tempo caido na Joy */
  goldH: number;
  /** as parcelas, pra a tela poder abrir a conta */
  lootH: number;
  captureH: number;
  supplyH: number;
  /** so a parte de POCAO do supply — a que depende de quanto o alvo te machuca */
  potionH: number;
  /** dano que voce leva por abate neste alvo (em pontos de vida) */
  dmgPerKill: number;
  /** a mesma renda num dia sem Tipo do Dia — a diferenca e o que o dia adiciona */
  plainGoldH: number;
  goldPerKill: number;
  kosH: number;
  xpH: number;
  /** XP/h sem o bonus do dia */
  plainXpH: number;
  eff: number;
  moveType: PokeType;
  risk: RiskLevel;
  killsPerLife: number;
  typeDayHits: boolean;
  /** fracao do bonus do dia que este alvo converte: 1 = tudo, 0 = tudo bateu no teto */
  dayUse: number;
  /** taxa de captura DEFENSAVEL neste spot (piso), a otimista, e a sua amostra la */
  captureRate: number;
  captureGuessRate: number;
  captureSample: number;
  /** renda/h no cenario otimista (taxa geral em vez do piso) */
  goldGuessH: number;
}

const moneyPokeOf = (p: ActivePoke): MoneyPoke => ({
  id: p.id, speciesId: p.speciesId, name: p.name, level: p.level,
  team: p.team, leader: p.leader, shiny: p.shiny,
});

/** Teto de candidatos: com o box cheio a conta vira dezenas de milhares de simulacoes
 *  por alvo sem mudar a resposta — os fracos nunca ganham. Corta pelos mais fortes. */
const MAX_POKES = 60;

export interface RankOpts {
  limit?: number;
  /** o que ordena a lista: renda ou XP */
  mode?: MoneyMode;
  /** quanto o Tipo do Dia paga de XP (o loot vai em `bonuses`) */
  dayXpPct?: number;
  /** como voce joga (captura/abate e supply/abate) */
  style?: PlayStyle;
}

export async function rankMoney(
  pokes: ActivePoke[],
  bonuses: LootBonuses,
  vip: boolean,
  opts: RankOpts = {},
): Promise<MoneyRow[]> {
  const limit = opts.limit ?? 12;
  const mode = opts.mode ?? "gold";
  // o Tipo do Dia paga XP junto com o loot, e so nos mesmos alvos — sem isto o XP/h da
  // linha contradiria o proprio cabecalho do painel.
  const dayXp = opts.dayXpPct ?? 0;
  const style = opts.style ?? NO_STYLE;
  const potion = style.potion ?? null;
  // sem medida separada, assume que metade do supply medido e bola (o resto e cura)
  const ballCost = style.ballCost ?? style.supplyPerKill * 0.5;

  const data = await getBrainData();
  if (!pokes.length) return [];

  const pool = pokes.length > MAX_POKES
    ? [...pokes].sort((a, b) => b.power - a.power).slice(0, MAX_POKES)
    : pokes;

  // --- CALIBRACAO DA VELOCIDADE -----------------------------------------------------
  //
  // A reta medida (`ttk = perHp * HP_do_alvo + overhead`) nao tem termo de LUTADOR: ela
  // foi ajustada nas hunts reais e, aplicada crua, da o mesmo tempo por abate pro box
  // inteiro. O efeito era o ranking empatar tudo e o desempate cair no primeiro da lista
  // — o lider. Trocar de pokemon mudava o rotulo "COM" e nao mudava numero nenhum.
  //
  // O conserto e a reta CALIBRAR o motor em vez de substitui-lo. O motor sabe a diferenca
  // entre lutadores (`est.dps`, a soma do moveset contra aquele alvo); o que ele errava
  // era a escala. Entao mede-se um fator unico
  //
  //     k = DPS_medido / DPS_do_motor(lutador de referencia, spots medidos)
  //
  // e o tempo por abate de QUALQUER lutador vira `HP / (DPS_motor * k) + overhead`. A
  // ancora empirica continua; a diferenca entre pokemons volta.
  //
  // Referencia = o lider (foi ele quem produziu as hunts que a reta mediu), medido nos
  // MESMOS spots do historico, em media geometrica — a escala e multiplicativa.
  const ks = style.killSpeed;
  let calK = 0;
  if (ks && ks.points >= 2 && ks.perHp > 0) {
    // Ancora: o bicho que REALMENTE cacou as hunts medidas. So cai no lider atual quando
    // nao ha evento etiquetado (historico anterior a 20/08/2026).
    const sr = style.speedRef;
    const refSp = data.species.get(sr?.speciesId ?? (pool.find((p) => p.leader) ?? pool.find((p) => p.team) ?? pool[0])?.speciesId ?? 0);
    const refPoke = sr ? null : (pool.find((p) => p.leader) ?? pool.find((p) => p.team) ?? pool[0]);
    if (refSp) {
      const rf = sr
        ? { speciesId: sr.speciesId, level: sr.level, ivTotal: 0, quality: sr.quality } as FighterProfile
        : fighterOf(refPoke!);
      const rIvs = ivsOf(rf, refSp);
      const dpsList: number[] = [];
      for (const slug of style.bySlug?.keys() ?? []) {
        const t = data.targets.find((x) => x.slug === slug);
        if (!t) continue;
        const e = estimateHunt(refSp, rf.level, rIvs, rf.quality, t, data.movesOf(t.pokeId), vip);
        if (e && e.dps > 0) dpsList.push(e.dps);
      }
      if (dpsList.length) {
        const geo = Math.exp(dpsList.reduce((a, d) => a + Math.log(d), 0) / dpsList.length);
        if (geo > 0) calK = (1 / ks.perHp) / geo;
      }
    }
  }

  // Economia por ALVO: independe de quem caca, entao sai uma vez so.
  const noDay: LootBonuses = { ...bonuses, typeDay: null };
  const econ = new Map<number, {
    loot: number; lootPlain: number; capture: number; captureGuess: number;
    hits: boolean; dayUse: number; rate: number; guessRate: number; sample: number;
  }>();
  for (const t of data.targets) {
    const drops = data.dropsOf(t.pokeId);
    const types = [t.t1, t.t2];
    const multDay = lootMultiplier(bonuses, types);
    const multPlain = lootMultiplier(noDay, types);
    const loot = drops.length ? goldPerKill(drops, multDay) : 0;
    const lootPlain = drops.length ? goldPerKill(drops, multPlain) : 0;
    // A venda do capturado, nos dois cenarios. O supply (bola + pocao) NAO e custo fixo
    // do spot: o auto-catch joga bola em cada corpo, entao ele acompanha os abates — e e
    // por isso que spot rapido de bicho barato consegue dar prejuizo.
    const rates = captureRatesFor(style, t.slug, t.pokeId, t.sellValue);
    const share = style.sellShare ?? 1;
    const capture = rates.floor * t.sellValue * share;
    const captureGuess = rates.guess * t.sellValue * share;
    if (loot + captureGuess <= 0) continue; // alvo que nao paga nada nem no otimista
    // Quanto do bonus do dia sobreviveu ao teto: o ganho REAL sobre o ganho que ele teria
    // se nenhuma chance esbarrasse em 100%.
    const sample = style.bySlug?.get(t.slug)?.kills ?? 0;
    const hits = multDay > multPlain;
    const theoretical = hits ? lootPlain * (multDay / multPlain - 1) : 0;
    const dayUse = theoretical > 0 ? Math.max(0, Math.min(1, (loot - lootPlain) / theoretical)) : 0;
    econ.set(t.pokeId, { loot, lootPlain, capture, captureGuess, hits, dayUse, rate: rates.floor, guessRate: rates.guess, sample });
  }

  const best = new Map<number, MoneyRow>();
  for (const p of pool) {
    const sp = data.species.get(p.speciesId);
    if (!sp) continue;
    const f = fighterOf(p);
    const ivs = ivsOf(f, sp);
    const reach = reachOf(f.level);
    // sua vida cheia: e o que converte "aguento N abates por vida" em "levo X de dano
    // por abate", e dai em quantas pocoes a hunt te cobra.
    const selfHp = projectStat(sp.bases[0], ivs[0], f.level, f.quality, 0);
    for (const t of data.targets) {
      if (t.huntLevel > reach) continue;
      const e = econ.get(t.pokeId);
      if (!e) continue;
      const est = estimateHunt(sp, f.level, ivs, f.quality, t, data.movesOf(t.pokeId), vip);
      if (!est || est.threat.risk === "deadly") continue; // morrer nao paga

      // Velocidade: com ajuste medido, a reta manda (ela ja embute a sua forca real);
      // sem ele, o motor com o fator unico. O erro de velocidade contamina loot, captura
      // e supply de uma vez, porque os tres sao por abate.
      // Com calibracao, o motor manda (e ele conhece o lutador); a reta so re-escala.
      // O fator `est.ttkS / ttkCal` preserva o desconto de desmaio que ja esta no
      // est.kosH — sem ele, alvo que te derruba voltaria a parecer rentavel.
      const ttkCal = calK > 0 && est.dps > 0
        ? Math.max(0.5, t.hp / (est.dps * calK) + ks!.overhead)
        : 0;
      const kosH = ttkCal > 0
        ? est.kosH * (est.ttkS / ttkCal)
        : ks && ks.points >= 2
          ? 3600 / Math.max(0.5, ks.perHp * t.hp + ks.overhead)
          : est.kosH * style.speedFactor;
      // SUPPLY em duas partes, porque elas se comportam de forma diferente:
      //   bola  — uma por corpo, praticamente igual em qualquer alvo;
      //   pocao — sai do dano que ESTE alvo te causa. Alvo que te obriga a potar sem
      //           parar come o lucro, e a media escondia isso.
      const dmgPerKill = selfHp / Math.max(0.1, est.threat.killsPerLife);
      // CURA EFETIVA, nao nominal. O auto-potion dispara com a vida abaixo do limiar,
      // entao o que falta pra encher e no maximo (1 - limiar) x vida cheia — curar alem
      // disso e ouro no lixo. Com limiar 50% numa vida de 4.536, a Ultimate Potion de
      // 3.000 aproveita 2.268: 24% do frasco se perde, e o modelo que usa o nominal
      // subestima o numero de pocoes na mesma proporcao. (Medido: 2.356 de media em 12
      // usos — o modelo erra 3,9%, o nominal erraria 27%.)
      const effHeal = potion && potion.heal > 0
        ? Math.min(potion.heal, Math.max(1, (1 - Math.min(99, potion.threshold) / 100) * selfHp))
        : 0;
      const potionPerKill = effHeal > 0
        ? (dmgPerKill / effHeal) * potion!.price
        : Math.max(0, style.supplyPerKill - ballCost); // sem catalogo de pocao, cai na media
      const supplyPerKill = ballCost + potionPerKill;

      const lootH = e.loot * kosH;
      const captureH = e.capture * kosH;
      const supplyH = supplyPerKill * kosH;
      const potionH = potionPerKill * kosH;
      const goldH = lootH + captureH - supplyH;
      const goldGuessH = lootH + e.captureGuess * kosH - supplyH;
      const xpH = est.xpH * style.speedFactor * (e.hits ? 1 + dayXp : 1);
      const score = mode === "xp" ? xpH : goldH;

      const cur = best.get(t.pokeId);
      if (cur && (mode === "xp" ? cur.xpH : cur.goldH) >= score) continue;
      best.set(t.pokeId, {
        poke: moneyPokeOf(p),
        targetId: t.pokeId, targetName: t.name, t1: t.t1, t2: t.t2,
        slug: t.slug, huntName: t.huntName, area: t.area, huntLevel: t.huntLevel,
        goldH, goldGuessH, lootH, captureH, supplyH, potionH, dmgPerKill,
        plainGoldH: e.lootPlain * kosH + captureH - supplyH,
        goldPerKill: e.loot + e.capture - supplyPerKill,
        kosH,
        xpH,
        plainXpH: est.xpH * style.speedFactor,
        eff: est.eff,
        moveType: est.moveName,
        risk: est.threat.risk,
        killsPerLife: est.threat.killsPerLife,
        typeDayHits: e.hits,
        dayUse: e.dayUse,
        captureRate: e.rate,
        captureGuessRate: e.guessRate,
        captureSample: e.sample,
      });
    }
  }

  const key = (r: MoneyRow) => (mode === "xp" ? r.xpH : r.goldH);
  return [...best.values()].sort((a, b) => key(b) - key(a)).slice(0, limit);
}
