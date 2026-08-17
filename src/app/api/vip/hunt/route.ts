import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes, summonPoke } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg } from "@/lib/poke-sell";
import type { Tokens } from "@/lib/game-auth";
import { normalizeActivePokes, type ActivePoke } from "@/lib/game-account";
import type { FighterProfile } from "@/lib/hunt-brain";

export const runtime = "nodejs";

// Job HUNT da sessao UNIFICADA. GET le o estado; POST:
//   start    {slug, sellItemIds, pokeSellConfig?}  — modo MANUAL (usuario escolheu a hunt)
//   auto     {pokeSellConfig?}                     — modo AUTO (cerebro escolhe a melhor hunt
//                                                    pro lider e re-escolhe a cada level-up)
//   leveling {pokeId, targetLevel, pokeSellConfig?} — plano de leveling: sobe o pokemon ate o
//                                                    alvo seguindo a sequencia otima de hunts
//   stop                                           — desliga tudo
// Ver src/lib/game-hunt-session.ts e src/lib/hunt-brain.ts.

async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id, tokens: link.tokens, shard: link.shard, team: link.team };
}

// garante o shard (cacheado no link; senao descobre e salva) e, de quebra, a lista viva
async function ensureShard(userId: string, tokens: Tokens, shard: number | null) {
  if (shard) return { shard, pokes: null as ActivePoke[] | null };
  const r = await fetchActivePokes(tokens, null).catch(() => null);
  if (!r) return { shard: null, pokes: null };
  await saveGameShard(userId, r.shard);
  return { shard: r.shard, pokes: normalizeActivePokes(r.pokes) };
}

const profileOf = (p: ActivePoke): FighterProfile =>
  ({ speciesId: p.speciesId, level: p.level, ivTotal: p.ivTotal, quality: p.quality });

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;
  return NextResponse.json(gameSession.getState());
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const persist = (tk: Tokens) => updateGameTokens(c.userId, tk);

  if (b.action === "stop") {
    gameSession.stopHunt();
    return NextResponse.json(gameSession.getState());
  }

  const applySellCfg = (shard: number) => {
    if (b.pokeSellConfig) {
      const cfg = parsePokeSellCfg(b.pokeSellConfig);
      if (cfg.sellRarities.length) gameSession.setPokeSell(c.userId, c.tokens, shard, cfg, persist);
    }
  };

  if (b.action === "start") {
    const slug = typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : null;
    if (!slug) return NextResponse.json({ error: "no_slug" }, { status: 400 });
    const es = await ensureShard(c.userId, c.tokens, c.shard);
    if (!es.shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

    const sellItemIds = Array.isArray(b.sellItemIds)
      ? (b.sellItemIds as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    gameSession.setHunt(c.userId, c.tokens, es.shard, slug, sellItemIds, persist);
    applySellCfg(es.shard);
    return NextResponse.json(gameSession.getState());
  }

  if (b.action === "auto" || b.action === "leveling") {
    const es = await ensureShard(c.userId, c.tokens, c.shard);
    if (!es.shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });
    // lista viva se ja veio da descoberta de shard; senao o snapshot do time
    const pokes = es.pokes ?? c.team?.list ?? [];
    if (!pokes.length) return NextResponse.json({ error: "no_team" }, { status: 409 });

    if (b.action === "auto") {
      const leader = pokes.find((p) => p.leader) ?? pokes[0];
      const pick = await gameSession.startAuto(c.userId, c.tokens, es.shard, persist, profileOf(leader));
      if (!pick) return NextResponse.json({ error: "no_hunt_found" }, { status: 422 });
      applySellCfg(es.shard);
      return NextResponse.json(gameSession.getState());
    }

    // leveling: acha o pokemon, garante que ele e o LIDER (quem caca e quem upa) e segue o plano
    const pokeId = typeof b.pokeId === "string" ? b.pokeId : String(b.pokeId ?? "");
    const targetLevel = Number(b.targetLevel);
    if (!pokeId || !Number.isFinite(targetLevel) || targetLevel < 2 || targetLevel > 400) {
      return NextResponse.json({ error: "bad_goal" }, { status: 400 });
    }
    const target = pokes.find((p) => p.id === pokeId);
    if (!target) return NextResponse.json({ error: "poke_not_found" }, { status: 404 });
    if (target.level >= targetLevel) return NextResponse.json({ error: "already_there" }, { status: 400 });

    if (!target.leader) {
      // summon ANTES de ligar a hunt (sessao viva usa o socket; senao one-shot)
      if (!gameSession.summonActive(pokeId)) {
        const raw = await summonPoke(c.tokens, es.shard, pokeId).catch(() => null);
        if (!raw) return NextResponse.json({ error: "summon_failed" }, { status: 502 });
        const live = normalizeActivePokes(raw);
        const team = live.filter((p) => p.team).sort((a, b2) => a.slot - b2.slot);
        await saveTeamSnapshot(c.userId, team, live.length);
      }
    }
    const started = await gameSession.startLeveling(
      c.userId, c.tokens, es.shard, persist, profileOf(target),
      { pokeId, name: target.name, targetLevel: Math.floor(targetLevel) },
    );
    if (!started) return NextResponse.json({ error: "no_route" }, { status: 422 });
    applySellCfg(es.shard);
    return NextResponse.json(gameSession.getState());
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
