import { RARITY_ORDER } from "./typing";
import { RARITY_LABEL } from "./labels";
import type { Rarity } from "./types";

/**
 * O endereco de uma raridade, em portugues.
 *
 * Mesma razao dos hubs de tipo (ver `tipo-url.ts`): a dex filtra por raridade,
 * mas por parametro de busca, e ninguem chega ali por uma consulta. "pokemon
 * lendario poke idle world" e pergunta de gente que joga, e nao tinha pagina.
 *
 * Slug sem acento: `lendario`, nao `lendário`. Acento em URL vira escape e
 * quebra o copiar-e-colar.
 */
const SLUG: Record<Rarity, string> = {
  COMMON: "comum",
  UNCOMMON: "incomum",
  RARE: "raro",
  EPIC: "epico",
  LEGENDARY: "lendario",
  MYTHIC: "mitico",
};

/** O plural, que e como a frase e o titulo pedem — "os 9 lendarios". */
const PLURAL: Record<Rarity, string> = {
  COMMON: "comuns",
  UNCOMMON: "incomuns",
  RARE: "raros",
  EPIC: "épicos",
  LEGENDARY: "lendários",
  MYTHIC: "míticos",
};

const POR_SLUG = new Map<string, Rarity>(RARITY_ORDER.map((r) => [SLUG[r], r] as const));

export const slugDaRaridade = (r: Rarity): string => SLUG[r];
export const raridadeDoSlug = (s: string): Rarity | null => POR_SLUG.get(s.toLowerCase()) ?? null;
export const caminhoDaRaridade = (r: Rarity): string => `/dex/raridade/${SLUG[r]}`;
export const nomeDaRaridade = (r: Rarity): string => RARITY_LABEL[r];
export const pluralDaRaridade = (r: Rarity): string => PLURAL[r];

export const TODOS_SLUGS_RARIDADE: string[] = RARITY_ORDER.map((r) => SLUG[r]);
