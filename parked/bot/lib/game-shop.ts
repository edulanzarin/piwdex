// Loja NPC do jogo: comprar bolas/pocoes, vender drops e vender pokemon. Endpoints
// confirmados por captura de rede (Bearer server-side, 200):
//   GET  /api/game/shop            -> { gold, balls[], items[] } (catalogo + precos)
//   POST /api/game/shop/buy        { ballId, qty } | { itemId, qty }
//   POST /api/game/shop/sell       { items: [{ itemId, qty }] }
//   POST /api/game/pokemon/sell    { pokeIds: [id] } -> { sold, goldGained, gold }
// Server-only. Camada de CAPACIDADE — quem decide o que/quando vender e a rota + worker,
// com guarda-costas (teto, simulacao, armar).

import { gameFetch, gameSend, type Tokens } from "./game-auth";
import { GAME_HOST, gameAssetUrl } from "./game-host";

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

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
      balls: balls.map((b) => ({ id: num(b.id), name: String(b.name ?? ""), priceGold: num(b.priceGold), iconUrl: gameAssetUrl(String(b.iconUrl ?? "")), catchRate: num(b.catchRate) })),
      items: items.map((i) => ({ id: num(i.id), name: String(i.name ?? ""), priceGold: num(i.priceGold), icon: gameAssetUrl(String(i.icon ?? "")), category: String(i.category ?? "") })),
    },
    tokens: r.tokens,
    changed: r.changed,
  };
}

// Itens vendaveis da mochila (drops da hunt). Le /api/game/depot -> inventory (bag).
export interface InvItem { id: number; name: string; icon: string; quantity: number; npcPrice: number; category: string }

export async function fetchInventory(tokens: Tokens): Promise<{ items: InvItem[]; tokens: Tokens; changed: boolean } | null> {
  const r = await gameFetch("/api/game/depot", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const raw = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
  const bag = (Array.isArray(raw?.inventory) ? raw!.inventory : []) as Record<string, unknown>[];
  const items = bag.map((i) => ({
    id: num(i.id),
    name: String(i.name ?? ""),
    icon: i.icon ? gameAssetUrl(String(i.icon)) : "",
    quantity: num(i.quantity),
    npcPrice: num(i.npcPrice),
    category: String(i.category ?? "loot"),
  }));
  return { items, tokens: r.tokens, changed: r.changed };
}

// Itens travados pelo jogador (cadeado) — o jogo recusa vender esses. GET /api/game/item/lock
// -> { locked: [itemId, ...] }.
export async function fetchLocks(tokens: Tokens): Promise<{ locked: Set<number>; tokens: Tokens; changed: boolean } | null> {
  const r = await gameFetch("/api/game/item/lock", tokens).catch(() => null);
  if (!r || !r.res.ok) return null;
  const raw = (await r.res.json().catch(() => null)) as { locked?: unknown } | null;
  const arr = Array.isArray(raw?.locked) ? raw!.locked : [];
  return { locked: new Set(arr.filter((x): x is number => typeof x === "number")), tokens: r.tokens, changed: r.changed };
}

export interface WriteResult<T = unknown> { ok: boolean; status: number; data: T | null; tokens: Tokens; changed: boolean }

async function send<T = unknown>(path: string, tokens: Tokens, body: unknown): Promise<WriteResult<T>> {
  const r = await gameSend(path, tokens, "POST", body);
  // corpo lido TAMBEM no erro: o jogo explica a recusa ({"error": ...}) — vira alerta util
  const data = (await r.res.json().catch(() => null)) as T | null;
  return { ok: r.res.ok, status: r.res.status, data, tokens: r.tokens, changed: r.changed };
}

// mensagem legivel de uma recusa do jogo (se o corpo trouxe)
export function gameErrorMsg(data: unknown): string | null {
  const o = data as { error?: unknown; message?: unknown } | null;
  const m = o && (typeof o.error === "string" ? o.error : typeof o.message === "string" ? o.message : null);
  return m && m.length <= 200 ? m : null;
}

export const buyBall = (t: Tokens, ballId: number, qty: number) => send("/api/game/shop/buy", t, { ballId, qty });
export const buyItem = (t: Tokens, itemId: number, qty: number) => send("/api/game/shop/buy", t, { itemId, qty });
export const sellItems = (t: Tokens, items: { itemId: number; qty: number }[]) => send("/api/game/shop/sell", t, { items });

export interface SellPokesResult { sold: number; goldGained: number; gold: number }
export const sellPokes = (t: Tokens, pokeIds: string[]) =>
  send<SellPokesResult>("/api/game/pokemon/sell", t, { pokeIds });

// COMPRA no mercado de jogadores. Endpoint e formatos extraidos do cliente oficial do
// jogo (chunk 43p_190ghnt4r.js): POST /api/game/market/action com
//   { action:"buy", id, quantity:1 }                            -> anuncio unico (pokemon)
//   { action:"buy-stack", kind, refId, price, currency,
//     quantity, ids }                                           -> pilha de itens
// price/currency no corpo funcionam de trava: preco mudou = o jogo recusa. GASTA moeda
// de verdade — so a rota VIP com confirmacao chama isto.
export type MarketBuyPayload =
  | { action: "buy"; id: string; quantity: 1 }
  | { action: "buy-stack"; kind: string; refId: number; price: number; currency: string; quantity: number; ids: string[] };
export const marketAction = (t: Tokens, payload: MarketBuyPayload) =>
  send("/api/game/market/action", t, payload);
