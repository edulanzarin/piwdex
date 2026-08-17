import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRobotSales } from "@/lib/robot-sales";
import { capturedStats } from "@/lib/captured-pokes";

export const runtime = "nodejs";

// Dashboard de Estatisticas (cumulativo, pra sempre): totais do robo (vendas + o que a hunt
// rendeu) + resumo do acervo (total, shiny, por raridade pro grafico). So leitura.
export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });
  const [totals, acervo] = await Promise.all([getRobotSales(s.user.id), capturedStats(s.user.id)]);
  return NextResponse.json({ ...totals, acervo });
}
