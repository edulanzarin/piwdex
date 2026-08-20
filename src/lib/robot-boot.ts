import { listEnabledSessions, type RobotDesired } from "@/lib/robot-session-store";
import { getGameLink, updateGameTokens, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { sessionFor } from "@/lib/game-hunt-session";
import { normalizeActivePokes } from "@/lib/game-account";
import { fighterOf, type FighterProfile } from "@/lib/hunt-brain";

// Boot do robo: religa as sessoes persistidas quando o container (re)nasce. Chamado pelo
// instrumentation.ts com um delay (banco subindo).
//
// Antes o motor era UM por processo e isto religava so "a sessao enabled mais recente" —
// o resto dos assinantes ficava parado ate abrir a UI, e quem religasse por ultimo tomava
// a conexao de quem ja estava rodando. Com uma sessao POR USUARIO, todas voltam.

async function resumeOne(userId: string, d: RobotDesired): Promise<void> {
  const link = await getGameLink(userId);
  if (!link || link.status === "expired") return;

  // shard: usa o cacheado; sem cache, descobre (e ja aproveita a lista viva pro lider)
  let shard = link.shard ?? 0;
  let team = link.team?.list ?? [];
  if (!shard) {
    const r = await fetchActivePokes(link.tokens, null).catch(() => null);
    if (!r) return; // proximo boot tenta de novo (ou o usuario religa pela UI)
    shard = r.shard;
    await saveGameShard(userId, shard).catch(() => {});
    const live = normalizeActivePokes(r.pokes);
    if (live.length) team = live;
  }

  // perfil do pokemon que caca: o do plano de leveling, senao o lider do snapshot
  const src = (d.leveling && team.find((p) => p.id === d.leveling!.pokeId))
    ?? team.find((p) => p.leader) ?? team[0] ?? null;
  const fighter: FighterProfile | null = src ? fighterOf(src) : null;

  const persist = (tk: Parameters<typeof updateGameTokens>[1]) => updateGameTokens(userId, tk);
  const session = sessionFor(userId);

  // so autobuy (sem conexao desejada): arma o timer REST e pronto — nao toma a sessao
  if (!d.enabled) {
    if (d.autobuy) session.setAutoBuy(userId, link.tokens, true, persist);
    return;
  }

  await session.resume(userId, link.tokens, shard, persist, d, fighter);
}

/**
 * Religa as sessoes desejadas. Sem argumento (boot) retoma TODAS; com `onlyUserId` retoma
 * so aquela — e o que o /api/connect usa depois de vincular, pra nao mexer na sessao dos
 * outros assinantes so porque um reconectou.
 *
 * Uma falha isolada nao derruba as demais: cada retomada e independente.
 */
export async function resumeRobotSessions(onlyUserId?: string): Promise<void> {
  const sessions = await listEnabledSessions();
  const alvos = onlyUserId ? sessions.filter((x) => x.userId === onlyUserId) : sessions;
  if (!alvos.length) return;

  const results = await Promise.allSettled(alvos.map((x) => resumeOne(x.userId, x.desired)));
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      console.error(`[robot-boot] ${alvos[i].userId} nao retomou:`, r.reason);
    }
  }
}
