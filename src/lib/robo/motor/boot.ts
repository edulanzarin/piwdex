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
type Resultado = "retomada" | "sem_vinculo" | "token_vencido" | "conta_recusada" | "sem_shard";

async function retomarUma(contaId: string, userId: string, d: Desejado): Promise<Resultado> {
  const v = await lerVinculo(contaId);
  if (!v) return "sem_vinculo";
  if (v.status === "expired") return "token_vencido"; // so o dono resolve
  // Conta recusada pelo jogo: NAO religa. Reconectar nao desfaz ban, e insistir a
  // cada restart do container era exatamente o comportamento a eliminar.
  if (v.status === "blocked") return "conta_recusada";
  let shard = v.shard ?? 0;
  if (!shard) {
    // Sem shard cacheado nao da pra abrir: descobre agora. Se falhar, o proximo
    // boot tenta de novo (ou o dono religa pela tela).
    const r = await lerPokes(v.tokens, null).catch(() => null);
    if (!r) return "sem_shard";
    shard = r.shard;
    await salvarShard(contaId, shard).catch(() => {});
  }

  const persistir = (t: Tokens) => atualizarTokens(contaId, t);
  // A config vem junto: retomar sem ela deixaria as automacoes desligadas ate
  // alguem abrir a tela — e "ninguem abre a tela" e exatamente a condicao em que
  // o robo trabalha.
  const cfg = await lerConfig(contaId).catch(() => undefined);
  sessaoDe(contaId).retomar(
    { conta: contaId, usuario: userId },
    v.tokens, shard, d.slug, persistir, cfg, v.apelido ?? v.nomeJogador,
    d.placar as never,
  );
  return "retomada";
}

/**
 * Retoma TODAS as sessoes desejadas, ou so a de uma conta.
 *
 * A forma com `apenas` e a que o /conectar usa depois de vincular: religar so a
 * conta que reconectou, sem tocar nas outras — nem nas do mesmo assinante, que
 * agora podem ser varias e estar no meio de uma cacada.
 */
export async function retomarSessoes(apenas?: string): Promise<void> {
  const todas = await listarLigados();
  const alvos = apenas ? todas.filter((x) => x.contaId === apenas) : todas;
  if (!alvos.length) return;

  /**
   * As contas retomam UMA DE CADA VEZ.
   *
   * Em paralelo, seis contas sem shard cacheado disparavam seis descobertas
   * juntas — e cada descoberta abre sockets. O jogo conta CONEXOES por endereco,
   * entao o boot era o instante mais provavel de levar `4006 ip-limit`, logo
   * quando o robo mais precisa subir.
   *
   * Serializar custa segundos no boot e vale cada um: uma conta que nao sobe
   * fica parada ate alguem abrir a tela, e quem usa o robo nao fica olhando a
   * tela — que e o motivo de este arquivo existir.
   */
  const r: PromiseSettledResult<Resultado>[] = [];
  for (const x of alvos) {
    r.push(
      await retomarUma(x.contaId, x.userId, x.desejado).then(
        (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<Resultado>,
        (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult,
      ),
    );
  }

  /**
   * O log conta o que ACONTECEU, e nao quantas promessas nao explodiram.
   *
   * A primeira versao dizia "1/1 retomada" quando o unico alvo tinha saido pela
   * porta do token vencido: sair cedo tambem resolve a promessa. Um contador que
   * conta sucesso de promessa em vez de sucesso de trabalho e pior que nenhum —
   * ele afirma que deu certo.
   */
  const conta = new Map<string, number>();
  for (const [i, res] of r.entries()) {
    if (res.status === "rejected") {
      conta.set("erro", (conta.get("erro") ?? 0) + 1);
      console.error(`[robo] conta ${alvos[i].contaId} nao retomou:`, res.reason);
      continue;
    }
    conta.set(res.value, (conta.get(res.value) ?? 0) + 1);
  }
  const resumo = [...conta].map(([k, n]) => `${n} ${k}`).join(", ");
  console.info(`[robo] boot: ${alvos.length} conta(s) desejada(s) -> ${resumo}`);
}
