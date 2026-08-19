import { listEnabledSessions } from "@/lib/robot-session-store";
import { getGameLink, updateGameTokens, saveGameShard } from "@/lib/game-link";
import { fetchActivePokes } from "@/lib/game-ws";
import { gameSession } from "@/lib/game-hunt-session";
import { normalizeActivePokes } from "@/lib/game-account";
import { fighterOf, type FighterProfile } from "@/lib/hunt-brain";

// Boot do robo: religa a sessao persistida quando o container (re)nasce. Chamado pelo
// instrumentation.ts com um delay (banco subindo). O motor e single-conta por processo:
// religa a sessao enabled mais recente. Sem sessao enabled, nao faz nada.

export async function resumeRobotSessions(preferUserId?: string): Promise<void> {
  const sessions = await listEnabledSessions();
  // Quem acabou de vincular tem preferencia. Sem isso o resume pegava sempre "a mais
  // recente" da tabela — que no fluxo de TROCA DE CONTA e a ANTIGA, e ela tomava o motor
  // de volta de quem acabou de conectar (a hunt velha reaparecia na tela nova).
  const first = (preferUserId ? sessions.find((x) => x.userId === preferUserId) : null) ?? sessions[0];
  if (!first) return;

  // O motor e single-conta por processo: se OUTRA conta ja esta segurando a sessao, o
  // resume nao toma dela. Religar e pra quando o motor esta livre (boot) ou ja e dela.
  if (gameSession.hasOwner() && !gameSession.ownedBy(first.userId)) return;

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
  const fighter: FighterProfile | null = src ? fighterOf(src) : null;

  const persist = (tk: Parameters<typeof updateGameTokens>[1]) => updateGameTokens(first.userId, tk);

  // so autobuy (sem conexao desejada): arma o timer REST e pronto — nao toma a sessao
  if (!d.enabled) {
    if (d.autobuy) gameSession.setAutoBuy(first.userId, link.tokens, true, persist);
    return;
  }

  await gameSession.resume(first.userId, link.tokens, shard, persist, d, fighter);
}
