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
// O COMBATE TEM DOIS LADOS. Medir so o quanto VOCE bate manda o pokemon pro matadouro: a
// vantagem elemental vale pros DOIS. Um Abra lvl 14 contra Gastly lvl 20 bate x2.5
// (Psiquico > Venenoso) e leva x2.5 de volta (Fantasma > Psiquico) — com 9 de HP ele cai
// no primeiro golpe, e a hunt de "maior XP/h" rende ZERO. Entao o motor estima tambem o
// dano que voce TOMA (threatOf): quantos kills a vida cheia aguenta (killsPerLife) e que
// fatia da hora sobra cacando depois do desmaio + Joy (uptime). KOs/h, XP/h e ouro/h que
// saem daqui JA sao os efetivos — hunt que te mata nao ganha de hunt que rende.
//
// O jogo NAO publica a formula de dano nem a de captura. Entao tudo aqui e ESTIMATIVA:
// modelamos a velocidade de kill por dano-por-segundo (poder do golpe x razao de stats x
// STAB x efetividade) contra o HP reforcado, mais um overhead fixo por kill; o dano que
// voce leva usa a MESMA formula do outro lado. As constantes (DMG_K, OVERHEAD_S,
// DEATH_COST_S, SAFE_KILLS) sao calibradas pra bater a ordem de grandeza do jogo; servem
// pra COMPARAR hunts, nao como numero exato. A ordenacao e robusta a elas.

import { projectStat } from "./stats";
import { effectiveness } from "./typing";
import type { AttackCategory, PokeType } from "./types";

export const SIM_IV = 21;

// Reforco de hunt + calibracao do modelo de kill-speed.
export const WILD_HP_MULT = 5; // HP do wild x5 (doc do jogo)
const WILD_Q = 1.0; // qualidade base do wild (capturas ~common)
const WILD_IV = 15;
// Constante de escala do dano, CALIBRADA contra medicao (ago/2026) e nao mais chutada.
// O valor antigo (0,06) subestimava o dano em mais de 10x, e o estrago nao era uniforme:
// como o overhead por abate e fixo, dano baixo demais castiga alvo TANQUE e infla lixo de
// nivel baixo. Foi assim que o planner recomendou uma hunt lvl 10 pra um jogador lvl 216
// e escondeu o Pinsir (o motor dava 231s por abate onde a hunt real leva ~7s).
// Referencia: Electrode Lv213 matando Tyrogue (hp 100 reforcado) em 0,75s de combate.
const DMG_K = 0.28;
// Segundos por abate FORA do combate (spawn, aproximacao, animacao). Medido resolvendo
// ttk = HP/DPS + overhead em duas hunts reais (Tyrogue 900 abates/h, Yanma 713): 3,25s.
const OVERHEAD_S = 3.3;

// Sobrevivencia. `killsPerLife` e a margem CRUA (vida cheia, sem pocao): com margem alta a
// auto-pocao segura o resto da hora, com margem baixa nem pocao salva.
const DEATH_COST_S = 45;  // parada por desmaio: o robo so ve o 0 de HP no proximo frame
                          // `pokes` (20s), passa na Joy e volta pro campo. Rende zero nisso.
const SAFE_KILLS = 6;     // aguenta 6+ kills por vida = hunt sustentavel (rende cheio)
const RISKY_KILLS = 2;    // abaixo disso e armadilha: fica FORA da rota (so como ultimo recurso)
const CAP_KILLS = 999;    // teto de killsPerLife/ttd — Infinity nao sobrevive a um JSON.stringify

/** Dano de UM golpe, o modelo unico do site: poder x razao de stats x STAB x efetividade.
 *  Vale pros dois lados do combate e pros dois motores (hunt e arena) — se a calibracao
 *  mudar, muda num lugar so. `DMG_K` e constante de escala, nao de balanceamento. */
export function hitDamage(power: number, off: number, def: number, stab: number, eff: number): number {
  return Math.max(1, DMG_K * power * (off / Math.max(1, def)) * stab * eff);
}

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
  /** Golpe de MAQUINA: so existe pra quem comprou a TM. Fora do pool por padrao. */
  tm: boolean;
}

/** Pool de golpes considerado. `natural` = o que a especie aprende sozinha (o que todo
 *  jogador tem); `tm` = natural + maquinas. Todo golpe de poder 600 do jogo e TM, e a
 *  troca chega a valer 10x de DPS — por isso o pool e explicito em vez de "todos". */
export type MovePool = "natural" | "tm";

const inPool = (mv: Move, pool: MovePool): boolean => pool === "tm" || !mv.tm;

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
  atk: number; // Atk no huntLevel — o wild tambem bate (ver threatOf)
  spAtk: number; // Sp.Atk no huntLevel
}

/** Golpes do wild, resolvidos pelo pokeId. Quem chama ja tem o catalogo de especies na
 *  mao, entao o alvo NAO carrega os golpes de novo (seriam ~120KB a mais no payload da
 *  pagina publica de hunt). */
export type MovesOf = (pokeId: number) => Move[];

export type RiskLevel = "safe" | "risky" | "deadly";

/** Cor do risco — token unico (var de tema, serve tanto pra texto quanto pro LED), pra
 *  "letal" ter a mesma cor em toda tela que fala de risco.
 *
 *  Os nomes sao os do piwdex2 (`--color-ok/warn/danger`). Vieram errados no porte, com os
 *  tokens do piwdex 1 (`--green`, `--yellow`, `--red`), que aqui NAO EXISTEM: `var()` sem
 *  fallback e cor invalida, entao a propriedade cai pra herdada e "SEGURO" saia branco,
 *  igualzinho a "LETAL". A tela dizia risco nenhum sem nunca dar erro. */
export const RISK_COLOR: Record<RiskLevel, string> = {
  safe: "var(--color-ok)", risky: "var(--color-warn)", deadly: "var(--color-danger)",
};

/** O outro lado do combate: quanto o wild bate em VOCE. */
export interface Threat {
  moveType: PokeType | null; // golpe do wild que mais doi (null = ele nao te machuca)
  category: AttackCategory | null;
  eff: number; // efetividade amplificada DELE contra VOCE
  hitDmg: number; // dano por golpe que voce leva
  ttdS: number; // segundos de vida cheia ate desmaiar (em combate)
  killsPerLife: number; // quantos wilds voce derruba antes de cair
  uptime: number; // 0..1 — fatia do tempo cacando (o resto e desmaio + Joy)
  risk: RiskLevel;
}

export interface HuntEstimate {
  moveName: PokeType; // tipo do SEU golpe de maior DPS
  category: AttackCategory;
  eff: number; // efetividade amplificada desse golpe
  hits: number; // hits pra derrubar (estimativa)
  ttkS: number; // segundos por kill (combate + overhead)
  /** DPS do moveset INTEIRO deste lutador contra ESTE alvo. Fica exposto porque e o
   *  unico numero do motor que separa um lutador do outro — a reta de velocidade medida
   *  (`ttk = perHp * HP + overhead`) nao tem termo de lutador, entao sozinha ela faz o
   *  box inteiro empatar. Quem calibra a reta precisa deste valor. */
  dps: number;
  kosH: number; // KOs/h EFETIVO (ja descontando o tempo parado por desmaio)
  xpH: number; // XP/h efetivo (com VIP se ligado)
  goldH: number; // ouro/h efetivo (loot)
  threat: Threat; // o que essa hunt faz com voce
}

/**
 * Dano por segundo do moveset INTEIRO contra o alvo.
 *
 * O motor media so o melhor golpe, e isso e o jogo errado: aqui cada golpe tem cooldown
 * proprio e dispara sozinho quando recarrega — voce nao "escolhe um". O melhor golpe
 * natural do Electrode tem 10s de recarga, e mesmo assim a conta real mata a cada 4s:
 * o que fecha a conta e a SOMA das recargas. Somar tambem muda a ordem entre pokemons,
 * porque quem tem quatro golpes medios bate mais que quem tem um bom e nada mais.
 *
 * `top` continua sendo o golpe de maior dano — e o que a tela mostra ("com que tipo voce
 * bate"), e e ele que define a efetividade exibida.
 */
function movesetDps(species: Species, level: number, ivs: number[], quality: number, e: EnemyCombat, pool: MovePool) {
  const atk = projectStat(species.bases[1], ivs[1], level, quality, 1);
  const spa = projectStat(species.bases[3], ivs[3], level, quality, 3);
  let total = 0;
  let top: { mv: Move; eff: number; dmg: number; dps: number } | null = null;
  for (const mv of species.moves) {
    if (mv.power <= 0 || mv.learn > level || mv.cooldownMs <= 0) continue;
    if (!inPool(mv, pool)) continue;
    const eff = huntEffectiveness(mv.type, e.t1, e.t2);
    if (eff <= 0) continue; // imune
    const stab = mv.type === species.t1 || mv.type === species.t2 ? 1.5 : 1;
    const off = mv.category === "SPECIAL" ? spa : atk;
    const def = mv.category === "SPECIAL" ? e.spDef : e.def;
    const dmg = hitDamage(mv.power, off, def, stab, eff);
    const dps = dmg / (mv.cooldownMs / 1000);
    total += dps;
    if (!top || dps > top.dps) top = { mv, eff, dmg, dps };
  }
  return top ? { ...top, total } : null;
}

const riskOf = (killsPerLife: number): RiskLevel =>
  killsPerLife >= SAFE_KILLS ? "safe" : killsPerLife >= RISKY_KILLS ? "risky" : "deadly";

const NO_THREAT: Threat = {
  moveType: null, category: null, eff: 0, hitDmg: 0,
  ttdS: CAP_KILLS, killsPerLife: CAP_KILLS, uptime: 1, risk: "safe",
};

/** Dano que o WILD te causa: mesmo modelo, lado invertido (o golpe dele de maior DPS
 *  contra os SEUS stats defensivos, com a vantagem elemental amplificada igual). Converte
 *  em quantos kills a vida cheia aguenta e no tempo que sobra cacando.
 *  `combatS` = segundos de PORRADA por kill; `ttkS` = ciclo cheio (com o overhead, em que
 *  voce nao esta apanhando). Sua vida so anda no combate; o desmaio custa a hora inteira. */
export function threatOf(
  species: Species, level: number, ivs: number[], quality: number,
  e: EnemyCombat, enemyMoves: Move[], combatS: number, ttkS: number,
): Threat {
  const hp = projectStat(species.bases[0], ivs[0], level, quality, 0); // seu HP NAO leva o x5 do wild
  const def = projectStat(species.bases[2], ivs[2], level, quality, 2);
  const spDef = projectStat(species.bases[4], ivs[4], level, quality, 4);

  let worst: { mv: Move; eff: number; dmg: number; dps: number } | null = null;
  let totalDps = 0; // o wild tambem dispara o moveset inteiro, nao so o pior golpe
  for (const mv of enemyMoves) {
    if (mv.power <= 0 || mv.learn > e.huntLevel || mv.cooldownMs <= 0) continue;
    if (mv.tm) continue; // TM e coisa de jogador: o wild bate so com o moveset natural
    const eff = huntEffectiveness(mv.type, species.t1, species.t2);
    if (eff <= 0) continue; // voce e imune a esse golpe
    const stab = mv.type === e.t1 || mv.type === e.t2 ? 1.5 : 1;
    const off = mv.category === "SPECIAL" ? e.spAtk : e.atk;
    const d = mv.category === "SPECIAL" ? spDef : def;
    const dmg = hitDamage(mv.power, off, d, stab, eff);
    const dps = dmg / (mv.cooldownMs / 1000);
    totalDps += dps;
    if (!worst || dps > worst.dps) worst = { mv, eff, dmg, dps };
  }
  if (!worst || totalDps <= 0) return NO_THREAT;

  const ttdS = Math.min(CAP_KILLS, hp / totalDps);
  const killsPerLife = Math.min(CAP_KILLS, ttdS / Math.max(0.1, combatS));
  // vida em tempo de relogio ate cair, e o quanto da hora sobra depois da parada da Joy
  const lifeS = killsPerLife * ttkS;
  const uptime = killsPerLife >= SAFE_KILLS ? 1 : lifeS / (lifeS + DEATH_COST_S);
  return {
    moveType: worst.mv.type, category: worst.mv.category, eff: worst.eff,
    hitDmg: Math.round(worst.dmg * 10) / 10,
    ttdS: Math.round(ttdS * 10) / 10,
    killsPerLife: Math.round(killsPerLife * 10) / 10,
    uptime: Math.round(uptime * 1000) / 1000,
    risk: riskOf(killsPerLife),
  };
}

/** Estimativa de rendimento contra um alvo: velocidade de kill x sobrevivencia ->
 *  KOs/h, XP/h e ouro/h EFETIVOS. null = voce nao consegue nem machucar o alvo. */
export function estimateHunt(
  species: Species,
  level: number,
  ivs: number[],
  quality: number,
  e: EnemyCombat,
  enemyMoves: Move[],
  vip: boolean,
  pool: MovePool = "natural",
): HuntEstimate | null {
  const bm = movesetDps(species, level, ivs, quality, e, pool);
  if (!bm) return null;
  const hits = Math.max(1, Math.ceil(e.hp / bm.dmg));
  const combatS = e.hp / bm.total;
  const ttkS = combatS + OVERHEAD_S;
  const threat = threatOf(species, level, ivs, quality, e, enemyMoves, combatS, ttkS);
  const kosH = (3600 / ttkS) * threat.uptime;
  return {
    moveName: bm.mv.type,
    category: bm.mv.category,
    eff: bm.eff,
    hits,
    ttkS: Math.round(ttkS * 10) / 10,
    dps: bm.total,
    kosH,
    xpH: e.xp * kosH * (vip ? 1.5 : 1),
    goldH: e.goldEV * kosH,
    threat,
  };
}

/** Stats de combate do wild no huntLevel (baseline de captura). HP ja reforcado (x5);
 *  atk/spAtk sao o lado OFENSIVO dele — e com eles que o threatOf te mata. */
export function enemyCombatStats(bases: number[], huntLevel: number): { hp: number; def: number; spDef: number; atk: number; spAtk: number } {
  return {
    hp: projectStat(bases[0], WILD_IV, huntLevel, WILD_Q, 0) * WILD_HP_MULT,
    def: projectStat(bases[2], WILD_IV, huntLevel, WILD_Q, 2),
    spDef: projectStat(bases[4], WILD_IV, huntLevel, WILD_Q, 4),
    atk: projectStat(bases[1], WILD_IV, huntLevel, WILD_Q, 1),
    spAtk: projectStat(bases[3], WILD_IV, huntLevel, WILD_Q, 3),
  };
}

export type RouteMode = "xp" | "gold";

// Alcance de nivel: voce caca em torno do seu nivel (sem limite pra baixo, margem pra
// cima). Impede rota mandar um lvl 48 pra uma hunt lvl 150, e deixa alvos super-efetivos
// um pouco acima ao alcance. Acima disso o wild fica tanky demais (kill-speed ja pune).
// Quem barra o alvo alto que TE MATA e a sobrevivencia, nao esse teto.
export const reachOf = (level: number): number => level + Math.max(8, level * 0.15);

export interface RoutePick {
  score: number;
  enemy: EnemyCombat;
  est: HuntEstimate;
}

/** Melhor alvo pro nivel dado. Alvo "deadly" (voce cai antes de 2 kills) NAO entra —
 *  fica so como ultimo recurso, pra rota nunca voltar vazia quando nada e seguro. */
export function pickHunt(
  species: Species,
  level: number,
  ivs: number[],
  quality: number,
  enemies: EnemyCombat[],
  movesOf: MovesOf,
  mode: RouteMode,
  vip: boolean,
  skip?: (e: EnemyCombat) => boolean,
  pool: MovePool = "natural",
): RoutePick | null {
  const reach = reachOf(level);
  let best: RoutePick | null = null;
  let lastResort: RoutePick | null = null;
  for (const e of enemies) {
    if (e.huntLevel > reach) continue;
    if (skip?.(e)) continue;
    const est = estimateHunt(species, level, ivs, quality, e, movesOf(e.pokeId), vip, pool);
    if (!est) continue;
    const score = mode === "gold" ? est.goldH : est.xpH;
    const pick: RoutePick = { score, enemy: e, est };
    if (est.threat.risk === "deadly") {
      if (!lastResort || score > lastResort.score) lastResort = pick;
      continue;
    }
    if (!best || score > best.score) best = pick;
  }
  return best ?? lastResort;
}

export interface RouteStep {
  from: number;
  to: number;
  enemy: EnemyCombat;
  est: HuntEstimate;
}

/** Rota do nivel `start` ao `target` com a especie ESCOLHIDA (sem evoluir/voltar).
 *  Em cada nivel pega a hunt de maior XP/h (ou ouro/h) EFETIVO dentro do alcance; so troca
 *  de hunt quando a nova ganha da atual por margem (>8%), pra as faixas ficarem limpas.
 *  Sai da faixa na hora se a hunt atual virar "deadly" (o wild cresce, voce nao). */
export function buildRoute(
  species: Species,
  start: number,
  target: number,
  enemies: EnemyCombat[],
  movesOf: MovesOf,
  quality: number,
  ivs: number[],
  mode: RouteMode = "xp",
  vip = false,
  pool: MovePool = "natural",
): RouteStep[] {
  const steps: RouteStep[] = [];
  const s = Math.max(1, Math.floor(start));
  const t = Math.max(s + 1, Math.floor(target));
  const SWITCH_MARGIN = 1.08;

  for (let lvl = s; lvl <= t; lvl++) {
    const p = pickHunt(species, lvl, ivs, quality, enemies, movesOf, mode, vip, undefined, pool);
    if (!p) continue;
    const last = steps[steps.length - 1];
    if (last) {
      // rendimento do alvo ATUAL neste nivel — so troca se o novo ganha por margem.
      const curEst = estimateHunt(species, lvl, ivs, quality, last.enemy, movesOf(last.enemy.pokeId), vip, pool);
      const curScore = curEst ? (mode === "gold" ? curEst.goldH : curEst.xpH) : 0;
      const curSafe = curEst != null && (curEst.threat.risk !== "deadly" || p.est.threat.risk === "deadly");
      if (curEst && curSafe && p.score <= curScore * SWITCH_MARGIN) {
        last.to = lvl;
        last.est = curEst; // atualiza o rendimento pro nivel corrente da faixa
        continue;
      }
    }
    steps.push({ from: lvl, to: lvl, enemy: p.enemy, est: p.est });
  }
  return steps;
}
