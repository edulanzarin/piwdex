import { listEnabledSessions } from "@/lib/robot-session-store";
import { getGameLink, updateGameTokens, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { normalizeActivePokes } from "@/lib/game-account";
import type { FighterProfile } from "@/lib/hunt-brain";

// Boot do robo: religa a sessao persistida quando o container (re)nasce. Chamado pelo
// instrumentation.ts com um delay (banco subindo). O motor e single-conta por processo:
// religa a sessao enabled mais recente. Sem sessao enabled, nao faz nada.

export async function resumeRobotSessions(): Promise<void> {
  const sessions = await listEnabledSessions();
  const first = sessions[0];
  if (!first) return;

  const link = await getGameLink(first.userId);
  if (!link || link.status === "expired") return;

  // shard: usa o cacheado; sem cache, descobre (e ja aproveita a lista viva pro lider)
  let shard = link.shard ?? 0;
  let team = link.team?.list ?? [];
  if (!shard) {
    const r = await fetchActivePokes(link.tokens, null).catch(() => null);
    if (!r) return; // proximo boot tenta de novo (ou o usuario religa pela UI)
    shard = r.shard;
    await saveGameShard(first.userId, shard).catch(() => {});
    const live = normalizeActivePokes(r.pokes);
    if (live.length) team = live;
  }

  const d = first.desired;
  // perfil do pokemon que caca: o do plano de leveling, senao o lider do snapshot
  const src = (d.leveling && team.find((p) => p.id === d.leveling!.pokeId))
    ?? team.find((p) => p.leader) ?? team[0] ?? null;
  const fighter: FighterProfile | null = src
    ? { speciesId: src.speciesId, level: src.level, ivTotal: src.ivTotal, quality: src.quality }
    : null;

  const persist = (tk: Parameters<typeof updateGameTokens>[1]) => updateGameTokens(first.userId, tk);
  await gameSession.resume(first.userId, link.tokens, shard, persist, d, fighter);
}
