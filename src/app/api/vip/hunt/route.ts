import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg } from "@/lib/poke-sell";
import type { Tokens } from "@/lib/game-auth";

export const runtime = "nodejs";

// Job HUNT da sessao UNIFICADA (uma conexao WS faz hunt + venda de drops + venda de pokemon).
// GET le o estado; POST start liga a hunt (opcionalmente ja com venda de pokemon junto);
// stop desliga so a hunt (a venda de pokemon 24/7 segue, se estiver ligada). Ver
// src/lib/game-hunt-session.ts.

async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id, tokens: link.tokens, shard: link.shard };
}

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;
  return NextResponse.json(gameSession.getState());
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "stop") {
    gameSession.stopHunt();
    return NextResponse.json(gameSession.getState());
  }
  if (b.action === "start") {
    const slug = typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : null;
    if (!slug) return NextResponse.json({ error: "no_slug" }, { status: 400 });
    // garante o shard (cacheado no link; senao descobre e salva)
    let shard = c.shard;
    if (!shard) {
      const r = await fetchActivePokes(c.tokens, null).catch(() => null);
      if (r) { shard = r.shard; if (r.shard !== c.shard) await saveGameShard(c.userId, r.shard); }
    }
    if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

    const sellItemIds = Array.isArray(b.sellItemIds)
      ? (b.sellItemIds as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    const persist = (tk: Tokens) => updateGameTokens(c.userId, tk);
    gameSession.setHunt(c.userId, c.tokens, shard, slug, sellItemIds, persist);
    // opcional: liga a venda de pokemon junto (config vem do cliente, mesma trava do card 24/7)
    if (b.pokeSellConfig) {
      const cfg = parsePokeSellCfg(b.pokeSellConfig);
      if (cfg.sellRarities.length) gameSession.setPokeSell(c.userId, c.tokens, shard, cfg, persist);
    }
    return NextResponse.json(gameSession.getState());
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
