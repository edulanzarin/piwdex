// Retorno dos bonus de loot. O que decide onde o boost paga NAO e quanto ouro o
// spot da — e quanta FOLGA sobra ate o teto de chance.
//
// A fonte trava a chance em 0..100000 (100%) e os bonus de loot MULTIPLICAM essa
// chance. Nas hunts de nivel alto os drops comuns ja nascem em 95.000 (95%): 157
// das 2.657 entradas de loot do catalogo estao exatamente nesse valor. Um +40% em
// cima de 95% vira 100% (ganha 5%); o mesmo +40% em cima de 0,433% vira 0,606%
// (ganha 40% inteiros). Por isso a metrica util e o APROVEITAMENTO — que fracao do
// bonus que voce pagou o alvo consegue de fato converter em ouro.

import type { LootEntry, PokeType } from "./types";

/** Escala da fonte: 100000 = 100%. Tambem e o teto — chance nao passa disso. */
export const CHANCE_MAX = 100_000;

/** Streak Points: +0,1% de chance por ponto investido na trilha Loot. */
export const STREAK_STEP = 0.001;
/** Loot Boost (Loja de Diamantes): +40% de chance de loot enquanto ativo. */
export const LOOT_BOOST = 0.4;
/** Cada ponto de Streak custa 25.000 x o numero do ponto (1o = 25k, 2o = 50k...). */
export const STREAK_POINT_COST = 25_000;
/** 1 ponto de Streak liberado a cada 1000 abates totais. */
export const KILLS_PER_POINT = 1000;
/**
 * Tipo do Dia: bonus de loot (e de XP) que vale SO nos pokemons do tipo premiado. E a
 * diferenca que muda a conta: os outros bonus valem em qualquer alvo, este e um
 * bonus CONDICIONAL. Tratar como percentual global inflava o ganho do catalogo
 * inteiro e mandava caçar no lugar errado nos dias em que o tipo nao batia.
 *
 * Este numero e so o PADRAO de quem nao tem conta conectada. O jogo publica o valor do
 * dia em /api/game/boosts ("+20% de XP e +20% de loot em Pokemon do tipo Sombrio", lido
 * com token real em ago/2026) e quem le de la manda: ver `typeDayPct` abaixo. O 0,5 que
 * ficava aqui era palpite e inflava em 2,5x o ganho prometido pelo bonus.
 */
export const TYPE_DAY_BONUS = 0.2;

export interface LootBonuses {
  /** pontos de Streak na trilha Loot */
  streakLoot: number;
  /** Loot Boost de 1h ativo */
  lootBoost: boolean;
  /** percentual de fundo em curso (evento global, boost temporario ativo), em % */
  eventPct: number;
  /** tipo premiado hoje; null = nenhum. So rende nos alvos DESSE tipo. */
  typeDay: PokeType | null;
  /**
   * Quanto o Tipo do Dia paga HOJE, em fracao. O jogo publica esse numero e ele varia;
   * ausente cai em TYPE_DAY_BONUS (o padrao de quem nao tem conta conectada).
   */
  typeDayPct?: number;
}

export const NO_BONUS: LootBonuses = {
  streakLoot: 0,
  lootBoost: false,
  eventPct: 0,
  typeDay: null,
};

/**
 * O multiplicador que incide sobre a chance de cada drop. As fontes somam entre si
 * (o mesmo empilhamento que o jogo mostra no breakdown de ganho: base + streak +
 * boost + vip + event + mentor + typeDay) e o total multiplica.
 *
 * `targetTypes` sao os tipos do ALVO: sem eles o Tipo do Dia nao entra, porque ele
 * so vale em quem e daquele tipo. Chamar sem o alvo devolve o multiplicador "de
 * fundo" — o que vale em qualquer lugar.
 */
export function lootMultiplier(b: LootBonuses, targetTypes: (PokeType | null)[] = []): number {
  const typeDayHits = b.typeDay != null && targetTypes.some((t) => t === b.typeDay);
  return (
    1 +
    b.streakLoot * STREAK_STEP +
    (b.lootBoost ? LOOT_BOOST : 0) +
    b.eventPct / 100 +
    (typeDayHits ? b.typeDayPct ?? TYPE_DAY_BONUS : 0)
  );
}

/** Chance efetiva de um drop sob o multiplicador, ja respeitando o teto. */
export const effectiveChance = (chance: number, mult: number): number =>
  Math.min(CHANCE_MAX, chance * mult);

/** Um drop esta no teto quando o bonus nao consegue mais empurrar a chance. */
export const isCapped = (chance: number, mult: number): boolean =>
  chance * mult >= CHANCE_MAX;

type PriceOf = (itemName: string) => number;

/**
 * Drop com o preco ja resolvido. E a forma que atravessa a fronteira server ->
 * client: o servidor resolve o nome no catalogo uma vez e o cliente recalcula o
 * cenario quantas vezes o usuario quiser, sem carregar a tabela de itens junto.
 */
export interface PricedDrop {
  name: string;
  icon: string;
  chance: number;
  /** quantidade media por drop — (min + max) / 2, ja calculada */
  avg: number;
  price: number;
}

/** Achata o loot cru resolvendo preco e quantidade media; descarta o que nao vende. */
export function pricedDrops(
  loot: LootEntry[],
  priceOf: PriceOf,
  iconOf: (itemName: string) => string,
): PricedDrop[] {
  const out: PricedDrop[] = [];
  for (const l of loot) {
    const price = priceOf(l.name);
    if (price <= 0) continue;
    out.push({
      name: l.name,
      icon: iconOf(l.name),
      chance: l.chance,
      avg: (l.minCount + l.maxCount) / 2,
      price,
    });
  }
  return out;
}

/** Ouro esperado por abate: soma de (chance x quantidade media x preco NPC). */
export function goldPerKill(drops: PricedDrop[], mult = 1): number {
  let gold = 0;
  for (const d of drops) {
    gold += (effectiveChance(d.chance, mult) / CHANCE_MAX) * d.avg * d.price;
  }
  return gold;
}

export interface BoostRoi {
  /** ouro/abate sem nenhum bonus */
  base: number;
  /** ouro/abate com os bonus informados */
  boosted: number;
  /** o que os bonus adicionam por abate */
  delta: number;
  /** delta em % sobre a base */
  gainPct: number;
  /**
   * Aproveitamento: a fracao do bonus que o alvo consegue converter. 1 = o alvo
   * captura o bonus inteiro (todo drop tem folga); 0,1 = 90% do que voce pagou
   * bateu no teto e virou nada. E o numero que ordena a tabela.
   */
  efficiency: number;
  /** ouro/abate que ja nasce no teto — o boost nao alcanca esta parte */
  cappedGold: number;
  /** quantos drops do alvo estao no teto sob este multiplicador */
  cappedDrops: number;
  /** total de drops com valor de venda */
  pricedDrops: number;
  /** multiplicador que valeu NESTE alvo (com ou sem o Tipo do Dia) */
  mult: number;
  /** o alvo e do tipo premiado hoje */
  typeDayHits: boolean;
}

/** Quanto os bonus rendem NESTE alvo — e quanto deles se perde no teto.
 *  `targetTypes` decide se o Tipo do Dia entra: ele so vale no tipo premiado. */
export function boostRoi(drops: PricedDrop[], b: LootBonuses, targetTypes: (PokeType | null)[] = []): BoostRoi {
  const mult = lootMultiplier(b, targetTypes);
  const base = goldPerKill(drops, 1);
  const boosted = goldPerKill(drops, mult);
  const delta = boosted - base;

  let cappedGold = 0;
  let cappedDrops = 0;
  for (const d of drops) {
    if (!isCapped(d.chance, mult)) continue;
    cappedDrops++;
    cappedGold += (d.chance / CHANCE_MAX) * d.avg * d.price;
  }

  // Sem bonus nao ha o que aproveitar; o denominador seria zero.
  const theoretical = base * (mult - 1);
  const efficiency = theoretical > 0 ? delta / theoretical : 0;

  return {
    base,
    boosted,
    delta,
    gainPct: base > 0 ? (delta / base) * 100 : 0,
    efficiency,
    cappedGold,
    cappedDrops,
    pricedDrops: drops.length,
    mult,
    typeDayHits: b.typeDay != null && targetTypes.some((t) => t === b.typeDay),
  };
}

// --- Streak Points -------------------------------------------------------
// A unica trilha de bonus permanente e gratuita (so custa ouro). Vale saber
// quanto custa o proximo ponto e em quantos abates ele se paga no spot escolhido.

/** Pontos que os abates ja liberaram (1 a cada 1000). */
export const streakPointsUnlocked = (totalKills: number): number =>
  Math.floor(totalKills / KILLS_PER_POINT);

/** Custo em ouro do proximo ponto, dado quantos ja foram investidos. */
export const nextStreakCost = (spent: number): number => STREAK_POINT_COST * (spent + 1);

/**
 * Custo total pra sair de `spent` pontos ate `target` (soma da PA). Investir e
 * cada vez mais caro, entao o custo cresce com o quadrado do alvo.
 */
export function streakCostRange(spent: number, target: number): number {
  if (target <= spent) return 0;
  const sum = (n: number) => (n * (n + 1)) / 2;
  return STREAK_POINT_COST * (sum(target) - sum(spent));
}

/**
 * Em quantos abates um investimento de `cost` ouro se paga, dado que ele adiciona
 * `deltaPerKill` de ouro por abate. Infinity quando o ganho e zero (alvo no teto).
 */
export const paybackKills = (cost: number, deltaPerKill: number): number =>
  deltaPerKill > 0 ? cost / deltaPerKill : Infinity;
