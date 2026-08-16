import { RARITY_ORDER } from "./typing";
import type { Rarity } from "./types";
import type { ActivePoke } from "./game-account";

// Travas da venda de pokemon (piw:poke-sell-config:v2). Vive num modulo proprio porque
// TRES lugares aplicam as MESMAS regras e nao podem divergir: a simulacao manual
// (/api/vip/shop sim-pokes), a venda manual e a venda automatica 24/7 (robo). Venda de
// pokemon e irreversivel — a regra de "o que pode vender" tem que ser uma so.

export interface PokeSellConfig {
  sellRarities: Rarity[]; // raridades que PODEM ser vendidas (o resto nunca)
  keepShiny: boolean; // nunca vender shiny
  maxIv: number; // 0..192, so vende IV total <= maxIv
  maxQuality: number; // decimal, so vende quality <= maxQuality
}

// Validacao server-side do que o cliente manda. Defaults SEGUROS: sem raridade marcada
// e maxIv/maxQuality 0 => nao vende nada; keepShiny liga por padrao.
export function parsePokeSellCfg(raw: unknown): PokeSellConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rar = Array.isArray(c.sellRarities)
    ? c.sellRarities.filter((r): r is Rarity => RARITY_ORDER.includes(r as Rarity))
    : [];
  return {
    sellRarities: rar,
    keepShiny: c.keepShiny !== false,
    maxIv: typeof c.maxIv === "number" ? c.maxIv : 0,
    maxQuality: typeof c.maxQuality === "number" ? c.maxQuality : 0,
  };
}

// Aplica as travas na lista viva e devolve o que SERIA/SERA vendido. Guarda-costas duro:
// NUNCA time/lider/starter, nunca shiny se keepShiny. rarityOf resolve a raridade por
// especie (a lista viva nao traz raridade). Ordena do pior pro melhor (quality, depois IV).
export function filterSellable(
  pokes: ActivePoke[],
  cfg: PokeSellConfig,
  rarityOf: (speciesId: number) => Rarity,
): (ActivePoke & { rarity: Rarity })[] {
  return pokes
    .filter((p) => !p.team && !p.leader && !p.starter)
    .filter((p) => !(cfg.keepShiny && p.shiny))
    .map((p) => ({ ...p, rarity: rarityOf(p.speciesId) }))
    .filter((p) => cfg.sellRarities.includes(p.rarity))
    .filter((p) => p.ivTotal <= cfg.maxIv && p.quality <= cfg.maxQuality)
    .sort((a, b) => a.quality - b.quality || a.ivTotal - b.ivTotal);
}
