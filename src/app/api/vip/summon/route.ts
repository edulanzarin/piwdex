import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes, summonPoke } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Troca o pokemon ATIVO/LIDER (o que caca) na conta REAL — poke-summon. Com a hunt rodando,
// manda pelo socket VIVO (mesma sessao, sem derrubar a caca); sem hunt, faz um one-shot.
// Muta a conta (reversivel: e so trocar de volta). Ver src/lib/game-hunt-session.ts.

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { pokeId?: unknown };
  const pokeId = typeof b.pokeId === "string" && b.pokeId.trim() ? b.pokeId.trim() : null;
  if (!pokeId) return NextResponse.json({ error: "bad_poke" }, { status: 400 });

  // 1) hunt viva: manda no socket que o piwdex ja segura (single-session)
  if (gameSession.summonActive(pokeId)) return NextResponse.json({ ok: true, live: true });

  // 2) sem hunt: one-shot no shard (descobre se nao tiver cache)
  let shard = link.shard;
  if (!shard) {
    const r = await fetchActivePokes(link.tokens, null).catch(() => null);
    if (r) { shard = r.shard; if (r.shard !== link.shard) await saveGameShard(s.user.id, r.shard); }
  }
  if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

  const ok = await summonPoke(link.tokens, shard, pokeId).catch(() => false);
  return ok ? NextResponse.json({ ok: true, live: false }) : NextResponse.json({ error: "summon_failed" }, { status: 502 });
}
