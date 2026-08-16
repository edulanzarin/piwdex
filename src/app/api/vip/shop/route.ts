import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { fetchShop, fetchInventory, buyBall, buyItem, sellItems, sellPokes, type WriteResult } from "@/lib/game-shop";
import { getData } from "@/lib/data";

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
  return { userId: s.user.id, tokens: link.tokens };
}

const isPosInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;

  const [shopR, invR, data] = await Promise.all([
    fetchShop(c.tokens).catch(() => null),
    fetchInventory(c.tokens).catch(() => null),
    getData(),
  ]);
  if (!shopR && !invR) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  const tokens = invR?.tokens ?? shopR?.tokens ?? c.tokens;
  if (shopR?.changed || invR?.changed) await updateGameTokens(c.userId, tokens);

  // So drops vendaveis (npcPrice > 0), com a flag `rare` do catalogo do piwdex pra avisar.
  const inventory = (invR?.items ?? [])
    .filter((i) => i.npcPrice > 0 && i.quantity > 0)
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
  } else if (action === "sell-pokes") {
    const ids = Array.isArray(b.pokeIds) ? b.pokeIds.filter((x) => typeof x === "string" && x.length > 0) : [];
    if (!ids.length) return NextResponse.json({ error: "empty" }, { status: 400 });
    w = await sellPokes(c.tokens, ids as string[]);
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  if (!w) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  if (w.changed) await updateGameTokens(c.userId, w.tokens);
  if (!w.ok) return NextResponse.json({ error: "action_failed", status: w.status }, { status: 502 });
  return NextResponse.json({ ok: true, result: w.data });
}
