// Cores e efetividade de tipo. As cores sao as canonicas (Bulbapedia); ficam como
// tokens de dado (acento por tipo), separados do acento de UI.

import type { PokeType, Rarity } from "./types";

export const TYPE_COLOR: Record<PokeType, string> = {
  NORMAL: "#9099a1", FIRE: "#ff9d55", WATER: "#5090d6", ELECTRIC: "#f4d23c",
  GRASS: "#63bc5a", ICE: "#73cec0", FIGHTING: "#ce4069", POISON: "#ab6ac8",
  GROUND: "#d97845", FLYING: "#8fa9de", PSYCHIC: "#fa7179", BUG: "#90c12c",
  ROCK: "#c7b78b", GHOST: "#5269ac", DRAGON: "#0b6dc3", DARK: "#5a5366",
  STEEL: "#5a8ea1", FAIRY: "#ec8fe6",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: "#9ca3af", UNCOMMON: "#4ade80", RARE: "#38bdf8",
  EPIC: "#c084fc", LEGENDARY: "#fbbf24", MYTHIC: "#fb7185",
};

export const RARITY_ORDER: Rarity[] = [
  "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC",
];

export const ALL_TYPES: PokeType[] = [
  "NORMAL", "FIRE", "WATER", "ELECTRIC", "GRASS", "ICE", "FIGHTING", "POISON",
  "GROUND", "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "DARK",
  "STEEL", "FAIRY",
];

// Multiplicador do ATACANTE (linha) contra o DEFENSOR (coluna). Ausente = 1x.
const CHART: Partial<Record<PokeType, Partial<Record<PokeType, number>>>> = {
  NORMAL: { ROCK: 0.5, GHOST: 0, STEEL: 0.5 },
  FIRE: { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 2, BUG: 2, ROCK: 0.5, DRAGON: 0.5, STEEL: 2 },
  WATER: { FIRE: 2, WATER: 0.5, GRASS: 0.5, GROUND: 2, ROCK: 2, DRAGON: 0.5 },
  ELECTRIC: { WATER: 2, ELECTRIC: 0.5, GRASS: 0.5, GROUND: 0, FLYING: 2, DRAGON: 0.5 },
  GRASS: { FIRE: 0.5, WATER: 2, GRASS: 0.5, POISON: 0.5, GROUND: 2, FLYING: 0.5, BUG: 0.5, ROCK: 2, DRAGON: 0.5, STEEL: 0.5 },
  ICE: { FIRE: 0.5, WATER: 0.5, GRASS: 2, ICE: 0.5, GROUND: 2, FLYING: 2, DRAGON: 2, STEEL: 0.5 },
  FIGHTING: { NORMAL: 2, ICE: 2, POISON: 0.5, FLYING: 0.5, PSYCHIC: 0.5, BUG: 0.5, ROCK: 2, GHOST: 0, DARK: 2, STEEL: 2, FAIRY: 0.5 },
  POISON: { GRASS: 2, POISON: 0.5, GROUND: 0.5, ROCK: 0.5, GHOST: 0.5, STEEL: 0, FAIRY: 2 },
  GROUND: { FIRE: 2, ELECTRIC: 2, GRASS: 0.5, POISON: 2, FLYING: 0, BUG: 0.5, ROCK: 2, STEEL: 2 },
  FLYING: { ELECTRIC: 0.5, GRASS: 2, FIGHTING: 2, BUG: 2, ROCK: 0.5, STEEL: 0.5 },
  PSYCHIC: { FIGHTING: 2, POISON: 2, PSYCHIC: 0.5, DARK: 0, STEEL: 0.5 },
  BUG: { FIRE: 0.5, GRASS: 2, FIGHTING: 0.5, POISON: 0.5, FLYING: 0.5, PSYCHIC: 2, GHOST: 0.5, DARK: 2, STEEL: 0.5, FAIRY: 0.5 },
  ROCK: { FIRE: 2, ICE: 2, FIGHTING: 0.5, GROUND: 0.5, FLYING: 2, BUG: 2, STEEL: 0.5 },
  GHOST: { NORMAL: 0, PSYCHIC: 2, GHOST: 2, DARK: 0.5 },
  DRAGON: { DRAGON: 2, STEEL: 0.5, FAIRY: 0 },
  DARK: { FIGHTING: 0.5, PSYCHIC: 2, GHOST: 2, DARK: 0.5, FAIRY: 0.5 },
  STEEL: { FIRE: 0.5, WATER: 0.5, ELECTRIC: 0.5, ICE: 2, ROCK: 2, STEEL: 0.5, FAIRY: 2 },
  FAIRY: { FIRE: 0.5, FIGHTING: 2, POISON: 0.5, DRAGON: 2, DARK: 2, STEEL: 0.5 },
};

const one = (atk: PokeType, def: PokeType): number => CHART[atk]?.[def] ?? 1;

/** Multiplicador de um tipo atacante contra um defensor de 1 ou 2 tipos. */
export function effectiveness(atk: PokeType, def1: PokeType, def2: PokeType | null): number {
  return one(atk, def1) * (def2 ? one(atk, def2) : 1);
}

/** Agrupa todos os 18 tipos pelo dano que causam a este defensor. */
export function defensiveProfile(def1: PokeType, def2: PokeType | null) {
  const weak: PokeType[] = [];
  const resist: PokeType[] = [];
  const immune: PokeType[] = [];
  for (const atk of ALL_TYPES) {
    const m = effectiveness(atk, def1, def2);
    if (m === 0) immune.push(atk);
    else if (m > 1) weak.push(atk);
    else if (m < 1) resist.push(atk);
  }
  return { weak, resist, immune };
}
