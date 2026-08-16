import { NextResponse } from "next/server";
import { getGameLink, updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { fetchScoredMarket } from "@/lib/market-scan";
import { fetchFullAccount } from "@/lib/game-fetch";
import {
  listActiveWatchlists,
  listAlertableUsers,
  matchSnipes,
  accountAlerts,
  insertNotifications,
  type NewNotif,
} from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Varredura de alertas — o coracao do sniper passivo. Chamado pelo worker
// (piwdex-worker) a cada ~60s, protegido por CRON_SECRET. Le mercado + conta de
// cada VIP vinculado e grava as notificacoes (dedup via UNIQUE). Nao escreve nada
// na conta do jogo: por isso roda sem a extensao.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // sem segredo configurado, o endpoint fica fechado
  const given = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  return given === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [watchlists, users] = await Promise.all([listActiveWatchlists(), listAlertableUsers()]);
  if (!users.length) return NextResponse.json({ users: 0, inserted: 0 });

  const dayBucket = new Date().toISOString().slice(0, 10);
  const notifs: NewNotif[] = [];

  // 1) Mercado (global) — puxa UMA vez, com o token de qualquer VIP com watchlist.
  const watchers = [...new Set(watchlists.map((w) => w.userId))];
  if (watchers.length) {
    for (const uid of watchers) {
      const link = await getGameLink(uid);
      if (!link || link.status === "expired") continue;
      const sm = await fetchScoredMarket(link.tokens).catch(() => null);
      if (sm) {
        if (sm.changed) await updateGameTokens(uid, sm.tokens);
        notifs.push(...matchSnipes(watchlists, sm.mons));
        break;
      }
    }
  }

  // 2) Conta de cada VIP vinculado — alertas idle.
  for (const uid of users) {
    const link = await getGameLink(uid);
    if (!link || link.status === "expired") continue;
    const acc = await fetchFullAccount(link.tokens).catch(() => null);
    if (!acc) continue;
    if ("unauth" in acc) {
      await markGameLinkExpired(uid);
      continue;
    }
    if (acc.changed) await updateGameTokens(uid, acc.tokens);
    notifs.push(...accountAlerts(uid, acc.account, dayBucket));
  }

  const inserted = await insertNotifications(notifs);
  return NextResponse.json({
    users: users.length,
    watchlists: watchlists.length,
    candidates: notifs.length,
    inserted,
  });
}
