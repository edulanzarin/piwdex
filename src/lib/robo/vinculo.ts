import { query, queryOne } from "@/lib/robo/db";
import { cifrar, decifrar, type Recusa, type Tokens } from "@/lib/robo/jogo/auth";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";

/**
 * As contas do JOGO ligadas a uma conta do piwdex (tabela `game_links`).
 *
 * **Varias por usuario.** Ate a migration 004 era uma so, e nao por regra de
 * codigo: `user_id` era a chave primaria, entao a segunda conta era impossivel
 * de gravar. Agora a chave e o VINCULO, e e ele que governa tudo que o robo faz
 * — sessao, config, placar, registro. Um WebSocket por conta.
 *
 * O que continua sendo do usuario e o que ele PAGA e o que ele PODE VER: toda
 * leitura por id passa por `contaDoUsuario`, senao um id vazado daria acesso a
 * conta de jogo de outra pessoa.
 *
 * Os tokens vivem cifrados no banco — nunca em cookie, nunca em memoria
 * compartilhada.
 *
 * Os tres status nao sao graus do mesmo problema; eles pedem tratamentos
 * opostos, e confundi-los foi um bug real do v1:
 *
 *   active   vinculo bom.
 *   expired  o refresh falhou. RECONECTAR resolve — token novo e pronto.
 *   blocked  o jogo RECUSOU a conta (403). Reconectar nao desfaz ban, e insistir
 *            a cada restart era exatamente o comportamento a eliminar. Sai desse
 *            estado so quando o jogador vincula de novo e o jogo aceita.
 */

export interface SnapshotTime {
  lista: ActivePoke[];
  total: number;
  em: string; // ISO
}

export type StatusVinculo = "active" | "expired" | "blocked";

export interface Vinculo {
  id: string;
  tokens: Tokens;
  cmid: string | null;
  nomeJogador: string | null;
  /** o nome que o DONO deu. O jogo nao sabe qual conta e "a de farm". */
  apelido: string | null;
  status: StatusVinculo;
  shard: number | null;
  time: SnapshotTime | null;
  /** so quando `status = 'blocked'`: o que o jogo respondeu, e quando */
  bloqueioStatus: number | null;
  bloqueioMotivo: string | null;
  bloqueadoEm: string | null;
}

/** O que a tela precisa pra desenhar o seletor: identidade e saude, sem token. */
export interface ContaResumo {
  id: string;
  nomeJogador: string | null;
  apelido: string | null;
  status: StatusVinculo;
  criadoEm: string;
}

interface Linha {
  id: string;
  access_token: string;
  refresh_token: string | null;
  cmid: string | null;
  player_name: string | null;
  apelido: string | null;
  status: string;
  shard: number | null;
  team_snapshot: ActivePoke[] | null;
  team_total: number | null;
  team_at: string | null;
  block_status: number | null;
  block_reason: string | null;
  blocked_em: string | null;
}

const COLUNAS = `id, access_token, refresh_token, cmid, player_name, apelido, status, shard,
                 team_snapshot, team_total, team_at, block_status, block_reason, blocked_em`;

const daLinha = (l: Linha): Vinculo | null => {
  const access = decifrar(l.access_token);
  // Chave trocada ou registro corrompido: trata como SEM vinculo. Melhor pedir
  // reconexao do que seguir com credencial que nao se sabe ler.
  if (!access) return null;
  return {
    id: l.id,
    tokens: { access, refresh: decifrar(l.refresh_token) ?? undefined },
    cmid: l.cmid,
    nomeJogador: l.player_name,
    apelido: l.apelido,
    status: l.status === "expired" ? "expired" : l.status === "blocked" ? "blocked" : "active",
    shard: l.shard,
    time: l.team_snapshot
      ? { lista: l.team_snapshot, total: l.team_total ?? l.team_snapshot.length, em: l.team_at ?? "" }
      : null,
    bloqueioStatus: l.block_status,
    bloqueioMotivo: l.block_reason,
    bloqueadoEm: l.blocked_em,
  };
};

/**
 * Quantas contas de jogo cabem numa assinatura.
 *
 * Numero, e nao "ilimitado", por uma razao de maquina: cada conta e um WebSocket
 * aberto o tempo todo, mais o poll do analyzer e as chamadas REST das
 * automacoes. Sem teto, uma assinatura sozinha pode custar o processo inteiro —
 * e o processo e um so (`numReplicas: 1`).
 *
 * Se o Eduardo quiser outro numero, e AQUI, numa linha.
 */
export const CONTAS_POR_ASSINATURA = 5;

/** As contas do usuario, sem token. Ordenadas pela ordem em que ele ligou. */
export async function listarContas(userId: string): Promise<ContaResumo[]> {
  const linhas = await query<{
    id: string;
    player_name: string | null;
    apelido: string | null;
    status: string;
    criado_em: string;
  }>(
    `SELECT id, player_name, apelido, status, criado_em
       FROM game_links WHERE user_id = $1 ORDER BY criado_em, id`,
    [userId],
  ).catch(() => []);
  return linhas.map((l) => ({
    id: l.id,
    nomeJogador: l.player_name,
    apelido: l.apelido,
    status: l.status === "expired" ? "expired" : l.status === "blocked" ? "blocked" : "active",
    criadoEm: l.criado_em,
  }));
}

/** O vinculo por id, COM token. Nao confere dono — use `contaDoUsuario`. */
export async function lerVinculo(contaId: string): Promise<Vinculo | null> {
  const l = await queryOne<Linha>(`SELECT ${COLUNAS} FROM game_links WHERE id = $1`, [contaId]);
  return l ? daLinha(l) : null;
}

/**
 * O vinculo por id, SO se for do usuario.
 *
 * E este o portao que substitui a antiga chave primaria. Antes, "a conta do
 * usuario logado" era a unica que existia e nao havia como pedir a de outro;
 * agora o id viaja na URL, e uma rota que le por id sem conferir o dono entrega
 * a credencial de jogo de qualquer pessoa a quem souber um uuid.
 */
export async function contaDoUsuario(userId: string, contaId: string): Promise<Vinculo | null> {
  const l = await queryOne<Linha>(
    `SELECT ${COLUNAS} FROM game_links WHERE id = $1 AND user_id = $2`,
    [contaId, userId],
  );
  return l ? daLinha(l) : null;
}

/** A primeira conta do usuario — o padrao de quem tem uma so, e o destino de
 *  quem chega sem dizer qual. */
export async function primeiraConta(userId: string): Promise<string | null> {
  const l = await queryOne<{ id: string }>(
    `SELECT id FROM game_links WHERE user_id = $1 ORDER BY criado_em, id LIMIT 1`,
    [userId],
  ).catch(() => null);
  return l?.id ?? null;
}

export async function contarContas(userId: string): Promise<number> {
  const l = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM game_links WHERE user_id = $1`,
    [userId],
  ).catch(() => null);
  return Number(l?.n ?? 0);
}

/**
 * Liga uma conta do jogo, ou atualiza a que ja existe.
 *
 * O `cmid` decide qual dos dois: colar o token da MESMA conta de novo e
 * reconectar, nao adicionar uma segunda. Sem isso, um token renovado viraria
 * linha nova e o usuario teria dois vinculos pro mesmo personagem — dois sockets
 * brigando pela mesma sessao de jogo, cada um derrubando o outro pra sempre.
 *
 * Devolve o id da conta e se ela e nova, porque quem chama precisa saber: conta
 * nova entra desligada, conta reconectada volta pro estado que ja tinha.
 */
export async function salvarVinculo(
  userId: string,
  tokens: Tokens,
  meta: { cmid?: string | null; nomeJogador?: string | null } = {},
): Promise<{ id: string; nova: boolean }> {
  const existente = meta.cmid
    ? await queryOne<{ id: string }>(
        `SELECT id FROM game_links WHERE user_id = $1 AND cmid = $2`,
        [userId, meta.cmid],
      ).catch(() => null)
    : null;

  if (existente) {
    await query(
      `UPDATE game_links
          SET access_token = $2, refresh_token = $3,
              player_name  = COALESCE($4, player_name),
              status = 'active', block_status = NULL, block_reason = NULL, blocked_em = NULL
        WHERE id = $1`,
      [
        existente.id,
        cifrar(tokens.access),
        tokens.refresh ? cifrar(tokens.refresh) : null,
        meta.nomeJogador ?? null,
      ],
    );
    return { id: existente.id, nova: false };
  }

  const l = await queryOne<{ id: string }>(
    `INSERT INTO game_links (user_id, access_token, refresh_token, cmid, player_name, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
    [
      userId,
      cifrar(tokens.access),
      tokens.refresh ? cifrar(tokens.refresh) : null,
      meta.cmid ?? null,
      meta.nomeJogador ?? null,
    ],
  );
  return { id: l!.id, nova: true };
}

/** Depois de um refresh automatico: so os tokens mudam, o vinculo segue ativo. */
export async function atualizarTokens(contaId: string, tokens: Tokens): Promise<void> {
  await query(
    `UPDATE game_links SET access_token = $2, refresh_token = $3, status = 'active' WHERE id = $1`,
    [contaId, cifrar(tokens.access), tokens.refresh ? cifrar(tokens.refresh) : null],
  );
}

/** O refresh falhou: pede reconexao, sem apagar (o rotulo do jogador fica). */
export function marcarVencido(contaId: string): Promise<unknown> {
  return query(`UPDATE game_links SET status = 'expired' WHERE id = $1`, [contaId]);
}

/**
 * O jogo recusou a conta. Guarda a evidencia E desliga o robo DESSA conta:
 * manter `enabled` ligado faria o proximo boot religar a sessao e recomecar a
 * bater na porta de uma conta banida. As outras contas do mesmo usuario seguem
 * rodando — a recusa e de uma so.
 */
export async function marcarBloqueado(contaId: string, recusa: Recusa): Promise<void> {
  await query(
    `UPDATE game_links
        SET status = 'blocked', block_status = $2, block_reason = $3, blocked_em = now()
      WHERE id = $1`,
    [contaId, recusa.status, recusa.mensagem || null],
  );
  await query(
    `UPDATE robot_sessions SET enabled = false, last_status = 'blocked', last_error = $2
      WHERE link_id = $1`,
    [contaId, recusa.mensagem || "conta recusada pelo jogo"],
  ).catch(() => { /* o desligamento e melhor-esforco: o bloqueio ja foi gravado */ });
}

/** Cacheia o shard descoberto — evita varrer os 64 de novo. */
export function salvarShard(contaId: string, shard: number): Promise<unknown> {
  return query(`UPDATE game_links SET shard = $2 WHERE id = $1`, [contaId, shard]);
}

/** Guarda o time lido. A tela mostra este snapshot em vez de abrir uma conexao
 *  nova a cada visita — abrir WS chuta a aba do jogo, e ninguem espera isso de
 *  uma tela que so lista o time. */
export function salvarTime(contaId: string, time: ActivePoke[], total: number): Promise<unknown> {
  return query(
    `UPDATE game_links SET team_snapshot = $2, team_total = $3, team_at = now() WHERE id = $1`,
    [contaId, JSON.stringify(time), total],
  );
}

/** O apelido e do dono: e o que distingue duas contas do mesmo jogo na lista. */
export function renomearConta(contaId: string, apelido: string | null): Promise<unknown> {
  return query(`UPDATE game_links SET apelido = $2 WHERE id = $1`, [
    contaId,
    apelido?.trim() ? apelido.trim().slice(0, 40) : null,
  ]);
}

export function apagarVinculo(contaId: string): Promise<unknown> {
  return query(`DELETE FROM game_links WHERE id = $1`, [contaId]);
}
