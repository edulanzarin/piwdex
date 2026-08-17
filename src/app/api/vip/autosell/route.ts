import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg } from "@/lib/poke-sell";
import type { Tokens } from "@/lib/game-auth";

export const runtime = "nodejs";

// Job VENDA DE POKEMON (24/7) da sessao UNIFICADA. GET le o estado; POST start liga a
// venda (na mesma conexao da Hunt, se houver — sem derrubar); stop desliga so a venda de
// pokemon (a hunt segue, se estiver ligada). Ver src/lib/game-hunt-session.ts.

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
  return NextResponse.json(gameSession.getAutoSellView());
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "stop") {
    gameSession.stopPokeSell();
    return NextResponse.json(gameSession.getAutoSellView());
  }
  if (b.action === "start") {
    const cfg = parsePokeSellCfg(b.config);
    if (!cfg.sellRarities.length) return NextResponse.json({ error: "empty_config" }, { status: 400 });

    let shard = c.shard;
    if (!shard) {
      const r = await fetchActivePokes(c.tokens, null).catch(() => null);
      if (r) { shard = r.shard; if (r.shard !== c.shard) await saveGameShard(c.userId, r.shard); }
    }
    if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

    const persist = (t: Tokens) => updateGameTokens(c.userId, t);
    gameSession.setPokeSell(c.userId, c.tokens, shard, cfg, persist);
    return NextResponse.json(gameSession.getAutoSellView());
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
