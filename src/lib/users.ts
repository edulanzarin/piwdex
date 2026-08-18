import { query, queryOne } from "@/lib/db";

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

// Atualiza o nome de exibicao (null = limpa). A sessao revalida do banco a cada request
// (ver auth.ts), entao reflete no proximo carregamento.
export function updateUserName(id: string, nome: string | null) {
  return query("UPDATE users SET nome = $2, atualizado_em = now() WHERE id = $1", [id, nome]);
}

// Troca o hash da senha (o caller ja validou a senha atual e gerou o novo hash).
export function updateUserPassword(id: string, senhaHash: string) {
  return query("UPDATE users SET senha_hash = $2, atualizado_em = now() WHERE id = $1", [id, senhaHash]);
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
