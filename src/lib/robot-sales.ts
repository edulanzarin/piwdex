import { query, queryOne } from "@/lib/db";

// Totalizador cumulativo (pra sempre) das vendas do robo — itens e pokemon. Incrementa a
// cada venda CONFIRMADA (chamado da sessao, fire-and-forget) e nunca reseta. Ver
// db/migrations/010_robot_sales.sql.

export interface SalesTotals { itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number }

export async function addRobotSales(
  userId: string,
  d: { itemsCount?: number; itemsGold?: number; pokesCount?: number; pokesGold?: number },
): Promise<void> {
  const ic = Math.round(d.itemsCount ?? 0), ig = Math.round(d.itemsGold ?? 0);
  const pc = Math.round(d.pokesCount ?? 0), pg = Math.round(d.pokesGold ?? 0);
  if (!ic && !ig && !pc && !pg) return;
  try {
    await query(
      `INSERT INTO robot_sales (user_id, items_count, items_gold, pokes_count, pokes_gold)
         VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         items_count = robot_sales.items_count + EXCLUDED.items_count,
         items_gold  = robot_sales.items_gold  + EXCLUDED.items_gold,
         pokes_count = robot_sales.pokes_count + EXCLUDED.pokes_count,
         pokes_gold  = robot_sales.pokes_gold  + EXCLUDED.pokes_gold,
         updated_em  = now()`,
      [userId, ic, ig, pc, pg],
    );
  } catch {
    // nao derruba a venda por causa do totalizador
  }
}

export async function getRobotSales(userId: string): Promise<SalesTotals> {
  const row = await queryOne<{ items_count: string; items_gold: string; pokes_count: string; pokes_gold: string }>(
    `SELECT items_count, items_gold, pokes_count, pokes_gold FROM robot_sales WHERE user_id = $1`,
    [userId],
  );
  return {
    itemsCount: row ? Number(row.items_count) : 0,
    itemsGold: row ? Number(row.items_gold) : 0,
    pokesCount: row ? Number(row.pokes_count) : 0,
    pokesGold: row ? Number(row.pokes_gold) : 0,
  };
}
