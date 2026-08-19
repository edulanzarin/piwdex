import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGameLink, saveGameShard, updateGameTokens } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { parsePokeSellCfg, pokeSellOn, DEFAULT_POKE_SELL } from "@/lib/poke-sell";
import { getRobotDesired, saveRobotDesired } from "@/lib/robot-session-store";
import type { Tokens } from "@/lib/game-auth";

export const runtime = "nodejs";

// Job VENDA DE POKEMON (24/7). Fonte da VERDADE: o banco (robot_sessions.poke_sell_cfg,
// travas + interruptor `on`) — nao mais o localStorage do navegador, que so valia num
// caminho da UI e fazia hunt rodar sem venda. GET le config salva + estado vivo; POST:
//   save  { on, config? } — persiste travas+interruptor SEM exigir conexao; se a sessao
//                           esta viva, aplica/para na hora. `config` ausente = mantem as
//                           travas salvas (so muda o interruptor).
//   start { config }      — legado: persiste ligado e aplica (conecta se preciso).
//   stop                  — legado: desliga a venda (travas ficam salvas).

async function ctx() {
  const s = await auth();
  if (!s?.user?.id) return { error: NextResponse.json({ error: "not_logged" }, { status: 401 }) };
  if (!s.user.vip) return { error: NextResponse.json({ error: "vip_only" }, { status: 403 }) };
  const link = await getGameLink(s.user.id);
  if (!link || link.status === "expired") return { error: NextResponse.json({ error: "not_connected" }, { status: 409 }) };
  return { userId: s.user.id, tokens: link.tokens, shard: link.shard };
}

async function savedState(userId: string) {
  const d = await getRobotDesired(userId).catch(() => null);
  const saved = d?.pokeSellCfg ?? null;
  return {
    ...gameSession.getAutoSellViewFor(userId),
    on: pokeSellOn(saved),
    config: saved ? parsePokeSellCfg(saved) : null,
  };
}

export async function GET() {
  const c = await ctx();
  if (c.error) return c.error;
  return NextResponse.json(await savedState(c.userId));
}

async function ensureShard(userId: string, tokens: Tokens, shard: number | null): Promise<number | null> {
  if (shard) return shard;
  const r = await fetchActivePokes(tokens, null).catch(() => null);
  if (!r) return null;
  await saveGameShard(userId, r.shard);
  return r.shard;
}

export async function POST(req: Request) {
  const c = await ctx();
  if (c.error) return c.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const persist = (t: Tokens) => updateGameTokens(c.userId, t);

  if (b.action === "save" || b.action === "start" || b.action === "stop") {
    const on = b.action === "start" ? true : b.action === "stop" ? false : b.on === true;

    // travas: as do body > as salvas > padrao seguro (ligar sem nunca ter mexido funciona)
    const d = await getRobotDesired(c.userId).catch(() => null);
    const cfg = b.config
      ? parsePokeSellCfg(b.config)
      : d?.pokeSellCfg
        ? parsePokeSellCfg(d.pokeSellCfg)
        : { ...DEFAULT_POKE_SELL };
    if (on && !cfg.sellRarities.length) return NextResponse.json({ error: "empty_config" }, { status: 400 });

    await saveRobotDesired(c.userId, { pokeSellCfg: { ...cfg, on } });

    // aplica na sessao VIVA na hora; sem sessao, fica salvo e religa no proximo start/connect.
    // `save` nunca CONECTA sozinho (salvar config nao toma a sessao do jogo); o `start`
    // legado mantem o comportamento antigo de conectar.
    const live = gameSession.getStateFor(c.userId).wsOpen;
    if (!on) {
      if (gameSession.getStateFor(c.userId).pokeSellOn) gameSession.stopPokeSell();
    } else if (live || b.action === "start") {
      const shard = await ensureShard(c.userId, c.tokens, c.shard);
      if (!shard) {
        if (b.action === "start") return NextResponse.json({ error: "no_shard" }, { status: 502 });
      } else {
        gameSession.setPokeSell(c.userId, c.tokens, shard, cfg, persist);
      }
    }
    return NextResponse.json(await savedState(c.userId));
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
