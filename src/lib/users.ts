import { queryOne, pool } from "@/lib/db";

// Acesso aos usuarios do piwdex em SQL puro (sem ORM). Email sempre normalizado
// (minusculo, sem espaco) — a coluna e UNIQUE nesse formato.

export interface UserRow {
  id: string;
  email: string;
  nome: string | null;
  senha_hash: string | null;
  avatar_url: string | null;
  vip: boolean;
  vip_ate: string | null;
}

export const normEmail = (e: string) => e.trim().toLowerCase();

export function getUserById(id: string) {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
}

export function findUserByEmail(email: string) {
  return queryOne<UserRow>("SELECT * FROM users WHERE email = $1", [normEmail(email)]);
}

// Cadastro por email/senha. Estoura se o email ja existe (UNIQUE) — o caller trata.
export async function createUserWithPassword(input: {
  email: string;
  nome: string | null;
  senhaHash: string;
}) {
  const row = await queryOne<UserRow>(
    `INSERT INTO users (email, nome, senha_hash) VALUES ($1, $2, $3) RETURNING *`,
    [normEmail(input.email), input.nome, input.senhaHash],
  );
  return row!;
}

// Login Google: acha o usuario pelo vinculo OAuth; se nao existir, cria (ou
// linka a um usuario que ja tenha o mesmo email) numa transacao.
export async function findOrCreateGoogleUser(input: {
  sub: string;
  email: string;
  nome: string | null;
  avatar: string | null;
}): Promise<UserRow> {
  const email = normEmail(input.email);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const linked = await client.query<UserRow>(
      `SELECT u.* FROM users u
         JOIN oauth_accounts o ON o.user_id = u.id
        WHERE o.provider = 'google' AND o.provider_account_id = $1`,
      [input.sub],
    );
    if (linked.rows[0]) {
      await client.query("COMMIT");
      return linked.rows[0];
    }

    // Sem vinculo ainda: reaproveita usuario com mesmo email ou cria um novo.
    const existing = await client.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
    let user = existing.rows[0];
    if (!user) {
      const created = await client.query<UserRow>(
        `INSERT INTO users (email, nome, avatar_url) VALUES ($1, $2, $3) RETURNING *`,
        [email, input.nome, input.avatar],
      );
      user = created.rows[0];
    }

    await client.query(
      `INSERT INTO oauth_accounts (provider, provider_account_id, user_id)
       VALUES ('google', $1, $2)
       ON CONFLICT (provider, provider_account_id) DO NOTHING`,
      [input.sub, user.id],
    );
    await client.query("COMMIT");
    return user;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
