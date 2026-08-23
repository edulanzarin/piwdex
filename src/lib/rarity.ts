// Faixas de raridade do jogo. A tabela e a OFICIAL, conferida em
// poke.idleworld.online/pokepedia/systems/quality (nao inventada):
//
//   Quality   | Label
//   < 1.0     | Weak        1.5-1.7 | Epic        3.0-4.0 | Ancient
//   1.0-1.1   | Common      1.7-2.0 | Legendary   4.0+    | Divine
//   1.1-1.3   | Uncommon    2.0-3.0 | Mythic
//   1.3-1.5   | Rare
//
// Mythic/Ancient/Divine (2.0+) NAO saem de captura selvagem comum (teto 1.8) — so
// shiny e breeding chegam la.
//
// ATENCAO aos DOIS eixos que compartilham nomes:
//   - QUALIDADE do INDIVIDUO (esta tabela): o que o jogo mostra no pokemon e no filtro.
//   - RARIDADE da ESPECIE (creatures.json, 6 valores COMMON..MYTHIC): traco do catalogo.
// Em tela de individuo use qualityTier(quality); em tela de especie, a rarity do dex.

import type { Rarity } from "./types";

export type RarityTier =
  | "WEAK" | "COMMON" | "UNCOMMON" | "RARE" | "EPIC"
  | "LEGENDARY" | "MYTHIC" | "ANCIENT" | "DIVINE";

export const TIER_ORDER: RarityTier[] = [
  "WEAK", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "ANCIENT", "DIVINE",
];

/**
 * O PISO de qualidade de cada faixa — a mesma tabela lida ao contrario.
 *
 * Existe porque escolher por faixa e escolher por numero sao a mesma decisao
 * vista de dois lados: a tela pergunta "guardar de EPIC pra cima", e a regra que
 * roda no servidor compara `quality >= 1.5`. Derivar um do outro na mao, em dois
 * lugares, e como as duas tabelas divergem.
 */
export const TIER_MIN: Record<RarityTier, number> = {
  WEAK: 0,
  COMMON: 1.0,
  UNCOMMON: 1.1,
  RARE: 1.3,
  EPIC: 1.5,
  LEGENDARY: 1.7,
  MYTHIC: 2.0,
  ANCIENT: 3.0,
  DIVINE: 4.0,
};

/** Faixa a que uma qualidade pertence (tabela oficial acima). */
export function qualityTier(quality: number): RarityTier {
  if (quality < 1.0) return "WEAK";
  if (quality < 1.1) return "COMMON";
  if (quality < 1.3) return "UNCOMMON";
  if (quality < 1.5) return "RARE";
  if (quality < 1.7) return "EPIC";
  if (quality < 2.0) return "LEGENDARY";
  if (quality < 3.0) return "MYTHIC";
  if (quality < 4.0) return "ANCIENT";
  return "DIVINE";
}

// Paleta das faixas — a MESMA escada do jogo (cinza -> verde -> azul -> roxo -> rosa
// -> dourado -> magenta -> laranja -> branco). Especie e individuo usam esta tabela,
// pra raridade ter uma cor so no site inteiro.
export const TIER_COLOR: Record<RarityTier, string> = {
  WEAK: "#9aa4b2",
  COMMON: "#4ade80",
  UNCOMMON: "#38bdf8",
  RARE: "#a78bfa",
  EPIC: "#f472b6",
  LEGENDARY: "#fbbf24",
  MYTHIC: "#e879f9",
  ANCIENT: "#fb923c",
  DIVINE: "#f1f5f9",
};

/** A raridade da especie (6 valores) e um subconjunto dos nomes das faixas. */
export const rarityTier = (r: Rarity): RarityTier => r as RarityTier;
