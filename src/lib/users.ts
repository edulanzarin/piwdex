import { queryOne } from "@/lib/db";

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
