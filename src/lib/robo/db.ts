import { Pool, type QueryResultRow } from "pg";

/**
 * O banco da area logada. SQL direto, sem ORM.
 *
 * Pool unico guardado no `globalThis` porque o HMR do `next dev` reavalia o
 * modulo a cada save: sem isso, meia hora de desenvolvimento abre dezenas de
 * pools e o Postgres recusa conexao por limite.
 *
 * Server-only. Nenhuma tela importa daqui — quem fala com o banco e route
 * handler, server action ou o motor do robo.
 */
const globalParaPool = globalThis as unknown as { _piwdexPool?: Pool };

export const pool =
  globalParaPool._piwdexPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalParaPool._piwdexPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
