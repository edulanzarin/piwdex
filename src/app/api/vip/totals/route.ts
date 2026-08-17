import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRobotSales } from "@/lib/robot-sales";

export const runtime = "nodejs";

// Totalizador cumulativo (pra sempre) das vendas do robo — lido pelas abas Itens vendidos
// e Pokemon vendidos. So leitura.
export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const t = await getRobotSales(s.user.id);
  return NextResponse.json(t);
}
