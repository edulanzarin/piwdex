import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, encryptSession, gameFetch, SESSION_COOKIE, type Tokens } from "@/lib/game-auth";
import { normalizeAccount } from "@/lib/game-account";

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

// Conta COMPLETA: perfil + treinador (skin/vip/clã) + automação + streak + breeding +
// inventário/depósito + bolas. Busca todos os endpoints logados em paralelo. Os pokemons
// individuais ativos (com IV) NAO existem na REST — so no WS do cliente do jogo.
const PATHS = {
  profile: "/api/game/profile",
  character: "/api/characters/me",
  depot: "/api/game/depot",
  streak: "/api/game/streak",
  breeding: "/api/game/breeding",
  balls: "/api/game/balls",
  professions: "/api/game/professions",
} as const;

export async function GET() {
  const store = await cookies();
  const initial = decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!initial) return NextResponse.json({ connected: false }, { status: 401 });

  // O access token e o mesmo pra todas; o refresh (se rolar) muda os tokens uma vez.
  // Fazemos a 1a chamada (profile) sozinha pra capturar refresh, depois o resto em paralelo.
  let tokens: Tokens = initial;
  let changed = false;
  const json = async (path: string) => {
    const r = await gameFetch(path, tokens);
    if (r.changed) {
      tokens = r.tokens;
      changed = true;
    }
    if (r.res.status === 401) return { unauth: true as const };
    return { data: await r.res.json().catch(() => null) };
  };

  let profileRes;
  try {
    profileRes = await json(PATHS.profile);
  } catch {
    return NextResponse.json({ connected: true, error: "game_unreachable" }, { status: 502 });
  }
  if ("unauth" in profileRes) {
    const res = NextResponse.json({ connected: false, error: "expired" }, { status: 401 });
    clearCookie(res);
    return res;
  }

  // resto em paralelo (ja com o token possivelmente renovado). Falha individual vira null.
  const [character, depot, streak, breeding, balls, professions] = await Promise.all(
    [PATHS.character, PATHS.depot, PATHS.streak, PATHS.breeding, PATHS.balls, PATHS.professions].map((p) =>
      json(p)
        .then((r) => ("data" in r ? r.data : null))
        .catch(() => null),
    ),
  );

  const characterData = (character as { character?: unknown } | null)?.character ?? character;

  const account = normalizeAccount({
    profile: profileRes.data,
    character: characterData,
    depot,
    streak,
    breeding,
    balls,
    professions,
  });

  const res = NextResponse.json({ connected: true, account });
  if (changed) setCookie(res, tokens);
  return res;
}
