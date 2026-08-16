// Busca a conta COMPLETA do jogador a partir dos tokens (mesma composicao da rota
// /api/collection, extraida pra o worker de alertas reusar sem duplicar). Server-only.

import { gameFetch, type Tokens } from "./game-auth";
import { normalizeAccount, type Account } from "./game-account";

const PATHS = {
  profile: "/api/game/profile",
  character: "/api/characters/me",
  depot: "/api/game/depot",
  streak: "/api/game/streak",
  breeding: "/api/game/breeding",
  balls: "/api/game/balls",
  professions: "/api/game/professions",
} as const;

export type AccountResult =
  | { account: Account; tokens: Tokens; changed: boolean }
  | { unauth: true }
  | null; // inalcancavel

export async function fetchFullAccount(initial: Tokens): Promise<AccountResult> {
  let tokens = initial;
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
    return null;
  }
  if ("unauth" in profileRes) return { unauth: true };

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

  return { account, tokens, changed };
}
