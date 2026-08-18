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

// Como a config e SALVA no banco (robot_sessions.poke_sell_cfg): as travas + o interruptor.
// Desligar a venda NAO apaga as travas — so vira on:false. `on` ausente = ligado (config
// gravada antes do campo existir era, por definicao, uma venda ativa).
export type SavedPokeSellCfg = PokeSellConfig & { on?: boolean };

// Travas padrao (as mesmas do card de Configuracoes): so comum/uncommon, nunca shiny,
// IV/qualidade baixos. Usadas quando o usuario liga a venda sem nunca ter mexido nas travas.
export const DEFAULT_POKE_SELL: PokeSellConfig = { sellRarities: ["COMMON", "UNCOMMON"], keepShiny: true, maxIv: 100, maxQuality: 1.8 };

// A config salva representa uma venda LIGADA e utilizavel?
export function pokeSellOn(cfg: SavedPokeSellCfg | null | undefined): cfg is SavedPokeSellCfg {
  return !!cfg && cfg.on !== false && Array.isArray(cfg.sellRarities) && cfg.sellRarities.length > 0;
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
    // cadeado do jogador e sellValue 0: o JOGO recusa (400) — o cliente oficial exclui
    // os dois antes de vender, a gente tambem (um travado no lote derruba o lote inteiro)
    .filter((p) => !p.locked && p.sellValue > 0)
    .filter((p) => !(cfg.keepShiny && p.shiny))
    .map((p) => ({ ...p, rarity: rarityOf(p.speciesId) }))
    .filter((p) => cfg.sellRarities.includes(p.rarity))
    .filter((p) => p.ivTotal <= cfg.maxIv && p.quality <= cfg.maxQuality)
    .sort((a, b) => a.quality - b.quality || a.ivTotal - b.ivTotal);
}
