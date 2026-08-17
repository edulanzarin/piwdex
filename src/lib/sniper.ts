// Varredura do sniper de mercado: le o mercado ao vivo e casa contra as watchlists
// ativas, gravando os anuncios que bateram no inbox (dedup via UNIQUE). So leitura do
// jogo. A logica vive aqui pra ser chamada de DOIS lugares:
//   - o loop interno do processo (instrumentation.ts) — o caminho normal em producao,
//     que dispensa worker externo (Railway nao roda o compose);
//   - a rota /api/cron/scan (CRON_SECRET) — gatilho manual/externo opcional.

import { getGameLink, updateGameTokens } from "./game-link";
import { fetchScoredMarket } from "./market-scan";
import { listActiveWatchlists, matchSnipes, insertNotifications, type NewNotif } from "./alerts";

export interface ScanResult {
  watchlists: number;
  candidates: number;
  inserted: number;
}

export async function runSniperScan(): Promise<ScanResult> {
  const watchlists = await listActiveWatchlists();
  if (!watchlists.length) return { watchlists: 0, candidates: 0, inserted: 0 };

  // Mercado e global: puxa UMA vez, com o token de qualquer VIP que tenha watchlist.
  const watchers = [...new Set(watchlists.map((w) => w.userId))];
  let mons = null;
  for (const uid of watchers) {
    const link = await getGameLink(uid);
    if (!link || link.status === "expired") continue;
    const sm = await fetchScoredMarket(link.tokens).catch(() => null);
    if (sm) {
      if (sm.changed) await updateGameTokens(uid, sm.tokens);
      mons = sm.mons;
      break;
    }
  }
  if (!mons) return { watchlists: watchlists.length, candidates: 0, inserted: 0 };

  const notifs: NewNotif[] = matchSnipes(watchlists, mons);
  const inserted = await insertNotifications(notifs);
  return { watchlists: watchlists.length, candidates: notifs.length, inserted };
}

// Loop interno: uma varredura a cada SCAN_INTERVAL segundos (default 60; 0 desliga).
// Guarda contra sobreposicao: se uma varredura atrasar alem do intervalo, a proxima
// espera — nunca ha duas em voo no mesmo processo.
let running = false;

export function startSniperLoop(): void {
  const interval = Number(process.env.SCAN_INTERVAL ?? "60");
  if (!Number.isFinite(interval) || interval <= 0) return;
  setInterval(() => {
    if (running) return;
    running = true;
    void runSniperScan()
      .catch((e) => console.error("[sniper] varredura falhou:", e))
      .finally(() => { running = false; });
  }, interval * 1000);
}
