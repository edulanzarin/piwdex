// Tipos do snapshot da fonte-mestra (src/data/piwdex.json).
// Refletem o schema cru do jogo; as derivacoes ficam em data.ts.

export type PokeType =
  | "NORMAL" | "FIRE" | "WATER" | "ELECTRIC" | "GRASS" | "ICE"
  | "FIGHTING" | "POISON" | "GROUND" | "FLYING" | "PSYCHIC" | "BUG"
  | "ROCK" | "GHOST" | "DRAGON" | "DARK" | "STEEL" | "FAIRY";

export type Rarity =
  | "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

export type AttackCategory = "PHYSICAL" | "SPECIAL" | "STATUS";

// Como se consegue o pokemon (derivado, nao vem do jogo):
//  hunt    = tem ponto de caca (map-markers)
//  evo     = nao se caca, mas outro pokemon evolui pra ele
//  special = nao se caca nem evolui pra ele -> loja/cassino/ovo/evento
export type Acquisition = "hunt" | "evo" | "special";

export interface Attack {
  name: string;
  type: PokeType;
  category: AttackCategory;
  power: number;
  cooldownMs: number;
  learnLevel: number;
}

export interface LootEntry {
  name: string;
  chance: number; // escala 0..100000; porcentagem = chance / 1000
  minCount: number;
  maxCount: number;
}

export interface Creature {
  pokeId: number;
  name: string;
  looktype: number;
  description: string;
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
  huntLevel: number;
  evolvesToId: number | null;
  evolveLevel: number | null;
  priceNpc: number;
  sellValue: number;
  experience: number;
  loot: LootEntry[];
  attacks: Attack[];
}

export interface Item {
  id: number;
  name: string;
  icon: string;
  category: string;
  rare: boolean;
  npcPrice: number;
  healAmount?: number;
  revivePct?: number;
  priceGold?: number;
}

export interface Hunt {
  slug: string;
  name: string;
  looktype: number;
  level: number;
  area: string;
  pixel: [number, number];
  range: number[];
}

export interface Snapshot {
  generatedAt: string;
  source: string;
  counts: { creatures: number; items: number; hunts: number };
  map: { w: number; h: number } | null;
  creatures: Creature[];
  items: Item[];
  hunts: Hunt[];
}

// ---- Tipos derivados (montados em data.ts) ----

export interface DropSource {
  creature: Creature;
  chancePct: number; // ja convertido: chance / 1000
  minCount: number;
  maxCount: number;
}

export interface EvolutionStage {
  creature: Creature;
  evolveLevel: number | null; // nivel pra chegar NESTE estagio (null no primeiro)
}
