import { query, queryOne } from "@/lib/db";

// Eventos dos robos server-side (Hunt + venda automatica), gravados enquanto rodam —
// inclusive com o jogador offline. Server-only (chamado das sessoes WS e das rotas VIP).

export type RobotEventKind = "shiny" | "hunt-summary" | "poke-sold" | "item-sold" | "item-bought";

export interface RobotEvent {
  id: string;
  kind: RobotEventKind;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface Row {
  id: string; kind: string; title: string; body: string | null;
  data: Record<string, unknown> | null; read_at: string | null; criado_em: string;
}

const KEEP = 200; // teto de eventos por usuario (poda os mais antigos)

// Grava um evento e poda o excedente. Fire-and-forget nas sessoes (nao bloqueia o WS).
export async function logRobotEvent(
  userId: string,
  ev: { kind: RobotEventKind; title: string; body?: string | null; data?: Record<string, unknown> | null },
): Promise<void> {
  try {
    await query(
      `INSERT INTO robot_events (user_id, kind, title, body, data) VALUES ($1, $2, $3, $4, $5)`,
      [userId, ev.kind, ev.title, ev.body ?? null, ev.data ? JSON.stringify(ev.data) : null],
    );
    await query(
      `DELETE FROM robot_events WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM robot_events WHERE user_id = $1 ORDER BY criado_em DESC LIMIT $2)`,
      [userId, KEEP],
    );
    // expira sozinho: nada mais velho que 48h fica no feed
    await query(`DELETE FROM robot_events WHERE user_id = $1 AND criado_em < now() - interval '48 hours'`, [userId]);
  } catch {
    // nao derruba a hunt/venda por causa de um evento nao gravado
  }
}

export async function listRobotEvents(userId: string, limit = 10): Promise<RobotEvent[]> {
  const rows = await query<Row>(
    `SELECT id, kind, title, body, data, read_at, criado_em
       FROM robot_events
      WHERE user_id = $1 AND criado_em > now() - interval '48 hours'
      ORDER BY criado_em DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id, kind: r.kind as RobotEventKind, title: r.title, body: r.body,
    data: r.data, readAt: r.read_at, createdAt: r.criado_em,
  }));
}

export async function unreadRobotEvents(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM robot_events
       WHERE user_id = $1 AND read_at IS NULL AND criado_em > now() - interval '48 hours'`,
    [userId],
  );
  return row ? Number(row.n) : 0;
}

export async function markRobotEventsRead(userId: string): Promise<void> {
  await query(`UPDATE robot_events SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
}

// limpa TODO o feed do usuario (botao "Limpar" na aba Alertas)
export async function clearRobotEvents(userId: string): Promise<void> {
  await query(`DELETE FROM robot_events WHERE user_id = $1`, [userId]);
}
