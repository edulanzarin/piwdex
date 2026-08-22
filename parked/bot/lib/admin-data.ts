import { query } from "@/lib/db";
import { decryptStr, gameFetch, type Tokens } from "@/lib/game-auth";
import { updateGameTokens, markGameLinkExpired } from "@/lib/game-link";
import { normalizeProfile } from "@/lib/game-account";

// Camada de dados do portal admin (server-only). Junta a lista de usuarios do piwdex com
// o vinculo de jogo e as moedas AO VIVO (gold/diamantes), buscadas por REST na API do jogo
// com o token de cada um. So o /api/game/profile (REST, Bearer) — NAO abre o WebSocket, entao
// nao rouba a sessao de jogo de ninguem (o bot segue conectado). Chamar so de contexto admin.

export interface AdminUser {
  id: string;
  email: string;
  nome: string | null;
  vip: boolean;
  vipAte: string | null;
  criadoEm: string;
  // vinculo com a conta do jogo
  linked: boolean;
  linkStatus: "active" | "expired" | null;
  playerName: string | null;
  // moedas/estado AO VIVO (null = nao deu pra buscar: sem vinculo, expirado ou jogo fora)
  gold: number | null;
  diamonds: number | null;
  level: number | null;
  catches: number | null;
  rank: number | null;
  // token decifrado pra "entrar como" (so quando ha vinculo). Undefined = sem token.
  // So chega ao navegador do admin (pagina gated); e o mesmo poder que o admin ja tem.
  impersonate?: { accessToken: string; refreshToken?: string };
}

interface Row {
  id: string;
  email: string;
  nome: string | null;
  vip: boolean;
  vip_ate: string | null;
  criado_em: string;
  link_status: string | null;
  player_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
}

// Busca gold/diamantes/level ao vivo de um usuario vinculado. Renova+persiste o token em
// 401 (mesma politica do resto do app). Retorna null se cair/expirar — nunca estoura.
async function liveProfile(
  userId: string,
  tokens: Tokens,
): Promise<Pick<AdminUser, "gold" | "diamonds" | "level" | "catches" | "rank">> {
  const empty = { gold: null, diamonds: null, level: null, catches: null, rank: null };
  try {
    const r = await gameFetch("/api/game/profile", tokens);
    if (r.changed) await updateGameTokens(userId, r.tokens);
    if (r.res.status === 401) {
      await markGameLinkExpired(userId);
      return empty;
    }
    if (!r.res.ok) return empty;
    const prof = normalizeProfile(await r.res.json().catch(() => null));
    if (!prof) return empty;
    return { gold: prof.gold, diamonds: prof.diamonds, level: prof.level, catches: prof.catches, rank: prof.rank };
  } catch {
    return empty; // jogo indisponivel: mostra o resto da linha mesmo assim
  }
}

/** Todos os usuarios do piwdex + vinculo + moedas ao vivo (linkados em paralelo). */
export async function getAdminOverview(): Promise<AdminUser[]> {
  const rows = await query<Row>(
    `SELECT u.id, u.email, u.nome, u.vip, u.vip_ate, u.criado_em,
            g.status AS link_status, g.player_name, g.access_token, g.refresh_token
       FROM users u
       LEFT JOIN game_links g ON g.user_id = u.id
      ORDER BY u.criado_em DESC`,
  );

  const base: AdminUser[] = rows.map((r) => {
    const access = r.access_token ? decryptStr(r.access_token) : null;
    const refresh = r.refresh_token ? decryptStr(r.refresh_token) : null;
    const linked = !!r.link_status;
    return {
      id: r.id,
      email: r.email,
      nome: r.nome,
      vip: r.vip,
      vipAte: r.vip_ate,
      criadoEm: r.criado_em,
      linked,
      linkStatus: linked ? (r.link_status === "expired" ? "expired" : "active") : null,
      playerName: r.player_name,
      gold: null,
      diamonds: null,
      level: null,
      catches: null,
      rank: null,
      impersonate: access ? { accessToken: access, refreshToken: refresh ?? undefined } : undefined,
    };
  });

  // Moedas ao vivo so pros vinculados ativos (token valido). Em paralelo, best-effort.
  await Promise.all(
    base.map(async (u) => {
      if (u.linkStatus !== "active" || !u.impersonate) return;
      const live = await liveProfile(u.id, {
        access: u.impersonate.accessToken,
        refresh: u.impersonate.refreshToken,
      });
      Object.assign(u, live);
    }),
  );

  return base;
}
