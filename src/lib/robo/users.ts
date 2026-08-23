import { query, queryOne } from "@/lib/robo/db";

/**
 * As contas do piwdex, em SQL puro.
 *
 * O email e SEMPRE normalizado (minusculo, sem espaco) antes de tocar o banco: a
 * coluna e UNIQUE nesse formato, e sem a normalizacao `Ana@x.com` e `ana@x.com`
 * viram duas contas — e a segunda nunca consegue entrar, porque o login procura
 * pelo normalizado.
 */

export interface UserRow {
  id: string;
  email: string;
  nome: string | null;
  senha_hash: string;
  vip: boolean;
  vip_ate: string | null;
  is_admin: boolean;
}

export const normEmail = (e: string) => e.trim().toLowerCase();

/** A assinatura esta valendo AGORA? A flag sozinha nao responde: ela fica ligada
 *  depois do primeiro pagamento e a data e quem diz se ainda vale. */
export const vipAtivo = (vip: boolean, ate: string | null) =>
  vip && (!ate || new Date(ate).getTime() > Date.now());

export function getUserById(id: string) {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
}

export function findUserByEmail(email: string) {
  return queryOne<UserRow>("SELECT * FROM users WHERE email = $1", [normEmail(email)]);
}

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

export function updateUserName(id: string, nome: string | null) {
  return query("UPDATE users SET nome = $2 WHERE id = $1", [id, nome]);
}
