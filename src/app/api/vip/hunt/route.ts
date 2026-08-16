import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { huntSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Hunt Analyzer ao vivo: GET le o estado da sessao que o piwdex segura; POST start/stop
// controla. start SEGURA a sessao WS do jogo (kicka o navegador — single-session) e faz
// poll do analyzer. Ver src/lib/game-hunt-session.ts.

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
  return NextResponse.json(huntSession.getState());
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "stop") {
    huntSession.stop();
    return NextResponse.json(huntSession.getState());
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
    huntSession.start(c.tokens, shard, slug);
    return NextResponse.json(huntSession.getState());
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
