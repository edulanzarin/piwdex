import { query, queryOne } from "@/lib/db";
import type { SavedPokeSellCfg } from "@/lib/poke-sell";

// Persistencia do estado DESEJADO do robo (tabela robot_sessions). E o que permite:
//   1. reconexao automatica: o motor sabe que o usuario QUER o bot ligado;
//   2. sobreviver a restart: o boot (instrumentation.ts) le as sessoes enabled e religa;
//   3. o monitor de conexao mostrar o ultimo status mesmo com o processo recem-nascido.
// Escrita e fire-and-forget no motor (nunca derruba a sessao por falha de banco).

export type RobotMode = "manual" | "auto" | "leveling";

export interface LevelingGoal {
  pokeId: string;        // id do pokemon (da conta) sendo upado
  speciesId: number;
  name: string;
  startLevel: number;
  targetLevel: number;
  currentLevel: number;  // ultimo nivel observado (frames do WS)
  done: boolean;
}

export interface AnnounceCfg {
  on: boolean;
  text: string;
  everySec: number;                    // intervalo entre envios (segundos)
  channel: "world" | "trade" | "help"; // canal do chat do jogo
}

// anuncios salvos antes eram em MINUTOS (everyMin). Converte pro novo campo em segundos
// pra config antiga no banco nao quebrar. Piso de 60s (anti-flood do chat do jogo).
function normalizeAnnounce(a: (AnnounceCfg & { everyMin?: number }) | null): AnnounceCfg | null {
  if (!a) return null;
  const sec = typeof a.everySec === "number" ? a.everySec
    : typeof a.everyMin === "number" ? a.everyMin * 60
    : 600;
  return { on: !!a.on, text: String(a.text ?? ""), everySec: Math.max(60, Math.round(sec)), channel: a.channel ?? "world" };
}

// Escolha do que a auto-compra repoe alem das bolas. O jogo escolhe a pocao/revive sozinho
// (usa a melhor), entao a escolha vive aqui e so controla o que COMPRAMOS. null = "a melhor".
export interface SupplyCfg {
  potionId: number | null;
  reviveId: number | null;
}

function normalizeSupply(s: unknown): SupplyCfg | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
  return { potionId: pick(o.potionId), reviveId: pick(o.reviveId) };
}

export interface RobotDesired {
  enabled: boolean;
  mode: RobotMode;
  slug: string | null;
  sellItemIds: number[];
  pokeSellCfg: SavedPokeSellCfg | null;
  autobuy: boolean;
  supplyCfg: SupplyCfg | null;
  leveling: LevelingGoal | null;
  announce: AnnounceCfg | null;
  lastStatus: string;
  lastError: string | null;
}

interface Row {
  user_id: string;
  enabled: boolean;
  mode: string;
  slug: string | null;
  sell_item_ids: number[];
  poke_sell_cfg: SavedPokeSellCfg | null;
  autobuy: boolean;
  supply_cfg: SupplyCfg | null;
  leveling: LevelingGoal | null;
  announce: AnnounceCfg | null;
  last_status: string;
  last_error: string | null;
}

function fromRow(r: Row): RobotDesired {
  return {
    enabled: r.enabled,
    mode: r.mode === "auto" || r.mode === "leveling" ? r.mode : "manual",
    slug: r.slug,
    sellItemIds: Array.isArray(r.sell_item_ids) ? r.sell_item_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
    pokeSellCfg: r.poke_sell_cfg,
    autobuy: r.autobuy,
    supplyCfg: normalizeSupply(r.supply_cfg),
    leveling: r.leveling,
    announce: normalizeAnnounce(r.announce),
    lastStatus: r.last_status,
    lastError: r.last_error,
  };
}

export async function getRobotDesired(userId: string): Promise<RobotDesired | null> {
  const row = await queryOne<Row>(`SELECT * FROM robot_sessions WHERE user_id = $1`, [userId]);
  return row ? fromRow(row) : null;
}

/** Sessoes que o boot deve religar: enabled (conexao/hunt) OU autobuy (timer REST que
 *  tambem sobrevive a restart). O motor e single-conta por processo, mas a query devolve
 *  todas — quem religa decide (hoje: a mais recente). */
export async function listEnabledSessions(): Promise<{ userId: string; desired: RobotDesired }[]> {
  const rows = await query<Row>(`SELECT * FROM robot_sessions WHERE enabled OR autobuy ORDER BY updated_at DESC`);
  return rows.map((r) => ({ userId: r.user_id, desired: fromRow(r) }));
}

/** Grava o estado desejado (upsert parcial: so os campos passados mudam). */
export async function saveRobotDesired(
  userId: string,
  patch: Partial<Omit<RobotDesired, "lastStatus" | "lastError">>,
): Promise<void> {
  await query(
    `INSERT INTO robot_sessions (user_id, enabled, mode, slug, sell_item_ids, poke_sell_cfg, autobuy, leveling, announce, supply_cfg)
     VALUES ($1,
             COALESCE($2, false), COALESCE($3, 'manual'), $4,
             COALESCE($5, '[]'::jsonb), $6, COALESCE($7, false), $8, $12, $14)
     ON CONFLICT (user_id) DO UPDATE SET
       enabled       = COALESCE($2, robot_sessions.enabled),
       mode          = COALESCE($3, robot_sessions.mode),
       slug          = CASE WHEN $9  THEN $4 ELSE robot_sessions.slug END,
       sell_item_ids = COALESCE($5, robot_sessions.sell_item_ids),
       poke_sell_cfg = CASE WHEN $10 THEN $6 ELSE robot_sessions.poke_sell_cfg END,
       autobuy       = COALESCE($7, robot_sessions.autobuy),
       leveling      = CASE WHEN $11 THEN $8 ELSE robot_sessions.leveling END,
       announce      = CASE WHEN $13 THEN $12 ELSE robot_sessions.announce END,
       supply_cfg    = CASE WHEN $15 THEN $14 ELSE robot_sessions.supply_cfg END,
       updated_at    = now()`,
    [
      userId,
      patch.enabled ?? null,
      patch.mode ?? null,
      patch.slug ?? null,
      patch.sellItemIds ? JSON.stringify(patch.sellItemIds) : null,
      patch.pokeSellCfg ? JSON.stringify(patch.pokeSellCfg) : null,
      patch.autobuy ?? null,
      patch.leveling ? JSON.stringify(patch.leveling) : null,
      "slug" in patch,       // null tambem e valor valido pra slug/cfg/leveling/announce/supply:
      "pokeSellCfg" in patch, // flags dizem se o campo veio no patch
      "leveling" in patch,
      patch.announce ? JSON.stringify(patch.announce) : null,
      "announce" in patch,
      patch.supplyCfg ? JSON.stringify(patch.supplyCfg) : null,
      "supplyCfg" in patch,
    ],
  );
}

/** Ultimo status observado (monitor). Fire-and-forget no motor. */
export async function saveRobotStatus(userId: string, status: string, error?: string | null): Promise<void> {
  await query(
    `UPDATE robot_sessions SET last_status = $2, last_error = $3, updated_at = now() WHERE user_id = $1`,
    [userId, status, error ?? null],
  );
}
