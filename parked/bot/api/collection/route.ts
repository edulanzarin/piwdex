import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchAccountSnapshot } from "@/lib/vip-snapshots";

export const runtime = "nodejs";

// Conta COMPLETA do jogador logado no piwdex: perfil + treinador (skin/vip/clã) +
// automação + streak + breeding + inventário/depósito + bolas. A montagem vive em
// vip-snapshots (compartilhada com o stream SSE); aqui e so o GET pontual.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ connected: false, error: "not_logged" }, { status: 401 });
  if (!session.user.vip) return NextResponse.json({ connected: false, error: "vip_only" }, { status: 403 }); // Conta e VIP

  const snap = await fetchAccountSnapshot(session.user.id);
  if (snap.error === "game_unreachable") return NextResponse.json(snap, { status: 502 });
  return NextResponse.json(snap);
}
