import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchTotalsSnapshot } from "@/lib/vip-snapshots";

export const runtime = "nodejs";

// Dashboard de Estatisticas (cumulativo, pra sempre) EM TEMPO REAL. A montagem (persistido
// + hunt ao vivo, sem dupla-contagem) vive em vip-snapshots — compartilhada com o stream SSE.
export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  return NextResponse.json(await fetchTotalsSnapshot(s.user.id));
}
