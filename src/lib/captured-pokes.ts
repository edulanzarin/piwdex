import { query, queryOne } from "@/lib/db";
import type { PokeType, Rarity } from "@/lib/types";

// Acervo de capturados/mantidos (ver db/migrations/011_captured_pokes.sql). Grava em massa
// (fire-and-forget da sessao), lista com filtros+paginacao (igual ao mercado) e limpa tudo.

export interface CapturedPoke {
  pokeId: string; speciesId: number; name: string; level: number; shiny: boolean;
  ivTotal: number; quality: number; rarity: Rarity; type1: PokeType; type2: PokeType | null;
}
export interface CapturedRow extends CapturedPoke { seenEm: string }

export interface CapturedFilters {
  type?: PokeType | ""; rarity?: Rarity | ""; speciesId?: number | null;
  ivMin?: number | null; qMin?: number | null; shiny?: boolean | null;
  sort?: "recent" | "iv" | "quality"; page?: number; pageSize?: number;
}

// grava os novos (mantidos). ON CONFLICT DO NOTHING: preserva a 1a hora vista (seen_em).
export async function recordCaptured(userId: string, pokes: CapturedPoke[]): Promise<void> {
  if (!pokes.length) return;
  const args: unknown[] = [];
  const tuples = pokes.map((p, i) => {
    const b = i * 11;
    args.push(userId, p.pokeId, p.speciesId, p.name, p.level, p.shiny, p.ivTotal, p.quality, p.rarity, p.type1, p.type2);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11})`;
  });
  try {
    await query(
      `INSERT INTO captured_pokes
         (user_id, poke_id, species_id, name, level, shiny, iv_total, quality, rarity, type1, type2)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (user_id, poke_id) DO NOTHING`,
      args,
    );
  } catch {
    // catalogo nao pode derrubar a sessao
  }
}

interface DbRow {
  poke_id: string; species_id: number; name: string; level: number; shiny: boolean;
  iv_total: number; quality: number; rarity: string; type1: string; type2: string | null; seen_em: string;
}

export async function listCaptured(
  userId: string,
  f: CapturedFilters,
): Promise<{ rows: CapturedRow[]; total: number; page: number; pageCount: number }> {
  const where: string[] = ["user_id = $1"];
  const args: unknown[] = [userId];
  const p = (v: unknown) => { args.push(v); return `$${args.length}`; };

  if (f.type) where.push(`(type1 = ${p(f.type)} OR type2 = ${p(f.type)})`);
  if (f.rarity) where.push(`rarity = ${p(f.rarity)}`);
  if (f.speciesId) where.push(`species_id = ${p(f.speciesId)}`);
  if (typeof f.ivMin === "number") where.push(`iv_total >= ${p(f.ivMin)}`);
  if (typeof f.qMin === "number") where.push(`quality >= ${p(f.qMin)}`);
  if (typeof f.shiny === "boolean") where.push(`shiny = ${p(f.shiny)}`);

  const w = where.join(" AND ");
  const order = f.sort === "iv" ? "iv_total DESC" : f.sort === "quality" ? "quality DESC" : "seen_em DESC";
  const pageSize = Math.min(60, Math.max(1, f.pageSize ?? 24));
  const page = Math.max(0, f.page ?? 0);

  const totalRow = await queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM captured_pokes WHERE ${w}`, args);
  const total = totalRow ? Number(totalRow.n) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows = await query<DbRow>(
    `SELECT poke_id, species_id, name, level, shiny, iv_total, quality, rarity, type1, type2, seen_em
       FROM captured_pokes WHERE ${w} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${page * pageSize}`,
    args,
  );
  return {
    total, page, pageCount,
    rows: rows.map((r) => ({
      pokeId: r.poke_id, speciesId: r.species_id, name: r.name, level: r.level, shiny: r.shiny,
      ivTotal: r.iv_total, quality: r.quality, rarity: r.rarity as Rarity,
      type1: r.type1 as PokeType, type2: (r.type2 as PokeType | null) ?? null, seenEm: r.seen_em,
    })),
  };
}

export async function clearCaptured(userId: string): Promise<void> {
  await query(`DELETE FROM captured_pokes WHERE user_id = $1`, [userId]);
}
