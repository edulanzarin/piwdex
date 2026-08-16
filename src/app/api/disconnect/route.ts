import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteGameLink } from "@/lib/game-link";

export const runtime = "nodejs";

// Desvincula a conta do jogo do usuario logado: apaga o vinculo do banco. Nao
// invalida o token no jogo (o jogador segue logado la); so esquece aqui.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "not_logged" }, { status: 401 });
  await deleteGameLink(session.user.id);
  return NextResponse.json({ ok: true });
}
