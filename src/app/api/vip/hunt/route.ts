import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens, saveTeamSnapshot } from "@/lib/game-link";
import { fetchActivePokes, summonPoke } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg, pokeSellOn } from "@/lib/poke-sell";
import { getRobotDesired, MAX_GOALS, type QueuedGoal } from "@/lib/robot-session-store";
import type { Tokens } from "@/lib/game-auth";
import { normalizeActivePokes, type ActivePoke } from "@/lib/game-account";
import { fighterOf } from "@/lib/hunt-brain";

export const runtime = "nodejs";

// Sessao UNIFICADA do robo, modelo CONEXAO-PRIMEIRO. GET le o estado; POST:
//   connect                                        — LIGA O ROBO: toma a sessao da conta e
//                                                    segura (time ao vivo, summon e jobs
//                                                    passam a operar nela; religa se cair)
//   disconnect                                     — solta a sessao inteira (conexao + jobs)
//   start    {slug, sellItemIds, pokeSellConfig?}  — hunt MANUAL (job em cima da conexao)
//   auto     {pokeSellConfig?}                     — modo AUTO (cerebro escolhe a melhor hunt
//                                                    pro lider e re-escolhe a cada level-up)
//   leveling {goals:[{pokeId,targetLevel}], pokeSellConfig?} — FILA de planos (ate 3): sobe o
//                                                    primeiro pokemon ate o alvo seguindo a
//                                                    sequencia otima de hunts e, ao fechar,
//                                                    ja comeca o proximo da fila sozinho.
//                                                    Aceita o formato antigo {pokeId,targetLevel}.
//   stop                                           — para SO a hunt (a conexao continua)
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
  if (b.action === "disconnect") {
    gameSession.disconnectSession();
    return NextResponse.json(gameSession.getState());
  }
  // A config de venda SALVA (Configuracoes -> banco) vale em TODO inicio de hunt/conexao,
  // venha o start de onde vier (Painel, aba Hunt, boot). Antes so um caminho da UI mandava
  // a config (localStorage) e os outros largavam a hunt sem venda — tudo ia pro acervo.
  // Config explicita no body ainda ganha (compat com clientes antigos).
  const applySellCfg = async (shard: number) => {
    if (b.pokeSellConfig) {
      const cfg = parsePokeSellCfg(b.pokeSellConfig);
      if (cfg.sellRarities.length) { gameSession.setPokeSell(c.userId, c.tokens, shard, cfg, persist); return; }
    }
    const d = await getRobotDesired(c.userId).catch(() => null);
    if (pokeSellOn(d?.pokeSellCfg)) {
      gameSession.setPokeSell(c.userId, c.tokens, shard, parsePokeSellCfg(d!.pokeSellCfg), persist);
    }
  };

  if (b.action === "connect") {
    const es = await ensureShard(c.userId, c.tokens, c.shard);
    if (!es.shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });
    gameSession.connectSession(c.userId, c.tokens, es.shard, persist);
    await applySellCfg(es.shard);
    // self-heal da auto-compra: se o banco diz ligada e o processo perdeu o timer, re-arma
    const d = await getRobotDesired(c.userId).catch(() => null);
    if (d?.autobuy && !gameSession.getAutoBuyOn()) gameSession.setAutoBuy(c.userId, c.tokens, true, persist);
    return NextResponse.json(gameSession.getState());
  }

  if (b.action === "start") {
    const slug = typeof b.slug === "string" && b.slug.trim() ? b.slug.trim() : null;
    if (!slug) return NextResponse.json({ error: "no_slug" }, { status: 400 });
    const es = await ensureShard(c.userId, c.tokens, c.shard);
    if (!es.shard) return NextResponse.json({ error: "no_shard" }, { status: 502 });

    const sellItemIds = Array.isArray(b.sellItemIds)
      ? (b.sellItemIds as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    gameSession.setHunt(c.userId, c.tokens, es.shard, slug, sellItemIds, persist);
    await applySellCfg(es.shard);
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
      const pick = await gameSession.startAuto(c.userId, c.tokens, es.shard, persist, fighterOf(leader));
      if (!pick) return NextResponse.json({ error: "no_hunt_found" }, { status: 422 });
      await applySellCfg(es.shard);
      return NextResponse.json(gameSession.getState());
    }

    // leveling: FILA de metas. A primeira comeca agora (o bicho vira LIDER, que e quem caca
    // e quem upa); as outras esperam na sessao e comecam sozinhas quando a anterior fecha.
    // Formato antigo ({pokeId,targetLevel}) continua valendo — vira uma fila de um.
    const rawGoals = Array.isArray(b.goals) && b.goals.length
      ? (b.goals as unknown[])
      : [{ pokeId: b.pokeId, targetLevel: b.targetLevel }];
    if (rawGoals.length > MAX_GOALS) return NextResponse.json({ error: "too_many_goals" }, { status: 400 });

    const goals: { poke: ActivePoke; targetLevel: number }[] = [];
    for (const raw of rawGoals) {
      const g = (raw ?? {}) as Record<string, unknown>;
      const gid = typeof g.pokeId === "string" ? g.pokeId : String(g.pokeId ?? "");
      const lvl = Number(g.targetLevel);
      if (!gid || !Number.isFinite(lvl) || lvl < 2 || lvl > 400) {
        return NextResponse.json({ error: "bad_goal" }, { status: 400 });
      }
      const poke = pokes.find((p) => p.id === gid);
      if (!poke) return NextResponse.json({ error: "poke_not_found" }, { status: 404 });
      if (poke.level >= lvl) return NextResponse.json({ error: "already_there" }, { status: 400 });
      // o mesmo bicho duas vezes na fila viraria plano em cima de plano
      if (goals.some((x) => x.poke.id === gid)) return NextResponse.json({ error: "dup_goal" }, { status: 400 });
      goals.push({ poke, targetLevel: Math.floor(lvl) });
    }

    const { poke: target, targetLevel } = goals[0];
    const pokeId = target.id;
    const queue: QueuedGoal[] = goals.slice(1).map((g) => ({
      pokeId: g.poke.id, speciesId: g.poke.speciesId, name: g.poke.name, targetLevel: g.targetLevel,
    }));

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
      c.userId, c.tokens, es.shard, persist, fighterOf(target),
      { pokeId, name: target.name, targetLevel },
      queue,
    );
    if (!started) return NextResponse.json({ error: "no_route" }, { status: 422 });
    await applySellCfg(es.shard);
    return NextResponse.json(gameSession.getState());
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
