import { query, queryOne } from "@/lib/db";

// Eventos dos robos server-side (Hunt + venda automatica), gravados enquanto rodam —
// inclusive com o jogador offline. Server-only (chamado das sessoes WS e das rotas VIP).

export type RobotEventKind =
  | "shiny" | "hunt-summary" | "poke-sold" | "item-sold" | "item-bought"
  | "brain"      // decisao do cerebro (trocou de hunt sozinho, escolheu hunt no modo auto)
  | "reconnect"  // conexao caiu e o robo religou sozinho
  | "goal"       // meta de leveling atingida
  | "heal"       // passou na enfermeira Joy (time desmaiado nao caca)
  | "blocked"    // o JOGO recusou a conta (ban/suspensao): o robo para e nao tenta mais
  | "error";     // falha OPERACIONAL (venda/compra que nao rodou) — throttled na origem

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

const KEEP = 800; // teto de eventos por usuario (poda os mais antigos)
/** Janela do feed. 48h era pouco pra responder "o que aconteceu ontem de madrugada?" —
 *  e o feed e a unica memoria do que o robo fez enquanto ninguem olhava. */
const WINDOW = "14 days";

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
    await query(`DELETE FROM robot_events WHERE user_id = $1 AND criado_em < now() - interval '${WINDOW}'`, [userId]);
  } catch {
    // nao derruba a hunt/venda por causa de um evento nao gravado
  }
}

export async function listRobotEvents(userId: string, limit = 40): Promise<RobotEvent[]> {
  const rows = await query<Row>(
    `SELECT id, kind, title, body, data, read_at, criado_em
       FROM robot_events
      WHERE user_id = $1 AND criado_em > now() - interval '${WINDOW}'
      ORDER BY criado_em DESC LIMIT $2`,
    [userId, Math.min(Math.max(1, Math.round(limit)), KEEP)],
  );
  return rows.map((r) => ({
    id: r.id, kind: r.kind as RobotEventKind, title: r.title, body: r.body,
    data: r.data, readAt: r.read_at, createdAt: r.criado_em,
  }));
}

export async function unreadRobotEvents(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM robot_events
       WHERE user_id = $1 AND read_at IS NULL AND criado_em > now() - interval '${WINDOW}'`,
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


// --- taxa de captura POR ALVO, medida do proprio historico -----------------------------
//
// O resumo de cada hunt ("Hunt yanma: 586 kills, 14 capturas") ja carrega os dois numeros
// que faltavam. Somados por spot, eles respondem o que uma taxa unica nao responde: voce
// captura MUITO mais em uns alvos que em outros — 14 em 586 no Yanma, 0 em 49 no Tyrogue.
// Sem isso, o ranking projetava a renda de captura do Yanma em cima do Tyrogue e o
// recomendava a 438k/h enquanto o jogo pagava MENOS 25k/h.

export interface SlugRate { kills: number; captures: number }

export async function captureRatesBySlug(userId: string): Promise<Map<string, SlugRate>> {
  const out = new Map<string, SlugRate>();
  try {
    const rows = await query<{ slug: string; kills: string; captures: string }>(
      `SELECT data->>'slug' AS slug,
              sum((data->>'kills')::numeric)::text    AS kills,
              sum((data->>'captures')::numeric)::text AS captures
         FROM robot_events
        WHERE user_id = $1 AND kind = 'hunt-summary'
          AND data ? 'slug' AND data ? 'kills' AND data ? 'captures'
          AND criado_em > now() - interval '${WINDOW}'
        GROUP BY 1`,
      [userId],
    );
    for (const r of rows) {
      if (!r.slug) continue;
      const kills = Number(r.kills), captures = Number(r.captures);
      if (!Number.isFinite(kills) || kills <= 0) continue;
      out.set(r.slug, { kills, captures: Number.isFinite(captures) ? captures : 0 });
    }
  } catch {
    // sem historico o ranking cai na taxa geral — nao e motivo pra falhar a rota
  }
  return out;
}
