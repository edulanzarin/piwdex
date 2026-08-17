import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { gameSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Auto-compra de consumiveis (o robo repoe as bolas da automacao sozinho). GET le o estado;
// POST start/stop liga/desliga. Roda no proprio timer (REST), independe do WS de hunt/venda.
async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id, tokens: link.tokens };
}

export async function GET() {
  const s = await auth();
  if (!s?.user?.id || !s.user.vip) return NextResponse.json({ on: false });
  return NextResponse.json({ on: gameSession.getAutoBuyOn() });
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  gameSession.setAutoBuy(c.userId, c.tokens, b.action === "start", (t) => updateGameTokens(c.userId, t));
  return NextResponse.json({ on: gameSession.getAutoBuyOn() });
}
