import { gameFetch, type Tokens } from "@/lib/game-auth";
import { getGameLink, updateGameTokens, markGameLinkExpired, type TeamSnapshot } from "@/lib/game-link";
import { normalizeAccount, type Account } from "@/lib/game-account";
import { getRobotSales } from "@/lib/robot-sales";
import { capturedStats } from "@/lib/captured-pokes";
import { gameSession } from "@/lib/game-hunt-session";
import { getData } from "@/lib/data";

// Snapshots da area VIP compartilhados entre as rotas REST e o stream SSE (/api/vip/stream):
// a MESMA carga que o GET devolvia agora tambem e empurrada pelo stream — um so lugar monta.

export interface AccountSnapshot {
  connected: boolean;
  reason?: "expired";
  error?: "game_unreachable";
  account?: Account;
  team?: TeamSnapshot | null;
}

const PATHS = {
  profile: "/api/game/profile",
  character: "/api/characters/me",
  depot: "/api/game/depot",
  streak: "/api/game/streak",
  breeding: "/api/game/breeding",
  balls: "/api/game/balls",
  professions: "/api/game/professions",
} as const;

/** Conta COMPLETA do jogador (perfil + treinador + automacao + streak + breeding +
 *  inventario + bolas), buscada na API do jogo com refresh de token persistido. */
export async function fetchAccountSnapshot(userId: string): Promise<AccountSnapshot> {
  const link = await getGameLink(userId);
  if (!link) return { connected: false }; // logado, mas sem conta vinculada
  if (link.status === "expired") return { connected: false, reason: "expired" };

  let tokens: Tokens = link.tokens;
  let changed = false;
  const json = async (path: string) => {
    const r = await gameFetch(path, tokens);
    if (r.changed) { tokens = r.tokens; changed = true; }
    if (r.res.status === 401) return { unauth: true as const };
    return { data: await r.res.json().catch(() => null) };
  };

  let profileRes;
  try {
    profileRes = await json(PATHS.profile);
  } catch {
    return { connected: true, error: "game_unreachable" };
  }
  if ("unauth" in profileRes) {
    await markGameLinkExpired(userId);
    return { connected: false, reason: "expired" };
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
  return { connected: true, account, team: link.team };
}

/** Totalizador cumulativo (robot_sales + acervo) MAIS a contribuicao ao vivo da hunt em
 *  andamento (analyzer). Sem dupla-contagem: o logSummary persiste ao terminar. */
export async function fetchTotalsSnapshot(userId: string) {
  const [totals, acervo] = await Promise.all([getRobotSales(userId), capturedStats(userId)]);

  const st = gameSession.getStateFor(userId);
  const a = st.status === "running" && st.slug ? st.analyzer : null;
  if (a) {
    let rareItems = 0;
    try {
      const data = await getData();
      for (const d of a.drops ?? []) {
        const it = data.getItemByName(d.name) ?? data.getItem(d.itemId);
        if (it?.rare) rareItems += d.qty;
      }
    } catch { /* raridade e best-effort */ }
    totals.hunts += 1; // a hunt em andamento conta como 1 na contagem viva
    totals.kills += a.kills; totals.captures += a.captures; totals.xpGained += a.xpGained;
    totals.lootItems += a.lootItems; totals.lootGold += a.lootGold; totals.supplyGold += a.supplyGold;
    totals.rareItems += rareItems;
  }

  return { ...totals, acervo };
}
