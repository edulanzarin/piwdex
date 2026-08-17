import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink } from "@/lib/game-link";
import { gameSession } from "@/lib/game-hunt-session";
import { saveRobotDesired, type AnnounceCfg } from "@/lib/robot-session-store";

export const runtime = "nodejs";

// Chat do jogo pela sessao que o robo segura. GET le o estado (mensagens + anuncio +
// frames desconhecidos do modo descoberta); POST:
//   send     {text, channel}                    — manda mensagem (precisa da sessao viva)
//   announce {on, text, everyMin, channel}      — anuncio automatico (persistido)

const CHANNELS = new Set(["world", "trade", "help"]);

async function guard() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  return NextResponse.json(gameSession.getChatView());
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "send") {
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 300) : "";
    const channel = typeof b.channel === "string" && CHANNELS.has(b.channel) ? b.channel : "world";
    if (!text) return NextResponse.json({ error: "no_text" }, { status: 400 });
    const ok = gameSession.sendChat(text, channel);
    if (!ok) return NextResponse.json({ error: "not_live" }, { status: 409 }); // liga o robo antes
    return NextResponse.json(gameSession.getChatView());
  }

  if (b.action === "announce") {
    const on = b.on === true;
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 300) : "";
    const everyMin = Math.min(120, Math.max(1, Math.round(Number(b.everyMin) || 10)));
    const channel = typeof b.channel === "string" && CHANNELS.has(b.channel) ? (b.channel as AnnounceCfg["channel"]) : "world";
    if (on && !text) return NextResponse.json({ error: "no_text" }, { status: 400 });
    const cfg: AnnounceCfg = { on, text, everyMin, channel };
    gameSession.setAnnounce(cfg);
    // persiste tambem por aqui: a sessao so persiste se ja tem contexto (userId) — a config
    // do anuncio tem que sobreviver mesmo configurada antes de ligar o robo
    await saveRobotDesired(g.userId, { announce: cfg }).catch(() => {});
    return NextResponse.json(gameSession.getChatView());
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
