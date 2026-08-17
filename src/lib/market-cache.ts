// Cache global do mercado + regua de preco justo — compartilhado entre o consultor
// (/api/market) e a avaliacao de bicho SEM preco (/api/vip/value, o chip do chat).
// O mercado e global e pesa ~6MB; cacheia os anuncios de pokemon por 60s pra nao
// rebaixar a cada busca. Qualquer token valido puxa o mesmo mercado.

import { gameFetch, type Tokens } from "./game-auth";
import { getData } from "./data";
import { normalizeMarketMons, type MarketMon } from "./game-account";
import { buildPriceModel, monCeiling, type PriceItem, type PriceModel } from "./market-value";

let cache: { at: number; mons: MarketMon[] } | null = null;
const TTL = 60_000;

export async function loadMarket(tokens: Tokens): Promise<{ mons?: MarketMon[]; status: number; tokens: Tokens; changed: boolean }> {
  if (cache && Date.now() - cache.at < TTL) return { mons: cache.mons, status: 200, tokens, changed: false };
  const r = await gameFetch("/api/game/market", tokens);
  if (!r.res.ok) return { status: r.res.status, tokens: r.tokens, changed: r.changed };
  const raw = await r.res.json().catch(() => null);
  const { creatures } = await getData();
  const mons = normalizeMarketMons(raw, creatures);
  cache = { at: Date.now(), mons };
  return { mons, status: 200, tokens: r.tokens, changed: r.changed };
}

// Regua de preco do mercado INTEIRO (mediana de preco-por-teto por especie+moeda, com
// fallback global) + teto por anuncio. Ver o motor em market-value.ts.
export async function marketPriceModel(mons: MarketMon[]): Promise<{
  model: PriceModel;
  ceilOf: (m: MarketMon) => number | null;
  basesById: Map<number, number[]>;
}> {
  const { creatures } = await getData();
  const basesById = new Map<number, number[]>();
  for (const c of creatures) basesById.set(c.pokeId, [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed]);
  const ceilOf = (m: MarketMon) => monCeiling(basesById.get(m.speciesId), m.ivTotal, m.quality);
  const model = buildPriceModel(
    mons.map<PriceItem>((m) => ({
      speciesId: m.speciesId, currency: m.currency, price: m.price, ceil: ceilOf(m),
      quality: m.quality, shiny: m.shiny,
    })),
  );
  return { model, ceilOf, basesById };
}
