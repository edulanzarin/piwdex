import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { autoSellSession } from "@/lib/game-auto-sell-session";
import { huntSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg } from "@/lib/poke-sell";
import type { Tokens } from "@/lib/game-auth";

export const runtime = "nodejs";

// Venda automatica 24/7: GET le o estado do robo; POST start/stop controla. start SEGURA
// a sessao WS (kicka o navegador — single-session) e vende sozinho a cada ciclo. Ver
// src/lib/game-auto-sell-session.ts. Mutuamente exclusivo com o Hunt Analyzer.

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
  return NextResponse.json(autoSellSession.getState());
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "stop") {
    autoSellSession.stop();
    return NextResponse.json(autoSellSession.getState());
  }
  if (b.action === "start") {
    const cfg = parsePokeSellCfg(b.config);
    // sem raridade marcada => nao venderia nada; recusa pra nao dar falsa sensacao de ligado
    if (!cfg.sellRarities.length) return NextResponse.json({ error: "empty_config" }, { status: 400 });

    // garante o shard (cacheado; senao descobre e salva)
    let shard = c.shard;
    if (!shard) {
      const r = await fetchActivePokes(c.tokens, null).catch(() => null);
      if (r) { shard = r.shard; if (r.shard !== c.shard) await saveGameShard(c.userId, r.shard); }
    }
    if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

    // single-session: o Hunt tambem segura o WS — ligar a venda automatica para o Hunt.
    huntSession.stop();

    const persist = (t: Tokens) => updateGameTokens(c.userId, t);
    autoSellSession.start(c.tokens, shard, cfg, persist);
    return NextResponse.json(autoSellSession.getState());
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
