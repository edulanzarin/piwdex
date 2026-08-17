import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes, summonPoke } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";
import { gameSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Troca o pokemon ATIVO/LIDER (o que caca) na conta REAL — poke-summon. Com a hunt rodando,
// manda pelo socket VIVO (mesma sessao, sem derrubar a caca; a sessao atualiza o snapshot do
// time sozinha no proximo pokes). Sem hunt, faz um one-shot e ja regrava o snapshot do time
// com a lista lida, pra a Conta refletir o novo lider na hora. Ver game-hunt-session.ts.

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { pokeId?: unknown };
  const pokeId = typeof b.pokeId === "string" && b.pokeId.trim() ? b.pokeId.trim() : null;
  if (!pokeId) return NextResponse.json({ error: "bad_poke" }, { status: 400 });

  // 1) hunt viva: manda no socket que o piwdex ja segura (single-session). A sessao regrava o
  // snapshot do time quando o pokes chegar de volta (summonActive ja pede pokes-get).
  if (gameSession.summonActive(pokeId)) return NextResponse.json({ ok: true, live: true });

  // 2) sem hunt: one-shot no shard (descobre se nao tiver cache)
  let shard = link.shard;
  if (!shard) {
    const r = await fetchActivePokes(link.tokens, null).catch(() => null);
    if (r) { shard = r.shard; if (r.shard !== link.shard) await saveGameShard(s.user.id, r.shard); }
  }
  if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

  const list = await summonPoke(link.tokens, shard, pokeId).catch(() => null);
  if (!list) return NextResponse.json({ error: "summon_failed" }, { status: 502 });

  // regrava o snapshot do time com a lista lida (a Conta reflete o novo lider no proximo poll)
  try {
    const all = normalizeActivePokes(list);
    const team = all.filter((p) => p.team).sort((x, y) => x.slot - y.slot);
    await saveTeamSnapshot(s.user.id, team, all.length);
  } catch { /* o summon ja funcionou; snapshot e best-effort */ }

  return NextResponse.json({ ok: true, live: false });
}
