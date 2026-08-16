import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listNotifications, unreadCount, markRead } from "@/lib/alerts";

export const runtime = "nodejs";

// Inbox in-app da area VIP. GET lista (ou so o contador, pro sininho); POST marca lido.

async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!session.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  return { userId: session.user.id };
}

export async function GET(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const q = new URL(req.url).searchParams;
  if (q.get("count") === "1") {
    return NextResponse.json({ unread: await unreadCount(g.userId) });
  }
  const [notifications, unread] = await Promise.all([listNotifications(g.userId), unreadCount(g.userId)]);
  return NextResponse.json({ notifications, unread });
}

export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  await markRead(g.userId, body.all ? "all" : Array.isArray(body.ids) ? body.ids : []);
  return NextResponse.json({ unread: await unreadCount(g.userId) });
}
