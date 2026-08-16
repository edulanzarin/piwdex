import { queryOne, query } from "@/lib/db";
import { encryptStr, decryptStr, type Tokens } from "@/lib/game-auth";

// Vinculo da conta do jogo por usuario do piwdex (tabela game_links). Substitui o
// cookie de sessao: os tokens do jogo ficam no banco, cifrados, presos ao usuario
// logado. status 'expired' = o refresh falhou, precisa reconectar.

export interface GameLink {
  tokens: Tokens;
  cmid: string | null;
  playerName: string | null;
  status: "active" | "expired";
}

interface GameLinkRow {
  access_token: string;
  refresh_token: string | null;
  cmid: string | null;
  player_name: string | null;
  status: string;
}

export async function getGameLink(userId: string): Promise<GameLink | null> {
  const row = await queryOne<GameLinkRow>(
    `SELECT access_token, refresh_token, cmid, player_name, status
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
    status: row.status === "expired" ? "expired" : "active",
  };
}

// Cria/atualiza o vinculo (ao conectar). Zera o status pra 'active'.
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
       status        = 'active'`,
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
