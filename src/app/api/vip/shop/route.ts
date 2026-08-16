import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens, saveGameShard } from "@/lib/game-link";
import { fetchShop, fetchInventory, fetchLocks, buyBall, buyItem, sellItems, sellPokes, type WriteResult } from "@/lib/game-shop";
import { fetchActivePokes } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";
import { getData } from "@/lib/data";
import { RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

// travas da venda de pokemon vindas do cliente (piw:poke-sell-config:v2), validadas.
interface PokeSellCfg { sellRarities: Rarity[]; keepShiny: boolean; maxIv: number; maxQuality: number }
function parseCfg(raw: unknown): PokeSellCfg {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rar = Array.isArray(c.sellRarities) ? c.sellRarities.filter((r): r is Rarity => RARITY_ORDER.includes(r as Rarity)) : [];
  return {
    sellRarities: rar,
    keepShiny: c.keepShiny !== false, // default protege shiny
    maxIv: typeof c.maxIv === "number" ? c.maxIv : 0, // default 0 = nao vende nada (seguro)
    maxQuality: typeof c.maxQuality === "number" ? c.maxQuality : 0,
  };
}

export const runtime = "nodejs";

// Loja NPC pela area VIP: GET le o catalogo; POST executa UMA acao validada
// (comprar bola/item, vender drops, vender pokemon). Escreve na conta REAL — cada
// acao e disparada explicitamente aqui; a automacao (worker) vem com guarda-costas.

async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id, tokens: link.tokens, shard: link.shard };
}

// Lista viva dos pokemon individuais (via WS, shard cacheado). null se o WS falhar.
async function livePokes(c: { userId: string; tokens: import("@/lib/game-auth").Tokens; shard: number | null }) {
  const r = await fetchActivePokes(c.tokens, c.shard);
  if (!r) return null;
  if (r.shard !== c.shard) await saveGameShard(c.userId, r.shard);
  return normalizeActivePokes(r.pokes);
}

const isPosInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;

  const [shopR, invR, locksR, data] = await Promise.all([
    fetchShop(c.tokens).catch(() => null),
    fetchInventory(c.tokens).catch(() => null),
    fetchLocks(c.tokens).catch(() => null),
    getData(),
  ]);
  if (!shopR && !invR) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  const tokens = invR?.tokens ?? locksR?.tokens ?? shopR?.tokens ?? c.tokens;
  if (shopR?.changed || invR?.changed || locksR?.changed) await updateGameTokens(c.userId, tokens);

  // So DROPS de hunt (categoria 'loot') e NAO travados sao vendaveis no NPC — pocao/
  // revive/pedra sao compra-only; o cadeado o jogo recusa vender.
  const locked = locksR?.locked ?? new Set<number>();
  const inventory = (invR?.items ?? [])
    .filter((i) => i.category === "loot" && i.npcPrice > 0 && i.quantity > 0 && !locked.has(i.id))
    .map((i) => ({ ...i, rare: data.getItem(i.id)?.rare ?? false }))
    .sort((a, b) => b.npcPrice * b.quantity - a.npcPrice * a.quantity);

  return NextResponse.json({ shop: shopR?.shop ?? null, inventory });
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = b.action;

  let w: WriteResult | null = null;
  if (action === "buy") {
    const qty = b.qty;
    if (!isPosInt(qty) || qty > 9999) return NextResponse.json({ error: "bad_qty" }, { status: 400 });
    if (isPosInt(b.ballId)) w = await buyBall(c.tokens, b.ballId, qty);
    else if (isPosInt(b.itemId)) w = await buyItem(c.tokens, b.itemId, qty);
    else return NextResponse.json({ error: "bad_target" }, { status: 400 });
  } else if (action === "sell-items") {
    const raw = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : null;
    if (!raw?.length) return NextResponse.json({ error: "empty" }, { status: 400 });
    const items = raw
      .map((i) => ({ itemId: i.itemId, qty: i.qty }))
      .filter((i) => isPosInt(i.itemId) && isPosInt(i.qty)) as { itemId: number; qty: number }[];
    if (!items.length) return NextResponse.json({ error: "empty" }, { status: 400 });
    w = await sellItems(c.tokens, items);
  } else if (action === "sim-pokes") {
    // Simulacao: puxa a lista viva do WS, aplica as travas e devolve o que SERIA vendido.
    const cfg = parseCfg(b.config);
    const pokes = await livePokes(c);
    if (!pokes) return NextResponse.json({ error: "ws_unreachable" }, { status: 502 });
    const data = await getData();
    const matches = pokes
      .filter((p) => !p.team && !p.leader && !p.starter) // nunca o time ativo
      .filter((p) => !(cfg.keepShiny && p.shiny))
      .map((p) => ({ ...p, rarity: data.getCreature(p.speciesId)?.rarity ?? ("COMMON" as Rarity) }))
      .filter((p) => cfg.sellRarities.includes(p.rarity))
      .filter((p) => p.ivTotal <= cfg.maxIv && p.quality <= cfg.maxQuality)
      .sort((a, b2) => a.quality - b2.quality || a.ivTotal - b2.ivTotal);
    const gold = matches.reduce((s, p) => s + p.sellValue, 0);
    return NextResponse.json({ pokes: matches, gold, total: pokes.length });
  } else if (action === "sell-pokes") {
    const ids = Array.isArray(b.pokeIds) ? b.pokeIds.filter((x) => typeof x === "string" && x.length > 0) : [];
    if (!ids.length) return NextResponse.json({ error: "empty" }, { status: 400 });
    // Guarda-costas server-side: re-le a lista viva e RECUSA vender time/lider/starter,
    // mesmo que o cliente mande esses ids. Venda de pokemon e irreversivel.
    const pokes = await livePokes(c);
    if (!pokes) return NextResponse.json({ error: "ws_unreachable" }, { status: 502 });
    const guarded = new Set(pokes.filter((p) => p.team || p.leader || p.starter).map((p) => p.id));
    const safe = (ids as string[]).filter((id) => !guarded.has(id));
    if (!safe.length) return NextResponse.json({ error: "all_protected" }, { status: 400 });
    w = await sellPokes(c.tokens, safe);
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  if (!w) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  if (w.changed) await updateGameTokens(c.userId, w.tokens);
  if (!w.ok) return NextResponse.json({ error: "action_failed", status: w.status }, { status: 502 });
  return NextResponse.json({ ok: true, result: w.data });
}
