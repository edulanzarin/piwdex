// Normaliza as respostas da API logada do jogo (formatos verificados com token real):
//  - /api/game/profile   -> resumo do treinador (level, gold, diamonds, catches...)
//  - /api/game/all-pokes  -> seu pokedex agregado por especie+tier ({dexId,name,looktype,tier,count})
//  - /api/game/market     -> mercado; anuncios de pokemon JA vem com ivTotal/quality/power/stats
//  - /api/game/balls      -> catalogo de pokebolas com catchRate
// A conta NAO expoe pokemon individuais (so contagem por tier); os individuais com stats
// aparecem no mercado (quando estao a venda) e no pokemon ativo.

import type { Creature } from "./types";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

export interface Profile {
  name: string;
  level: number;
  gold: number;
  diamonds: number;
  catches: number;
  pokedexCount: number;
  pokedexTotal: number;
  vip: boolean;
  rank: number;
}

export function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    name: str(p.name, "?"),
    level: num(p.level),
    gold: num(p.gold),
    diamonds: num(p.diamonds),
    catches: num(p.totalCatches ?? p.catches),
    pokedexCount: num(p.pokedexCount),
    pokedexTotal: num(p.pokedexTotal),
    vip: Boolean(p.vip ?? p.isVip),
    rank: num(p.rank),
  };
}

export interface DexEntry {
  dexId: number;
  name: string;
  looktype: number;
  tier: string; // A..E (banda de qualidade dos que voce tem)
  count: number;
}

export function normalizePokedex(raw: unknown): DexEntry[] {
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => {
    const o = e as Record<string, unknown>;
    return { dexId: num(o.dexId), name: str(o.name, "?"), looktype: num(o.looktype), tier: str(o.tier, "?"), count: num(o.count) };
  });
}

export type Currency = "GOLD" | "DIAMONDS";

export interface MarketMon {
  listingId: string;
  speciesId: number;
  name: string; // nome da especie (resolvido do catalogo)
  level: number;
  shiny: boolean;
  ivTotal: number | null;
  quality: number | null;
  power: number | null;
  type1: string | null;
  price: number;
  currency: Currency;
  belowNpc: boolean;
  sellers: number;
}

// Extrai os anuncios de POKEMON do /api/game/market, com os stats que o jogo ja fornece.
export function normalizeMarketMons(raw: unknown, creatures: Creature[]): MarketMon[] {
  const listings = (raw as { listings?: unknown })?.listings;
  if (!Array.isArray(listings)) return [];
  const byId = new Map<number, Creature>();
  for (const c of creatures) byId.set(c.pokeId, c);

  const out: MarketMon[] = [];
  for (const l of listings) {
    const o = l as Record<string, unknown>;
    if (str(o.kind).toLowerCase() !== "pokemon") continue;
    const speciesId = num(o.speciesId);
    const species = byId.get(speciesId);
    const currency = str(o.currency).toUpperCase() === "DIAMONDS" ? "DIAMONDS" : "GOLD";
    out.push({
      listingId: str(o.id),
      speciesId,
      name: species?.name ?? (str(o.name).replace(/\s*Lv\.\d+\s*$/i, "") || String(speciesId)),
      level: num(o.level),
      shiny: Boolean(o.shiny),
      ivTotal: o.ivTotal != null ? num(o.ivTotal) : null,
      quality: o.quality != null ? num(o.quality) : null,
      power: o.power != null ? num(o.power) : null,
      type1: (o.type1 as string) ?? species?.type1 ?? null,
      price: num(o.price),
      currency,
      belowNpc: Boolean(o.belowNpc),
      sellers: num(o.sellers, 1),
    });
  }
  return out;
}
