import { query, queryOne } from "@/lib/robo/db";
import { cifrar, decifrar, type Recusa, type Tokens } from "@/lib/robo/jogo/auth";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";

/**
 * O vinculo entre a conta do piwdex e a conta do jogo (tabela `game_links`).
 *
 * Um por usuario. Os tokens vivem cifrados no banco — nunca em cookie, nunca em
 * memoria compartilhada.
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
  tokens: Tokens;
  cmid: string | null;
  nomeJogador: string | null;
  status: StatusVinculo;
  shard: number | null;
  time: SnapshotTime | null;
  /** so quando `status = 'blocked'`: o que o jogo respondeu, e quando */
  bloqueioStatus: number | null;
  bloqueioMotivo: string | null;
  bloqueadoEm: string | null;
}

interface Linha {
  access_token: string;
  refresh_token: string | null;
  cmid: string | null;
  player_name: string | null;
  status: string;
  shard: number | null;
  team_snapshot: ActivePoke[] | null;
  team_total: number | null;
  team_at: string | null;
  block_status: number | null;
  block_reason: string | null;
  blocked_em: string | null;
}

export async function lerVinculo(userId: string): Promise<Vinculo | null> {
  const l = await queryOne<Linha>(
    `SELECT access_token, refresh_token, cmid, player_name, status, shard,
            team_snapshot, team_total, team_at,
            block_status, block_reason, blocked_em
       FROM game_links WHERE user_id = $1`,
    [userId],
  );
  if (!l) return null;

  const access = decifrar(l.access_token);
  // Chave trocada ou registro corrompido: trata como SEM vinculo. Melhor pedir
  // reconexao do que seguir com credencial que nao se sabe ler.
  if (!access) return null;

  return {
    tokens: { access, refresh: decifrar(l.refresh_token) ?? undefined },
    cmid: l.cmid,
    nomeJogador: l.player_name,
    status: l.status === "expired" ? "expired" : l.status === "blocked" ? "blocked" : "active",
    shard: l.shard,
    time: l.team_snapshot
      ? { lista: l.team_snapshot, total: l.team_total ?? l.team_snapshot.length, em: l.team_at ?? "" }
      : null,
    bloqueioStatus: l.block_status,
    bloqueioMotivo: l.block_reason,
    bloqueadoEm: l.blocked_em,
  };
}

/**
 * Cria ou atualiza o vinculo. Zera o status pra `active` e LIMPA o bloqueio: se o
 * jogo aceitou o token agora, a recusa anterior nao vale mais.
 */
export async function salvarVinculo(
  userId: string,
  tokens: Tokens,
  meta: { cmid?: string | null; nomeJogador?: string | null } = {},
): Promise<void> {
  await query(
    `INSERT INTO game_links (user_id, access_token, refresh_token, cmid, player_name, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     ON CONFLICT (user_id) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       cmid          = COALESCE(EXCLUDED.cmid, game_links.cmid),
       player_name   = COALESCE(EXCLUDED.player_name, game_links.player_name),
       status        = 'active',
       block_status  = NULL,
       block_reason  = NULL,
       blocked_em    = NULL`,
    [
      userId,
      cifrar(tokens.access),
      tokens.refresh ? cifrar(tokens.refresh) : null,
      meta.cmid ?? null,
      meta.nomeJogador ?? null,
    ],
  );
}

/** Depois de um refresh automatico: so os tokens mudam, o vinculo segue ativo. */
export async function atualizarTokens(userId: string, tokens: Tokens): Promise<void> {
  await query(
    `UPDATE game_links SET access_token = $2, refresh_token = $3, status = 'active' WHERE user_id = $1`,
    [userId, cifrar(tokens.access), tokens.refresh ? cifrar(tokens.refresh) : null],
  );
}

/** O refresh falhou: pede reconexao, sem apagar (o rotulo do jogador fica). */
export function marcarVencido(userId: string): Promise<unknown> {
  return query(`UPDATE game_links SET status = 'expired' WHERE user_id = $1`, [userId]);
}

/**
 * O jogo recusou a conta. Guarda a evidencia E desliga o robo desse usuario:
 * manter `enabled` ligado faria o proximo boot religar a sessao e recomecar a
 * bater na porta de uma conta banida.
 */
export async function marcarBloqueado(userId: string, recusa: Recusa): Promise<void> {
  await query(
    `UPDATE game_links
        SET status = 'blocked', block_status = $2, block_reason = $3, blocked_em = now()
      WHERE user_id = $1`,
    [userId, recusa.status, recusa.mensagem || null],
  );
  await query(
    `UPDATE robot_sessions SET enabled = false, last_status = 'blocked', last_error = $2
      WHERE user_id = $1`,
    [userId, recusa.mensagem || "conta recusada pelo jogo"],
  ).catch(() => { /* o desligamento e melhor-esforco: o bloqueio ja foi gravado */ });
}

/** Cacheia o shard descoberto — evita varrer os 64 de novo. */
export function salvarShard(userId: string, shard: number): Promise<unknown> {
  return query(`UPDATE game_links SET shard = $2 WHERE user_id = $1`, [userId, shard]);
}

/** Guarda o time lido. A tela mostra este snapshot em vez de abrir uma conexao
 *  nova a cada visita — abrir WS chuta a aba do jogo, e ninguem espera isso de
 *  uma tela que so lista o time. */
export function salvarTime(userId: string, time: ActivePoke[], total: number): Promise<unknown> {
  return query(
    `UPDATE game_links SET team_snapshot = $2, team_total = $3, team_at = now() WHERE user_id = $1`,
    [userId, JSON.stringify(time), total],
  );
}

export function apagarVinculo(userId: string): Promise<unknown> {
  return query(`DELETE FROM game_links WHERE user_id = $1`, [userId]);
}
