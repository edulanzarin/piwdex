import { NextResponse } from "next/server";
import { getGameLink, updateGameTokens } from "@/lib/game-link";
import { fetchScoredMarket } from "@/lib/market-scan";
import { listActiveWatchlists, matchSnipes, insertNotifications, type NewNotif } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Varredura do sniper de mercado — chamado pelo worker (piwdex-worker) a cada ~60s,
// protegido por CRON_SECRET. Le o mercado ao vivo e casa contra as watchlists ativas;
// grava os anuncios que bateram no inbox (dedup via UNIQUE). So leitura do jogo: por
// isso roda sem a extensao. (Alertas de conta — ovo/streak/etc — sao outro assunto,
// nao entram aqui: esta aba e busca de pokemon no mercado.)

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem segredo configurado, o endpoint fica fechado
  const given = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  return given === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const watchlists = await listActiveWatchlists();
  if (!watchlists.length) return NextResponse.json({ watchlists: 0, candidates: 0, inserted: 0 });

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
  if (!mons) return NextResponse.json({ watchlists: watchlists.length, candidates: 0, inserted: 0 });

  const notifs: NewNotif[] = matchSnipes(watchlists, mons);
  const inserted = await insertNotifications(notifs);
  return NextResponse.json({ watchlists: watchlists.length, candidates: notifs.length, inserted });
}
