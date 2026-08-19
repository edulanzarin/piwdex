import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes, movePokeOneShot, healTeamOneShot } from "@/lib/game-ws";
import { normalizeActivePokes } from "@/lib/game-account";
import { gameSession } from "@/lib/game-hunt-session";

export const runtime = "nodejs";

// Gerencia o TIME na conta REAL — poke-store (guarda no box) / poke-withdraw (tira do box
// pro time) / joy-heal (cura o time na enfermeira Joy; pokemon em 0 HP nao entra em campo).
// Frames confirmados por HAR ago/2026; o jogo responde com `pokes` atualizado.
// Mesmo desenho do /api/vip/summon: com sessao viva manda no socket segurado (single-session,
// nao derruba a caca); sem sessao, one-shot + regrava o snapshot do time. MUTA a conta —
// a UI pede confirmacao antes de chamar.
//
// GET: lista o BOX (pokes fora do time) pro modal de retirada — ao vivo da sessao segurada
// ou por one-shot de leitura.

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  // 1) sessao viva: box ja esta em memoria (frames pokes)
  const live = gameSession.getLiveBoxFor(s.user.id);
  if (live) return NextResponse.json({ box: live, live: true });

  // 2) sem sessao: one-shot de leitura no shard
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });
  const r = await fetchActivePokes(link.tokens, link.shard).catch(() => null);
  if (!r) return NextResponse.json({ error: "read_failed" }, { status: 502 });
  if (r.shard !== link.shard) await saveGameShard(s.user.id, r.shard);
  const box = normalizeActivePokes(r.pokes).filter((p) => !p.team);
  return NextResponse.json({ box, live: false });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "not_logged" }, { status: 401 });
  if (!s.user.vip) return NextResponse.json({ error: "vip_only" }, { status: 403 });

  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const b = (await req.json().catch(() => ({}))) as { pokeId?: unknown; action?: unknown };
  const pokeId = typeof b.pokeId === "string" && b.pokeId.trim() ? b.pokeId.trim() : null;

  // resolve o shard uma vez (cacheado no link; senao descobre e salva) — os dois caminhos
  // sem sessao viva precisam dele
  const withShard = async () => {
    let shard = link.shard;
    if (!shard) {
      const r = await fetchActivePokes(link.tokens, null).catch(() => null);
      if (r) { shard = r.shard; if (r.shard !== link.shard) await saveGameShard(s.user!.id, r.shard); }
    }
    return shard;
  };

  // CURA (sem pokeId): a Joy cura o time inteiro de uma vez
  if (b.action === "heal") {
    if (gameSession.ownedBy(s.user.id) && gameSession.healTeam()) return NextResponse.json({ ok: true, live: true });
    const shard = await withShard();
    if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });
    const list = await healTeamOneShot(link.tokens, shard).catch(() => null);
    if (!list) return NextResponse.json({ error: "heal_failed" }, { status: 502 });
    try {
      const all = normalizeActivePokes(list);
      await saveTeamSnapshot(s.user.id, all.filter((p) => p.team).sort((x, y) => x.slot - y.slot), all.length);
    } catch { /* a cura ja confirmou; snapshot e best-effort */ }
    return NextResponse.json({ ok: true, live: false });
  }

  const action = b.action === "store" || b.action === "withdraw" ? b.action : null;
  if (!pokeId || !action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // 1) sessao viva: manda no socket segurado (a sessao ja pede pokes-get e atualiza tudo)
  if (gameSession.ownedBy(s.user.id) && gameSession.movePoke(pokeId, action)) return NextResponse.json({ ok: true, live: true });

  // 2) sem sessao: one-shot no shard (descobre se nao tiver cache)
  const shard = await withShard();
  if (!shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

  const list = await movePokeOneShot(link.tokens, shard, pokeId, action).catch(() => null);
  if (!list) return NextResponse.json({ error: "move_failed" }, { status: 502 });

  // regrava o snapshot do time com a lista confirmada (a Conta reflete na hora)
  try {
    const all = normalizeActivePokes(list);
    const team = all.filter((p) => p.team).sort((x, y) => x.slot - y.slot);
    await saveTeamSnapshot(s.user.id, team, all.length);
  } catch { /* o movimento ja confirmou; snapshot e best-effort */ }

  return NextResponse.json({ ok: true, live: false });
}
