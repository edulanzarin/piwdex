import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { gameSession } from "@/lib/game-hunt-session";
import { getRobotDesired, saveRobotDesired } from "@/lib/robot-session-store";
import { getData } from "@/lib/data";

export const runtime = "nodejs";

// Auto-compra de consumiveis (o robo repoe as bolas + pocao + revive da automacao sozinho).
// GET le o estado + as opcoes de pocao/revive; POST liga/desliga (action) e/ou grava qual
// pocao/revive repor (supply). Roda no proprio timer (REST), independe do WS de hunt/venda.
// PERSISTENTE: toggle em robot_sessions.autobuy, escolha em robot_sessions.supply_cfg.
// O GET e self-healing: se o banco diz ligado e a memoria do processo perdeu, re-arma o timer.

// Opcoes buyaveis (dados estaticos, sem tocar o jogo): pocao = categoria heal com preco NPC;
// revive = categoria revive. Ordenadas da mais fraca (barata) pra mais forte. `icon` e o
// caminho cru do jogo (/assets/...) — o cliente resolve pra URL absoluta com assetIconUrl.
async function supplyOptions() {
  const db = await getData();
  const map = (cat: string) =>
    db.items
      .filter((i) => i.category === cat && i.npcPrice > 0)
      .sort((a, b) => a.npcPrice - b.npcPrice)
      .map((i) => ({ id: i.id, name: i.name, icon: i.icon }));
  return { potions: map("heal"), revives: map("revive") };
}

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
  const opts = await supplyOptions();
  return NextResponse.json({
    on: want,
    potionId: desired?.supplyCfg?.potionId ?? null,
    reviveId: desired?.supplyCfg?.reviveId ?? null,
    ...opts,
  });
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as {
    action?: string;
    supply?: { potionId?: unknown; reviveId?: unknown };
  };

  // grava a escolha de pocao/revive, se veio. So aceita ids que existem no catalogo (ou null).
  if (b.supply) {
    const opts = await supplyOptions();
    const valid = (v: unknown, list: { id: number }[]): number | null =>
      typeof v === "number" && list.some((o) => o.id === v) ? v : null;
    const supplyCfg = {
      potionId: valid(b.supply.potionId, opts.potions),
      reviveId: valid(b.supply.reviveId, opts.revives),
    };
    await saveRobotDesired(c.userId, { supplyCfg });
    // se a auto-compra ja esta ligada, re-arma pra aplicar a escolha nova AGORA (compra 1x).
    if (gameSession.getAutoBuyOn()) {
      gameSession.setAutoBuy(c.userId, c.tokens, true, (t) => updateGameTokens(c.userId, t));
    }
  }

  if (b.action === "start" || b.action === "stop") {
    gameSession.setAutoBuy(c.userId, c.tokens, b.action === "start", (t) => updateGameTokens(c.userId, t));
  }

  return NextResponse.json({ on: gameSession.getAutoBuyOn() });
}
