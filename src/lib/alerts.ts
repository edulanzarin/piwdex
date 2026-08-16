// Alertas VIP — modelo, acesso ao banco e motor de match. Tudo LEITURA do jogo:
// o worker le mercado + conta (ja normalizados) e casa contra as watchlists; nada
// escreve na conta do jogador (por isso roda sem a extensao).
//
// Duas fontes de alerta:
//  - snipe: anuncio do mercado que bate os criterios de uma watchlist.
//  - conta: evento idle (ovo pronto, slot de breeding livre, streak pra resgatar,
//           VIP expirando) — vem do /api/game/* ja normalizado em Account.
//
// dedup_key da idempotencia: o worker roda a cada ~60s e o UNIQUE(user_id, dedup_key)
// impede duplicar. Snipe casa por anuncio; evento de conta casa por entidade ou por dia.

import { query, queryOne } from "./db";
import type { MarketMon, Currency, Account } from "./game-account";

export type NotifKind = "snipe" | "egg" | "breeding" | "streak" | "vip";

export interface Watchlist {
  id: string;
  userId: string;
  speciesId: number | null;
  currency: Currency | null;
  maxPrice: number | null;
  minQuality: number | null;
  minIv: number | null;
  shinyOnly: boolean;
  belowFair: boolean;
  active: boolean;
  label: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// O que o motor produz; vira uma linha em notifications (ON CONFLICT DO NOTHING).
export interface NewNotif {
  userId: string;
  kind: NotifKind;
  dedupKey: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

// ---- watchlists ----

interface WatchRow {
  id: string;
  user_id: string;
  species_id: number | null;
  currency: string | null;
  max_price: string | null; // bigint volta como string no pg
  min_quality: string | null; // numeric volta como string
  min_iv: number | null;
  shiny_only: boolean;
  below_fair: boolean;
  active: boolean;
  label: string | null;
  criado_em: string;
}

const toWatch = (r: WatchRow): Watchlist => ({
  id: r.id,
  userId: r.user_id,
  speciesId: r.species_id,
  currency: r.currency === "GOLD" || r.currency === "DIAMONDS" ? r.currency : null,
  maxPrice: r.max_price != null ? Number(r.max_price) : null,
  minQuality: r.min_quality != null ? Number(r.min_quality) : null,
  minIv: r.min_iv,
  shinyOnly: r.shiny_only,
  belowFair: r.below_fair,
  active: r.active,
  label: r.label,
  createdAt: r.criado_em,
});

const WATCH_COLS =
  "id, user_id, species_id, currency, max_price, min_quality, min_iv, shiny_only, below_fair, active, label, criado_em";

export async function listWatchlistsByUser(userId: string): Promise<Watchlist[]> {
  const rows = await query<WatchRow>(
    `SELECT ${WATCH_COLS} FROM watchlists WHERE user_id = $1 ORDER BY criado_em DESC`,
    [userId],
  );
  return rows.map(toWatch);
}

// Usuarios VIP com vinculo de jogo ativo — recebem os alertas de conta (ovo, streak,
// breeding, VIP expirando) mesmo sem watchlist. O snipe so vale pra quem tem watchlist.
export async function listAlertableUsers(): Promise<string[]> {
  const rows = await query<{ user_id: string }>(
    `SELECT u.id AS user_id
       FROM users u
       JOIN game_links g ON g.user_id = u.id
      WHERE u.vip AND g.status = 'active'`,
  );
  return rows.map((r) => r.user_id);
}

// Todas as watchlists ativas de usuarios VIP com vinculo de jogo ativo (o que o worker varre).
export async function listActiveWatchlists(): Promise<Watchlist[]> {
  const rows = await query<WatchRow>(
    `SELECT w.id, w.user_id, w.species_id, w.currency, w.max_price, w.min_quality,
            w.min_iv, w.shiny_only, w.below_fair, w.active, w.label, w.criado_em
       FROM watchlists w
       JOIN users u      ON u.id = w.user_id
       JOIN game_links g ON g.user_id = w.user_id
      WHERE w.active AND u.vip AND g.status = 'active'`,
  );
  return rows.map(toWatch);
}

export interface WatchInput {
  speciesId: number | null;
  currency: Currency | null;
  maxPrice: number | null;
  minQuality: number | null;
  minIv: number | null;
  shinyOnly: boolean;
  belowFair: boolean;
  label: string | null;
}

export async function createWatchlist(userId: string, w: WatchInput): Promise<Watchlist> {
  const row = await queryOne<WatchRow>(
    `INSERT INTO watchlists
       (user_id, species_id, currency, max_price, min_quality, min_iv, shiny_only, below_fair, label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${WATCH_COLS}`,
    [
      userId,
      w.speciesId,
      w.currency,
      w.maxPrice,
      w.minQuality,
      w.minIv,
      w.shinyOnly,
      w.belowFair,
      w.label,
    ],
  );
  return toWatch(row!);
}

export async function deleteWatchlist(userId: string, id: string): Promise<void> {
  await query(`DELETE FROM watchlists WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function setWatchlistActive(userId: string, id: string, active: boolean): Promise<void> {
  await query(`UPDATE watchlists SET active = $3 WHERE id = $1 AND user_id = $2`, [id, userId, active]);
}

// ---- notifications (inbox) ----

interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  criado_em: string;
}

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const rows = await query<NotifRow>(
    `SELECT id, kind, title, body, data, read_at, criado_em
       FROM notifications WHERE user_id = $1 ORDER BY criado_em DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: (r.kind as NotifKind) ?? "snipe",
    title: r.title,
    body: r.body,
    data: r.data,
    readAt: r.read_at,
    createdAt: r.criado_em,
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return row ? Number(row.n) : 0;
}

export async function markRead(userId: string, ids: string[] | "all"): Promise<void> {
  if (ids === "all") {
    await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  } else if (ids.length) {
    await query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2::uuid[])`,
      [userId, ids],
    );
  }
}

// Grava em lote, ignorando os que ja existem (dedup). Retorna quantas foram novas.
export async function insertNotifications(notifs: NewNotif[]): Promise<number> {
  let inserted = 0;
  for (const n of notifs) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO notifications (user_id, kind, dedup_key, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, dedup_key) DO NOTHING
       RETURNING id`,
      [n.userId, n.kind, n.dedupKey, n.title, n.body ?? null, n.data ? JSON.stringify(n.data) : null],
    );
    if (row) inserted++;
  }
  return inserted;
}

// ---- motor de match (puro; a rota /api/cron/scan faz o IO e chama aqui) ----

// Anuncio ja pontuado pela rota (fairPrice preenchido pelo motor de valor).
type ScoredMon = MarketMon;

// Um anuncio casa a watchlist? (todos os criterios definidos precisam bater)
function monMatches(w: Watchlist, m: ScoredMon): boolean {
  if (w.speciesId != null && m.speciesId !== w.speciesId) return false;
  if (w.currency != null && m.currency !== w.currency) return false;
  if (w.maxPrice != null && m.price > w.maxPrice) return false;
  if (w.shinyOnly && !m.shiny) return false;
  if (w.minQuality != null && (m.quality == null || m.quality < w.minQuality)) return false;
  if (w.minIv != null && (m.ivTotal == null || m.ivTotal < w.minIv)) return false;
  if (w.belowFair && !(m.fairPrice != null && m.price < m.fairPrice)) return false;
  return true;
}

// Casa as watchlists ativas contra o mercado inteiro. dedup por (watchlist, anuncio):
// o mesmo anuncio nao re-notifica a mesma watchlist, mas re-notifica outra que tambem case.
export function matchSnipes(watchlists: Watchlist[], mons: ScoredMon[]): NewNotif[] {
  const out: NewNotif[] = [];
  for (const w of watchlists) {
    for (const m of mons) {
      if (!monMatches(w, m)) continue;
      const coin = m.currency === "DIAMONDS" ? "diamantes" : "ouro";
      const deal = m.fairPrice != null && m.price < m.fairPrice ? " (abaixo do justo)" : "";
      out.push({
        userId: w.userId,
        kind: "snipe",
        dedupKey: `snipe:${w.id}:${m.listingId}`,
        title: `${m.shiny ? "shiny " : ""}${m.name} por ${m.price.toLocaleString("pt-BR")} ${coin}${deal}`,
        body:
          m.quality != null || m.ivTotal != null || m.power != null
            ? `Q ${m.quality?.toFixed(3) ?? "?"} · IV ${m.ivTotal ?? "?"} · Power ${m.power ?? "?"} · Lv.${m.level}`
            : `Lv.${m.level}`,
        data: {
          listingId: m.listingId,
          speciesId: m.speciesId,
          shiny: m.shiny,
          price: m.price,
          currency: m.currency,
          quality: m.quality,
          ivTotal: m.ivTotal,
          power: m.power,
          fairPrice: m.fairPrice ?? null,
          watchlistId: w.id,
        },
      });
    }
  }
  return out;
}

// Alertas idle da conta de um usuario. dayBucket permite re-lembrar eventos recorrentes
// (streak, slot livre) uma vez por dia sem spammar a cada scan.
export function accountAlerts(userId: string, account: Account, dayBucket: string): NewNotif[] {
  const out: NewNotif[] = [];
  const b = account.breeding;

  for (const egg of b.eggs) {
    if (egg.ready) {
      out.push({
        userId,
        kind: "egg",
        dedupKey: `egg:${egg.id}`,
        title: `Ovo pronto pra chocar${egg.shiny ? " (shiny!)" : ""}`,
        body: egg.name,
        data: { eggId: egg.id, dexId: egg.dexId, shiny: egg.shiny },
      });
    }
  }

  if (b.unlocked && b.maxSlots > 0 && b.usedSlots < b.maxSlots) {
    const free = b.maxSlots - b.usedSlots;
    out.push({
      userId,
      kind: "breeding",
      dedupKey: `breeding-free:${dayBucket}`,
      title: `${free} slot(s) de breeding livre(s)`,
      body: `${b.usedSlots}/${b.maxSlots} em uso`,
      data: { free, used: b.usedSlots, max: b.maxSlots },
    });
  }

  if (account.streak.available > 0) {
    out.push({
      userId,
      kind: "streak",
      dedupKey: `streak:${dayBucket}`,
      title: `${account.streak.available} ponto(s) de streak pra resgatar`,
      body: null,
      data: { available: account.streak.available },
    });
  }

  const vipUntil = account.trainer.vipUntil ? new Date(account.trainer.vipUntil) : null;
  if (vipUntil && !Number.isNaN(vipUntil.getTime())) {
    const days = Math.ceil((vipUntil.getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 3) {
      out.push({
        userId,
        kind: "vip",
        dedupKey: `vip-expiring:${vipUntil.toISOString().slice(0, 10)}`,
        title: `VIP do jogo expira em ${days} dia(s)`,
        body: null,
        data: { days, vipUntil: account.trainer.vipUntil },
      });
    }
  }

  return out;
}
