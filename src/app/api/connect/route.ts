import { NextResponse } from "next/server";
import { encryptSession, gameFetch, parseTokens, SESSION_COOKIE } from "@/lib/game-auth";

export const runtime = "nodejs";

// Conecta a conta: recebe o token colado (valor do pokeweb:tokens ou dois JWTs),
// valida chamando /api/characters/me e grava a sessao criptografada no cookie httpOnly.
export async function POST(req: Request) {
  let raw = "";
  try {
    const body = (await req.json()) as { raw?: string; token?: string };
    raw = String(body?.raw ?? body?.token ?? "");
  } catch {
    /* body invalido */
  }

  const tokens = parseTokens(raw);
  if (!tokens) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  let result;
  try {
    result = await gameFetch("/api/characters/me", tokens);
  } catch {
    return NextResponse.json({ ok: false, error: "game_unreachable" }, { status: 502 });
  }
  if (!result.res.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, encryptSession(result.tokens), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
