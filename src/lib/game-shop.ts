// Loja NPC do jogo: comprar bolas/pocoes, vender drops e vender pokemon. Endpoints
// confirmados por captura de rede (Bearer server-side, 200):
//   GET  /api/game/shop            -> { gold, balls[], items[] } (catalogo + precos)
//   POST /api/game/shop/buy        { ballId, qty } | { itemId, qty }
//   POST /api/game/shop/sell       { items: [{ itemId, qty }] }
//   POST /api/game/pokemon/sell    { pokeIds: [id] } -> { sold, goldGained, gold }
// Server-only. Camada de CAPACIDADE — quem decide o que/quando vender e a rota + worker,
// com guarda-costas (teto, simulacao, armar).

import { gameFetch, gameSend, type Tokens } from "./game-auth";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const GAME = process.env.GAME_HOST || "https://poke.idleworld.online";
const abs = (u: string) => (u.startsWith("http") ? u : `${GAME}${u.startsWith("/") ? "" : "/"}${u}`);

export interface ShopBall { id: number; name: string; priceGold: number; iconUrl: string; catchRate: number }
export interface ShopItem { id: number; name: string; priceGold: number; icon: string; category: string }
export interface ShopCatalog { gold: number; balls: ShopBall[]; items: ShopItem[] }

export async function fetchShop(tokens: Tokens): Promise<{ shop: ShopCatalog; tokens: Tokens; changed: boolean } | null> {
  const r = await gameFetch("/api/game/shop", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const raw = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
  const balls = (Array.isArray(raw?.balls) ? raw!.balls : []) as Record<string, unknown>[];
  const items = (Array.isArray(raw?.items) ? raw!.items : []) as Record<string, unknown>[];
  return {
    shop: {
      gold: num(raw?.gold),
      balls: balls.map((b) => ({ id: num(b.id), name: String(b.name ?? ""), priceGold: num(b.priceGold), iconUrl: abs(String(b.iconUrl ?? "")), catchRate: num(b.catchRate) })),
      items: items.map((i) => ({ id: num(i.id), name: String(i.name ?? ""), priceGold: num(i.priceGold), icon: abs(String(i.icon ?? "")), category: String(i.category ?? "") })),
    },
    tokens: r.tokens,
    changed: r.changed,
  };
}

export interface WriteResult<T = unknown> { ok: boolean; status: number; data: T | null; tokens: Tokens; changed: boolean }

async function send<T = unknown>(path: string, tokens: Tokens, body: unknown): Promise<WriteResult<T>> {
  const r = await gameSend(path, tokens, "POST", body);
  const data = r.res.ok ? ((await r.res.json().catch(() => null)) as T) : null;
  return { ok: r.res.ok, status: r.res.status, data, tokens: r.tokens, changed: r.changed };
}

export const buyBall = (t: Tokens, ballId: number, qty: number) => send("/api/game/shop/buy", t, { ballId, qty });
export const buyItem = (t: Tokens, itemId: number, qty: number) => send("/api/game/shop/buy", t, { itemId, qty });
export const sellItems = (t: Tokens, items: { itemId: number; qty: number }[]) => send("/api/game/shop/sell", t, { items });

export interface SellPokesResult { sold: number; goldGained: number; gold: number }
export const sellPokes = (t: Tokens, pokeIds: string[]) =>
  send<SellPokesResult>("/api/game/pokemon/sell", t, { pokeIds });
