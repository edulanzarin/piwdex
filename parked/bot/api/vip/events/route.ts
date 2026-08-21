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

export async function GET(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  // `?limit=` pro botao "ver mais" do feed: o padrao cabe na tela, o teto e o que o
  // banco guarda. Sem isso a unica memoria do que o robo fez sozinho eram 10 linhas.
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? raw : undefined;
  const [events, unread] = await Promise.all([listRobotEvents(c.userId, limit), unreadRobotEvents(c.userId)]);
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
