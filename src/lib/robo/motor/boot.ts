import { listarLigados, type Desejado } from "@/lib/robo/motor/desejado";
import { atualizarTokens, lerVinculo, salvarShard } from "@/lib/robo/vinculo";
import { lerPokes } from "@/lib/robo/jogo/ws";
import { sessaoDe } from "@/lib/robo/motor/sessao";
import { lerConfig } from "@/lib/robo/motor/config";
import type { Tokens } from "@/lib/robo/jogo/auth";

/**
 * Religa as sessoes quando o processo (re)nasce.
 *
 * Sem isto, um restart deixaria todo assinante parado ate alguem abrir a tela —
 * e "abrir a tela" e justamente o que ninguem faz enquanto o robo esta jogando
 * por ele. O estado desejado no banco existe pra este momento.
 *
 * Cada retomada e independente: uma falha nao derruba as outras.
 */
async function retomarUma(userId: string, d: Desejado): Promise<void> {
  const v = await lerVinculo(userId);
  if (!v) return;
  if (v.status === "expired") return; // precisa de token novo; so o dono resolve
  // Conta recusada pelo jogo: NAO religa. Reconectar nao desfaz ban, e insistir a
  // cada restart do container era exatamente o comportamento a eliminar.
  if (v.status === "blocked") return;
  let shard = v.shard ?? 0;
  if (!shard) {
    // Sem shard cacheado nao da pra abrir: descobre agora. Se falhar, o proximo
    // boot tenta de novo (ou o dono religa pela tela).
    const r = await lerPokes(v.tokens, null).catch(() => null);
    if (!r) return;
    shard = r.shard;
    await salvarShard(userId, shard).catch(() => {});
  }

  const persistir = (t: Tokens) => atualizarTokens(userId, t);
  // A config vem junto: retomar sem ela deixaria as automacoes desligadas ate
  // alguem abrir a tela — e "ninguem abre a tela" e exatamente a condicao em que
  // o robo trabalha.
  const cfg = await lerConfig(userId).catch(() => undefined);
  sessaoDe(userId).retomar(userId, v.tokens, shard, d.slug, persistir, cfg, v.nomeJogador);
}

/**
 * Retoma TODAS as sessoes desejadas, ou so a de um usuario.
 *
 * A forma com `apenas` e a que o /conectar usa depois de vincular: religar so
 * quem reconectou, sem mexer na sessao dos outros assinantes.
 */
export async function retomarSessoes(apenas?: string): Promise<void> {
  const todas = await listarLigados();
  const alvos = apenas ? todas.filter((x) => x.userId === apenas) : todas;
  if (!alvos.length) return;

  const r = await Promise.allSettled(alvos.map((x) => retomarUma(x.userId, x.desejado)));
  for (const [i, res] of r.entries()) {
    if (res.status === "rejected") {
      console.error(`[robo] ${alvos[i].userId} nao retomou:`, res.reason);
    }
  }
}
