import { Pool, type QueryResultRow } from "pg";

// Pool unico (sobrevive ao HMR do dev). SQL direto, sem ORM.
const globalForPool = globalThis as unknown as { _piwdexPool?: Pool };

export const pool =
  globalForPool._piwdexPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPool._piwdexPool = pool;

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
