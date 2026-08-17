import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRobotEvents, unreadRobotEvents, markRobotEventsRead, clearRobotEvents } from "@/lib/robot-events";

export const runtime = "nodejs";

// Atividade do robo (Hunt + venda automatica), gravada no banco enquanto os robos rodam —
// inclusive offline. GET lista + conta nao-lidos; POST marca tudo como lido.

async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  return { userId: s.user.id };
}

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;
  const [events, unread] = await Promise.all([listRobotEvents(c.userId), unreadRobotEvents(c.userId)]);
  return NextResponse.json({ events, unread });
}

export async function POST() {
  const c = await ctx();
  if (c.error) return c.error;
  await markRobotEventsRead(c.userId);
  return NextResponse.json({ ok: true });
}

// DELETE: limpa tudo (botao "Limpar" do feed)
export async function DELETE() {
  const c = await ctx();
  if (c.error) return c.error;
  await clearRobotEvents(c.userId);
  return NextResponse.json({ ok: true });
}
