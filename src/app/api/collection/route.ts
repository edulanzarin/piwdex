import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gameFetch, type Tokens } from "@/lib/game-auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { normalizeAccount } from "@/lib/game-account";

export const runtime = "nodejs";

// Conta COMPLETA do jogador logado no piwdex: perfil + treinador (skin/vip/clã) +
// automação + streak + breeding + inventário/depósito + bolas. Le o vinculo do
// banco (game_links), busca os endpoints do jogo em paralelo e persiste o token
// se o refresh rodar. Os pokemons ativos (com IV) so existem no WS do cliente.
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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ connected: false, error: "not_logged" }, { status: 401 });

  const userId = session.user.id;
  const link = await getGameLink(userId);
  if (!link) return NextResponse.json({ connected: false }); // logado, mas sem conta vinculada
  if (link.status === "expired") return NextResponse.json({ connected: false, reason: "expired" });

  let tokens: Tokens = link.tokens;
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
    await markGameLinkExpired(userId);
    return NextResponse.json({ connected: false, reason: "expired" });
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

  if (changed) await updateGameTokens(userId, tokens);
  return NextResponse.json({ connected: true, account });
}
