import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/game-auth";

export const runtime = "nodejs";

// Desconecta: apaga o cookie de sessao. Nao invalida o token no jogo (o jogador segue
// logado la); so esquece a sessao aqui.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
