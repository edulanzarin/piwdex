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
  // TM: golpe que NAO esta no moveset natural — so entra se o jogador tiver a maquina.
  // A fonte guarda o TIPO da TM (ex.: "PSYCHIC"); ausente = golpe natural. Isso importa
  // muito: TODO golpe de poder 600 do jogo e TM, e um TM chega a valer 10x o DPS do
  // melhor golpe natural. Misturar os dois faz o motor prometer uma velocidade de kill
  // que o jogador nao tem.
  tm: PokeType | null;
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
  // Regiao da especie: null = catalogo base, "orre" = Orre (stats proprios, endgame).
  area: string | null;
  // pokeId da especie que se captura pra chegar nesta. null = ela mesma se captura.
  // Variantes de skin (Brave Blastoise, Tribal Feraligatr) apontam pra base e NAO sao
  // uma linha separada do catalogo; as de Orre apontam pra base mas tem stats proprios.
  captureBase: number | null;
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
  /** So 103 dos 428 itens tem. E o unico texto que diz PRA QUE o item serve
   *  ("estimula os instintos durante o breeding"), entao entra na busca. */
  description?: string;
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
  /** Qual versao da ingestao produziu este arquivo — ver PIPELINE em patches.ts.
   *  Ausente nos snapshots anteriores ao diario, e ai vale 1. E o que impede o
   *  diario de anunciar uma mudanca MINHA de normalizacao como patch do jogo. */
  pipeline?: number;
  /** Quando o JOGO publicou este catalogo (Last-Modified da fonte). E a data que
   *  o diario carimba no patch — `generatedAt` e so a hora em que EU olhei. */
  publicadoEm?: string;
  /** ETag da fonte no momento da captura. */
  versao?: string | null;
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
