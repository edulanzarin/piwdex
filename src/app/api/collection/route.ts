import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, encryptSession, gameFetch, SESSION_COOKIE } from "@/lib/game-auth";
import { getData } from "@/lib/data";
import { normalizeAccount } from "@/lib/game-account";

export const runtime = "nodejs";

const clearCookie = (res: NextResponse) =>
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

// Retorna a colecao do jogador (characters/me) normalizada com Power/IV calculados.
// Inclui o RAW pra a gente finalizar o mapeamento de campos com um token real.
export async function GET(req: Request) {
  const store = await cookies();
  const tokens = decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!tokens) return NextResponse.json({ connected: false }, { status: 401 });

  let result;
  try {
    result = await gameFetch("/api/characters/me", tokens);
  } catch {
    return NextResponse.json({ connected: true, error: "game_unreachable" }, { status: 502 });
  }
  if (!result.res.ok) {
    const res = NextResponse.json({ connected: false, error: "expired" }, { status: 401 });
    clearCookie(res);
    return res;
  }

  const raw = await result.res.json().catch(() => null);
  const { creatures } = await getData();
  const mons = normalizeAccount(raw, creatures);

  const wantRaw = new URL(req.url).searchParams.get("raw") === "1";
  const res = NextResponse.json({ connected: true, mons, raw: wantRaw ? raw : undefined });
  if (result.changed) {
    res.cookies.set(SESSION_COOKIE, encryptSession(result.tokens), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
