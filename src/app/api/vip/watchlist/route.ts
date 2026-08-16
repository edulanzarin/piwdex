import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listWatchlistsByUser,
  createWatchlist,
  deleteWatchlist,
  setWatchlistActive,
  type WatchInput,
} from "@/lib/alerts";
import type { Currency } from "@/lib/game-account";

export const runtime = "nodejs";

// CRUD das watchlists do consultor de mercado (aba Alertas). Tudo VIP-gated e preso
// ao usuario logado — nunca toca watchlist de outro.

async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!session.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  return { userId: session.user.id };
}

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  return NextResponse.json({ watchlists: await listWatchlistsByUser(g.userId) });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const currency: Currency | null =
    body.currency === "GOLD" || body.currency === "DIAMONDS" ? body.currency : null;

  const input: WatchInput = {
    speciesId: numOrNull(body.speciesId),
    currency,
    maxPrice: numOrNull(body.maxPrice),
    minQuality: numOrNull(body.minQuality),
    minIv: numOrNull(body.minIv),
    shinyOnly: Boolean(body.shinyOnly),
    belowFair: Boolean(body.belowFair),
    label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null,
  };

  // Precisa de pelo menos UM criterio — senao alerta em tudo.
  const hasCriterion =
    input.speciesId != null ||
    input.maxPrice != null ||
    input.minQuality != null ||
    input.minIv != null ||
    input.shinyOnly ||
    input.belowFair;
  if (!hasCriterion) return NextResponse.json({ error: "no_criteria" }, { status: 400 });

  const wl = await createWatchlist(g.userId, input);
  return NextResponse.json({ watchlist: wl }, { status: 201 });
}

export async function DELETE(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  await deleteWatchlist(g.userId, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== "boolean")
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await setWatchlistActive(g.userId, body.id, body.active);
  return NextResponse.json({ ok: true });
}
