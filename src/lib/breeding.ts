// Motor de breeding do Poke Idle World. As regras da ESPECIE nao vem no JSON do
// jogo (camada curada — ver piwdex.md). Regras confirmadas do jogo; as provisorias
// ficam marcadas na UI e nao sao "inventadas" aqui (ver o tutorial em breed-tool).
//
//   - Pais da mesma especie, diferenca de Quality <= 0.150.
//   - Quality com 3 casas; filho parte da MAIOR Quality entre os pais + um ganho.
//   - Filho herda a distribuicao COMPLETA de IVs do pai de maior Quality; empate -> Slot 1.
//   - Custo base R$ 2.000.000 + 20 Evolution Stones (tipo duplo divide igual).
//   - Double Stones: 40 Stones, 5% de +1 IV num stat aleatorio abaixo de 32.
//   - Ao menos um pai Shiny -> filho Shiny (mantem a heranca de IV). Normal tem Q max 2.600.

import type { PokeType } from "./types";

export const IV_MAX = 32;
export const IV_MAX_TOTAL = 192; // 32 x 6
export const QUALITY_MAX_NORMAL = 2.6;
export const QUALITY_DIFF_MAX = 0.15;

export const BASE_COST = 2_000_000;
export const BASE_STONES = 20;
export const DOUBLE_STONES = 40;
export const DOUBLE_STONE_IV_CHANCE = 0.05; // 5% de +1 IV num stat < 32
export const SPONTANEOUS_SHINY_CHANCE = 0.05; // 2 pais normais (provisorio)
export const PHEROMONE_NORMAL_COUNT = 9; // Strange Pheromones no modo Pheromone

export type BreedMode = "free" | "pheromone";

export interface QualityTier {
  gain: number;
  prob: number;
}

// Distribuicoes de ganho de Quality por modo (do jogo).
export const FREE_TIERS: QualityTier[] = [
  { gain: 0.005, prob: 0.5 },
  { gain: 0.01, prob: 0.35 },
  { gain: 0.02, prob: 0.12 },
  { gain: 0.04, prob: 0.03 },
];
export const PHEROMONE_TIERS: QualityTier[] = [
  { gain: 0.15, prob: 0.5 },
  { gain: 0.2, prob: 0.3 },
  { gain: 0.25, prob: 0.15 },
  { gain: 0.3, prob: 0.05 },
];

export function tiersFor(mode: BreedMode): QualityTier[] {
  return mode === "free" ? FREE_TIERS : PHEROMONE_TIERS;
}

/** Ganho esperado (media ponderada) de Quality por modo. */
export function expectedGain(mode: BreedMode): number {
  return round4(tiersFor(mode).reduce((a, t) => a + t.gain * t.prob, 0));
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// Pokemon salvo na colecao local (localStorage).
export interface BreedMon {
  id: string;
  pokeId: number;
  name: string; // apelido ou nome da especie
  species: string; // nome da especie (para agrupar)
  type1: PokeType;
  type2: PokeType | null;
  quality: number; // 3 casas
  ivs: number[]; // 6, ordem STAT_KEYS, 0..32
  shiny: boolean;
  createdAt: number;
}

export function ivTotal(ivs: number[]): number {
  return ivs.reduce((a, b) => a + b, 0);
}

export interface Compat {
  ok: boolean;
  reasons: string[]; // chaves i18n
  sameSpecies: boolean;
  qualityDiff: number;
}

/** Valida o par: mesma especie + diferenca de Quality <= 0.150. */
export function checkCompat(a: BreedMon | null, b: BreedMon | null): Compat {
  if (!a || !b) return { ok: false, reasons: ["breed.invalid.fill"], sameSpecies: false, qualityDiff: 0 };
  const reasons: string[] = [];
  const sameSpecies = a.pokeId === b.pokeId;
  if (!sameSpecies) reasons.push("breed.invalid.species");
  const qualityDiff = round3(Math.abs(a.quality - b.quality));
  if (qualityDiff > QUALITY_DIFF_MAX + 1e-9) reasons.push("breed.invalid.quality");
  return { ok: reasons.length === 0, reasons, sameSpecies, qualityDiff };
}

/** Pai que doa a distribuicao de IVs: maior Quality; empate -> Slot 1 (a). */
export function inheritingParent(a: BreedMon, b: BreedMon): "a" | "b" {
  return b.quality > a.quality ? "b" : "a";
}

export interface QualityOutcome {
  gain: number;
  prob: number;
  quality: number; // ja com teto aplicado (normal)
  capped: boolean;
}

export interface CostBreakdown {
  money: number;
  stones: number;
  stonesPerType: number;
  types: number; // 1 ou 2
  pheromones: number;
}

export interface EggProjection {
  shinyGuaranteed: boolean;
  spontaneousShinyChance: number; // 0 ou 0.05
  ivs: number[];
  ivTotal: number;
  fromParent: "a" | "b";
  baseQuality: number; // maior Quality entre os pais
  cap: number | null; // 2.600 normal, null shiny (Quality bruta)
  outcomes: QualityOutcome[];
  minQuality: number;
  maxQuality: number;
  expectedQuality: number;
  anyCapped: boolean;
  doubleStoneEligible: number[]; // indices de stats < 32
  cost: CostBreakdown;
}

/** Projeta o ovo de um par valido no modo/opcao escolhidos. */
export function projectEgg(a: BreedMon, b: BreedMon, mode: BreedMode, doubleStones: boolean): EggProjection {
  const shinyGuaranteed = a.shiny || b.shiny;
  const spontaneousShinyChance = !a.shiny && !b.shiny ? SPONTANEOUS_SHINY_CHANCE : 0;
  const from = inheritingParent(a, b);
  const parent = from === "a" ? a : b;
  const ivs = [...parent.ivs];
  const cap = shinyGuaranteed ? null : QUALITY_MAX_NORMAL; // Shiny fica com Quality bruta
  const base = Math.max(a.quality, b.quality);

  const outcomes: QualityOutcome[] = tiersFor(mode).map((t) => {
    const raw = base + t.gain;
    const q = cap != null ? Math.min(raw, cap) : raw;
    return { gain: t.gain, prob: t.prob, quality: round3(q), capped: cap != null && raw > cap + 1e-9 };
  });

  const minQuality = Math.min(...outcomes.map((o) => o.quality));
  const maxQuality = Math.max(...outcomes.map((o) => o.quality));
  const expectedQuality = round3(outcomes.reduce((s, o) => s + o.quality * o.prob, 0));
  const anyCapped = outcomes.some((o) => o.capped);
  const doubleStoneEligible = doubleStones
    ? ivs.map((v, i) => (v < IV_MAX ? i : -1)).filter((i) => i >= 0)
    : [];

  const stones = doubleStones ? DOUBLE_STONES : BASE_STONES;
  const types = parent.type2 ? 2 : 1;
  const cost: CostBreakdown = {
    money: BASE_COST,
    stones,
    stonesPerType: stones / types,
    types,
    pheromones: mode === "pheromone" ? PHEROMONE_NORMAL_COUNT : 0,
  };

  return {
    shinyGuaranteed,
    spontaneousShinyChance,
    ivs,
    ivTotal: ivTotal(ivs),
    fromParent: from,
    baseQuality: round3(base),
    cap,
    outcomes,
    minQuality,
    maxQuality,
    expectedQuality,
    anyCapped,
    doubleStoneEligible,
    cost,
  };
}

// ---- Planejador de Quality (feature propria do piwdex) ----
// Do Q atual ate um alvo: quantos breeds (pela media de ganho), custo estimado e
// os dois riscos do jogo — passar de 0.150 num passo (perde o par) e estourar 2.600.

const MAX_GAIN: Record<BreedMode, number> = { free: 0.04, pheromone: 0.3 };

export interface PlanLine {
  mode: BreedMode;
  breeds: number; // estimativa pela media
  money: number;
  stones: number;
  pheromones: number;
  maxStepGain: number;
  orphanRisk: boolean; // um ganho pode passar de 0.150 e orfar o filho na leva
  capWaste: boolean; // rolls altos passam do teto 2.600
}

export interface QualityPlan {
  base: number;
  target: number;
  cap: number | null;
  effectiveTarget: number;
  delta: number;
  reached: boolean;
  free: PlanLine;
  pheromone: PlanLine;
}

function planLine(base: number, effTarget: number, mode: BreedMode, shiny: boolean): PlanLine {
  const delta = Math.max(0, effTarget - base);
  const breeds = delta <= 1e-9 ? 0 : Math.ceil(delta / expectedGain(mode));
  const maxStepGain = MAX_GAIN[mode];
  return {
    mode,
    breeds,
    money: breeds * BASE_COST,
    stones: breeds * BASE_STONES,
    pheromones: mode === "pheromone" ? breeds * PHEROMONE_NORMAL_COUNT : 0,
    maxStepGain,
    orphanRisk: maxStepGain > QUALITY_DIFF_MAX + 1e-9,
    capWaste: !shiny && base + maxStepGain > QUALITY_MAX_NORMAL + 1e-9,
  };
}

export function planQuality(base: number, target: number, shiny: boolean): QualityPlan {
  const cap = shiny ? null : QUALITY_MAX_NORMAL;
  const effectiveTarget = cap != null ? Math.min(target, cap) : target;
  const delta = round3(Math.max(0, effectiveTarget - base));
  return {
    base: round3(base),
    target: round3(target),
    cap,
    effectiveTarget: round3(effectiveTarget),
    delta,
    reached: delta <= 1e-9,
    free: planLine(base, effectiveTarget, "free", shiny),
    pheromone: planLine(base, effectiveTarget, "pheromone", shiny),
  };
}
