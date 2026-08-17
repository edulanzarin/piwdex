// Mercado pontuado (com preco justo) a partir de tokens, pro worker de alertas.
// Mesmo motor da rota /api/market, mas sem o cache de 60s dela (o scan roda no seu
// proprio ritmo). Server-only.

import { gameFetch, type Tokens } from "./game-auth";
import { getData } from "./data";
import { normalizeMarketMons, type MarketMon } from "./game-account";
import { monCeiling, buildPriceModel, fairPriceOf, type PriceItem } from "./market-value";

export interface ScoredMarket {
  mons: MarketMon[]; // cada um com fairPrice preenchido
  tokens: Tokens;
  changed: boolean;
}

export async function fetchScoredMarket(initial: Tokens): Promise<ScoredMarket | null> {
  const r = await gameFetch("/api/game/market", initial);
  if (!r.res.ok) return null;
  const raw = await r.res.json().catch(() => null);
  const { creatures } = await getData();

  const basesById = new Map<number, number[]>();
  for (const c of creatures)
    basesById.set(c.pokeId, [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed]);
  const ceilOf = (m: MarketMon) => monCeiling(basesById.get(m.speciesId), m.ivTotal, m.quality);

  const mons = normalizeMarketMons(raw, creatures);
  const toItem = (m: MarketMon): PriceItem => ({
    speciesId: m.speciesId, currency: m.currency, price: m.price, ceil: ceilOf(m),
    quality: m.quality, shiny: m.shiny,
  });
  const model = buildPriceModel(mons.map(toItem));
  const scored = mons.map((m) => ({ ...m, fairPrice: fairPriceOf(toItem(m), model) }));

  return { mons: scored, tokens: r.tokens, changed: r.changed };
}
