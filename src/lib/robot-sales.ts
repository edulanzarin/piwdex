import { query, queryOne } from "@/lib/db";

// Totalizador cumulativo (pra sempre) do robo — vendas (itens/pokemon) e o que a Hunt
// acumulou (kills, capturas, XP, itens coletados, loot vs supply). Incrementa a cada venda
// confirmada e no fim de cada hunt (fire-and-forget da sessao) e nunca reseta. Ver
// db/migrations/010_robot_sales.sql + 012_robot_totals.sql.

export interface SalesTotals {
  itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number;
  hunts: number; kills: number; captures: number; xpGained: number;
  lootItems: number; lootGold: number; supplyGold: number;
}

// colunas do totalizador e o campo do delta que soma em cada uma (uma fonte de verdade
// pros dois lados: o INSERT/UPDATE e a leitura). Tudo em bigint, arredondado.
const COLS = [
  ["items_count", "itemsCount"], ["items_gold", "itemsGold"],
  ["pokes_count", "pokesCount"], ["pokes_gold", "pokesGold"],
  ["hunts", "hunts"], ["kills", "kills"], ["captures", "captures"], ["xp_gained", "xpGained"],
  ["loot_items", "lootItems"], ["loot_gold", "lootGold"], ["supply_gold", "supplyGold"],
] as const;
type Delta = Partial<Record<(typeof COLS)[number][1], number>>;

// Soma um delta em qualquer subconjunto de colunas (venda: items/pokes; fim de hunt:
// hunts/kills/captures/...). Uma linha por usuario, incrementada via UPSERT.
export async function addRobotSales(userId: string, d: Delta): Promise<void> {
  const vals = COLS.map(([, key]) => Math.round(d[key] ?? 0));
  if (vals.every((v) => !v)) return;
  const names = COLS.map(([col]) => col);
  const placeholders = names.map((_, i) => `$${i + 2}`).join(", ");
  const updates = names.map((col) => `${col} = robot_sales.${col} + EXCLUDED.${col}`).join(", ");
  try {
    await query(
      `INSERT INTO robot_sales (user_id, ${names.join(", ")})
         VALUES ($1, ${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updates}, updated_em = now()`,
      [userId, ...vals],
    );
  } catch {
    // nao derruba a venda/hunt por causa do totalizador
  }
}

export async function getRobotSales(userId: string): Promise<SalesTotals> {
  const row = await queryOne<Record<string, string>>(
    `SELECT ${COLS.map(([col]) => col).join(", ")} FROM robot_sales WHERE user_id = $1`,
    [userId],
  );
  const out = {} as SalesTotals;
  for (const [col, key] of COLS) out[key] = row ? Number(row[col]) : 0;
  return out;
}
