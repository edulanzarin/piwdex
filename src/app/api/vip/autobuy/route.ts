import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { gameSession } from "@/lib/game-hunt-session";
import { getRobotDesired } from "@/lib/robot-session-store";

export const runtime = "nodejs";

// Auto-compra de consumiveis (o robo repoe as bolas da automacao sozinho). GET le o estado;
// POST start/stop liga/desliga. Roda no proprio timer (REST), independe do WS de hunt/venda.
// PERSISTENTE: o toggle vive em robot_sessions.autobuy — restart/hot-reload nao desliga.
// O GET e self-healing: se o banco diz ligado e a memoria do processo perdeu (processo
// novo), re-arma o timer na hora.
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
  // fonte da verdade: o persistido. Memoria divergindo = processo renasceu -> re-arma.
  const desired = await getRobotDesired(s.user.id).catch(() => null);
  const want = desired?.autobuy ?? false;
  if (want && !gameSession.getAutoBuyOn()) {
    const link = await getGameLink(s.user.id).catch(() => null);
    if (link && link.status === "active") {
      const userId = s.user.id;
      gameSession.setAutoBuy(userId, link.tokens, true, (t) => updateGameTokens(userId, t));
    }
  }
  return NextResponse.json({ on: want });
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  gameSession.setAutoBuy(c.userId, c.tokens, b.action === "start", (t) => updateGameTokens(c.userId, t));
  return NextResponse.json({ on: gameSession.getAutoBuyOn() });
}
