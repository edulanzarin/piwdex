import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { loadMarket, bustMarketCache } from "@/lib/market-cache";
import { marketAction, type MarketBuyPayload } from "@/lib/game-shop";
import { logRobotEvent } from "@/lib/robot-events";

export const runtime = "nodejs";

// COMPRA no mercado de jogadores (pokemon ou pilha de itens). GASTA moeda de verdade:
//   1. o servidor RECONFERE o anuncio no mercado (existe? preco/moeda batem com o que o
//      usuario viu?) — preco mudou vira 409 price_changed, nunca compra por outro valor;
//   2. a acao vai pro jogo com o preco no corpo (o proprio jogo tambem trava por preco);
//   3. cada compra vira evento no feed (Alertas) e estoura o cache do mercado.
// POST { kind:"pokemon", id, price, currency }
//    | { kind:"item", refId, price, currency, quantity }

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const price = Number(b.price);
  const currency = b.currency === "DIAMONDS" ? "DIAMONDS" : "GOLD";
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: "bad_price" }, { status: 400 });

  let loaded;
  try {
    loaded = await loadMarket(link.tokens);
  } catch {
    return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  }
  if (!loaded.mons) return NextResponse.json({ error: "game_unreachable" }, { status: 502 });
  let tokens = loaded.changed ? loaded.tokens : link.tokens;

  let payload: MarketBuyPayload;
  let title: string;

  if (b.kind === "pokemon") {
    const id = String(b.id ?? "");
    const mon = loaded.mons.find((m) => m.listingId === id);
    if (!mon) return NextResponse.json({ error: "listing_gone" }, { status: 409 });
    if (mon.price !== price || mon.currency !== currency) {
      return NextResponse.json({ error: "price_changed", price: mon.price, currency: mon.currency }, { status: 409 });
    }
    payload = { action: "buy", id, quantity: 1 };
    title = `Comprou ${mon.shiny ? "shiny " : ""}${mon.name} Lv.${mon.level} no mercado`;
  } else if (b.kind === "item") {
    const refId = Number(b.refId);
    const qty = Math.max(1, Math.floor(Number(b.quantity) || 1));
    // a pilha certa: mesmo item, MESMO preco unitario e moeda que o usuario confirmou
    const stack = (loaded.items ?? []).find((i) => i.refId === refId && i.price === price && i.currency === currency);
    if (!stack) return NextResponse.json({ error: "price_changed" }, { status: 409 });
    if (qty > stack.quantity) return NextResponse.json({ error: "not_enough", available: stack.quantity }, { status: 409 });
    // ids DO SERVIDOR (a pilha reconferida), nunca os que o cliente mandou
    payload = { action: "buy-stack", kind: stack.kind, refId, price, currency, quantity: qty, ids: stack.ids };
    title = `Comprou ${qty}x ${stack.name} no mercado`;
  } else {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }

  const w = await marketAction(tokens, payload);
  if (w.changed) { tokens = w.tokens; await updateGameTokens(s.user.id, w.tokens); }
  bustMarketCache(); // quantidade/anuncio mudaram de verdade (mesmo em erro, por seguranca)

  if (!w.ok) {
    const msg = (w.data as { error?: string; message?: string } | null)?.error
      ?? (w.data as { message?: string } | null)?.message ?? null;
    return NextResponse.json({ error: "game_refused", status: w.status, message: msg }, { status: 502 });
  }

  const spent = b.kind === "item" ? price * Math.floor(Number(b.quantity) || 1) : price;
  void logRobotEvent(s.user.id, {
    kind: "item-bought",
    title,
    body: `-${spent.toLocaleString("pt-BR")} ${currency === "DIAMONDS" ? "diamantes" : "dolares"}`,
    data: { gold: -spent, currency, market: true },
  });
  return NextResponse.json({ ok: true, result: w.data ?? null });
}
