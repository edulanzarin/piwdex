import { queryOne, query } from "@/lib/db";
import { encryptStr, decryptStr, type Refusal, type Tokens } from "@/lib/game-auth";
import type { ActivePoke } from "@/lib/game-account";

// Vinculo da conta do jogo por usuario do piwdex (tabela game_links). Substitui o
// cookie de sessao: os tokens do jogo ficam no banco, cifrados, presos ao usuario
// logado.
//
// Tres status, e a diferenca entre os dois ultimos e o que decide se vale tentar de novo:
//   active   — vinculo bom.
//   expired  — o refresh falhou. RECONECTAR resolve (token novo).
//   blocked  — o jogo RECUSOU a conta (403: ban/suspensao). Reconectar nao resolve nada;
//              o robo tem que parar e o dono da conta precisa ver o motivo. Sai desse
//              estado so quando ele vincula de novo e o jogo aceita.

export interface TeamSnapshot {
  list: ActivePoke[];
  total: number;
  at: string; // ISO
}

export type LinkStatus = "active" | "expired" | "blocked";

export interface GameLink {
  tokens: Tokens;
  cmid: string | null;
  playerName: string | null;
  status: LinkStatus;
  shard: number | null;
  team: TeamSnapshot | null;
  /** preenchidos so quando status = 'blocked': o que o jogo respondeu, e quando */
  blockStatus: number | null;
  blockReason: string | null;
  blockedAt: string | null;
}

interface GameLinkRow {
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

export async function getGameLink(userId: string): Promise<GameLink | null> {
  const row = await queryOne<GameLinkRow>(
    `SELECT access_token, refresh_token, cmid, player_name, status, shard,
            team_snapshot, team_total, team_at,
            block_status, block_reason, blocked_em
       FROM game_links WHERE user_id = $1`,
    [userId],
  );
  if (!row) return null;
  const access = decryptStr(row.access_token);
  if (!access) return null; // chave trocada/corrompido: trata como sem vinculo
  const refresh = decryptStr(row.refresh_token) ?? undefined;
  return {
    tokens: { access, refresh },
    cmid: row.cmid,
    playerName: row.player_name,
    status: row.status === "expired" ? "expired" : row.status === "blocked" ? "blocked" : "active",
    shard: row.shard,
    team: row.team_snapshot
      ? { list: row.team_snapshot, total: row.team_total ?? row.team_snapshot.length, at: row.team_at ?? "" }
      : null,
    blockStatus: row.block_status,
    blockReason: row.block_reason,
    blockedAt: row.blocked_em,
  };
}

/**
 * Marca o vinculo como RECUSADO pelo jogo e guarda a evidencia (codigo + mensagem crua).
 * Junto, desliga o robo desse usuario: manter `enabled` ligado faria o proximo boot
 * religar a sessao e recomecar a bater na porta.
 */
export async function markGameLinkBlocked(userId: string, refusal: Refusal): Promise<void> {
  await query(
    `UPDATE game_links
        SET status = 'blocked', block_status = $2, block_reason = $3, blocked_em = now()
      WHERE user_id = $1`,
    [userId, refusal.status, refusal.message || null],
  );
  await query(
    `UPDATE robot_sessions SET enabled = false, last_status = 'blocked', last_error = $2
      WHERE user_id = $1`,
    [userId, refusal.message || "conta recusada pelo jogo"],
  ).catch(() => {});
}

/** Vinculo aceito de novo (reconexao bem-sucedida): limpa o bloqueio. */
export async function clearGameLinkBlock(userId: string): Promise<void> {
  await query(
    `UPDATE game_links
        SET status = 'active', block_status = NULL, block_reason = NULL, blocked_em = NULL
      WHERE user_id = $1`,
    [userId],
  );
}

// Cacheia o shard do WebSocket descoberto (evita varrer todos os shards de novo).
export async function saveGameShard(userId: string, shard: number): Promise<void> {
  await query(`UPDATE game_links SET shard = $2 WHERE user_id = $1`, [userId, shard]);
}

// Guarda o snapshot do time (capturado no connect ou num "atualizar"), com a hora.
export async function saveTeamSnapshot(userId: string, team: ActivePoke[], total: number): Promise<void> {
  await query(
    `UPDATE game_links SET team_snapshot = $2, team_total = $3, team_at = now() WHERE user_id = $1`,
    [userId, JSON.stringify(team), total],
  );
}

// Cria/atualiza o vinculo (ao conectar). Zera o status pra 'active' e LIMPA o bloqueio:
// se o jogo aceitou o token agora, a recusa anterior nao vale mais.
export async function saveGameLink(
  userId: string,
  tokens: Tokens,
  meta: { cmid?: string | null; playerName?: string | null } = {},
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
      encryptStr(tokens.access),
      tokens.refresh ? encryptStr(tokens.refresh) : null,
      meta.cmid ?? null,
      meta.playerName ?? null,
    ],
  );
}

// Atualiza so os tokens (apos refresh automatico), mantendo 'active'.
export async function updateGameTokens(userId: string, tokens: Tokens): Promise<void> {
  await query(
    `UPDATE game_links
        SET access_token = $2, refresh_token = $3, status = 'active'
      WHERE user_id = $1`,
    [userId, encryptStr(tokens.access), tokens.refresh ? encryptStr(tokens.refresh) : null],
  );
}

// O refresh falhou: marca pra pedir reconexao (sem apagar, pra manter o rotulo).
export async function markGameLinkExpired(userId: string): Promise<void> {
  await query(`UPDATE game_links SET status = 'expired' WHERE user_id = $1`, [userId]);
}

export async function deleteGameLink(userId: string): Promise<void> {
  await query(`DELETE FROM game_links WHERE user_id = $1`, [userId]);
}
