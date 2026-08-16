import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, encryptSession, gameFetch, SESSION_COOKIE, type Tokens } from "@/lib/game-auth";
import { normalizePokedex, normalizeProfile } from "@/lib/game-account";

export const runtime = "nodejs";

const clearCookie = (res: NextResponse) => res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
const setCookie = (res: NextResponse, tokens: Tokens) =>
  res.cookies.set(SESSION_COOKIE, encryptSession(tokens), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

// Perfil (level/gold/diamonds/catches) + pokedex agregado (all-pokes: especie/tier/count).
export async function GET() {
  const store = await cookies();
  const initial = decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!initial) return NextResponse.json({ connected: false }, { status: 401 });

  let tokens: Tokens = initial;
  let changed = false;
  const call = async (path: string) => {
    const r = await gameFetch(path, tokens);
    if (r.changed) {
      tokens = r.tokens;
      changed = true;
    }
    return r.res;
  };

  let profRes: Response, dexRes: Response;
  try {
    profRes = await call("/api/game/profile");
    dexRes = await call("/api/game/all-pokes");
  } catch {
    return NextResponse.json({ connected: true, error: "game_unreachable" }, { status: 502 });
  }
  if (profRes.status === 401 || dexRes.status === 401) {
    const res = NextResponse.json({ connected: false, error: "expired" }, { status: 401 });
    clearCookie(res);
    return res;
  }

  const profile = normalizeProfile(await profRes.json().catch(() => null));
  const pokedex = normalizePokedex(await dexRes.json().catch(() => null));
  const res = NextResponse.json({ connected: true, profile, pokedex });
  if (changed) setCookie(res, tokens);
  return res;
}
