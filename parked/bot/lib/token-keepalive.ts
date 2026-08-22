import { query } from "@/lib/db";
import { gameFetch } from "@/lib/game-auth";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { logRobotEvent } from "@/lib/robot-events";

// Keepalive do VINCULO com o jogo: renova os tokens proativamente pra o bookmark ser
// coisa de UMA vez so. Sem isso, o refresh token vencia se o usuario ficasse dias sem
// abrir a area VIP (o refresh so rodava no 401 de alguma chamada) e o vinculo caia pra
// 'expired' — dai bookmark de novo. A cada varredura: um GET barato autenticado; o
// gameFetch renova no 401 e a rotacao e persistida. Se o refresh MORRER de vez (o jogo
// invalidou — ex.: "sair de todos os dispositivos"), marca expired e APITA no feed em
// vez de falhar mudo.

const EVERY_MS = 30 * 60 * 1000; // varredura a cada 30min (rotaciona bem antes de vencer)
const PING_PATH = "/api/characters/me"; // endpoint barato so pra validar/rotacionar

async function sweep(): Promise<void> {
  let rows: { user_id: string }[] = [];
  try {
    rows = await query<{ user_id: string }>(`SELECT user_id FROM game_links WHERE status = 'active'`);
  } catch { return; } // banco fora: proxima varredura
  for (const r of rows) {
    try {
      const link = await getGameLink(r.user_id);
      if (!link || link.status !== "active") continue;
      const res = await gameFetch(PING_PATH, link.tokens);
      if (res.changed) await updateGameTokens(r.user_id, res.tokens);
      if (res.res.status === 401) {
        // refresh morreu de verdade: pede reconexao UMA vez, com aviso — nunca em silencio
        await markGameLinkExpired(r.user_id);
        void logRobotEvent(r.user_id, {
          kind: "reconnect",
          title: "Vinculo com o jogo expirou",
          body: "O jogo invalidou o acesso. Reconecte com o botao (uma vez) e o piwdex volta a manter sozinho.",
          data: { expired: true },
        });
      }
    } catch { /* jogo fora do ar: proxima varredura tenta */ }
  }
}

/** Liga o keepalive (idempotente — sobrevive a hot-reload sem duplicar timer). */
export function startTokenKeepalive(): void {
  const g = globalThis as unknown as { __piwKeepalive?: ReturnType<typeof setInterval> };
  if (g.__piwKeepalive) clearInterval(g.__piwKeepalive);
  g.__piwKeepalive = setInterval(() => void sweep(), EVERY_MS);
  setTimeout(() => void sweep(), 10_000); // primeira varredura logo apos o boot (banco ja de pe)
}
