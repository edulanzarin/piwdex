// Alertas VIP — modelo, acesso ao banco e motor de match do SNIPER DE MERCADO. Tudo
// LEITURA do jogo: o worker le o mercado e casa contra as watchlists; nada escreve na
// conta do jogador (por isso roda sem a extensao).
//
// Ciclo de vida do alerta:
//  - snipe: anuncio do mercado que bate os criterios de uma watchlist.
//  - dedup_key (UNIQUE por user) impede re-alertar o mesmo anuncio a cada scan de 60s.
//  - dispensar = marca dismissed_at (some da caixa, mas a linha fica de tombstone pro
//    dedup nao re-inserir). Pausar a busca esconde os alertas dela; excluir a busca
//    apaga por cascade (watchlist_id ON DELETE CASCADE).

import { query, queryOne } from "./db";
import type { MarketMon, MarketItem, Currency } from "./game-account";

export type NotifKind = "snipe";

export interface Watchlist {
  id: string;
  userId: string;
  kind: "pokemon" | "item"; // o que a busca vigia
  itemId: number | null;    // refId do item (kind item)
  speciesId: number | null;
  type: string | null; // tipo (exclusivo com speciesId)
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
  watchlistId: string; // a busca que gerou (pausar esconde / excluir apaga por cascade)
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

// ---- watchlists ----

interface WatchRow {
  id: string;
  user_id: string;
  kind: string | null;
  item_id: number | null;
  species_id: number | null;
  type: string | null;
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
  kind: r.kind === "item" ? "item" : "pokemon",
  itemId: r.item_id,
  speciesId: r.species_id,
  type: r.type,
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
  "id, user_id, kind, item_id, species_id, type, currency, max_price, min_quality, min_iv, shiny_only, below_fair, active, label, criado_em";

export async function listWatchlistsByUser(userId: string): Promise<Watchlist[]> {
  const rows = await query<WatchRow>(
    `SELECT ${WATCH_COLS} FROM watchlists WHERE user_id = $1 ORDER BY criado_em DESC`,
    [userId],
  );
  return rows.map(toWatch);
}

// Todas as watchlists ativas de usuarios VIP com vinculo de jogo ativo (o que o worker varre).
export async function listActiveWatchlists(): Promise<Watchlist[]> {
  const rows = await query<WatchRow>(
    `SELECT w.id, w.user_id, w.kind, w.item_id, w.species_id, w.currency, w.max_price, w.min_quality,
            w.type, w.min_iv, w.shiny_only, w.below_fair, w.active, w.label, w.criado_em
       FROM watchlists w
       JOIN users u      ON u.id = w.user_id
       JOIN game_links g ON g.user_id = w.user_id
      WHERE w.active AND u.vip AND g.status = 'active'`,
  );
  return rows.map(toWatch);
}

export interface WatchInput {
  kind: "pokemon" | "item";
  itemId: number | null;
  speciesId: number | null;
  type: string | null;
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
       (user_id, kind, item_id, species_id, type, currency, max_price, min_quality, min_iv, shiny_only, below_fair, label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${WATCH_COLS}`,
    [
      userId,
      w.kind,
      w.itemId,
      w.speciesId,
      w.type,
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

// So mostra alertas nao-dispensados de buscas ativas (pausar esconde; a linha
// dispensada fica no banco de tombstone pro dedup, mas nunca aparece).
const VISIBLE = `n.dismissed_at IS NULL AND w.active`;

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const rows = await query<NotifRow>(
    `SELECT n.id, n.kind, n.title, n.body, n.data, n.read_at, n.criado_em
       FROM notifications n
       JOIN watchlists w ON w.id = n.watchlist_id
      WHERE n.user_id = $1 AND ${VISIBLE}
      ORDER BY n.criado_em DESC LIMIT $2`,
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
    `SELECT count(*)::text AS n
       FROM notifications n
       JOIN watchlists w ON w.id = n.watchlist_id
      WHERE n.user_id = $1 AND n.read_at IS NULL AND ${VISIBLE}`,
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

// "Negar a oferta": esconde da caixa mas mantem a linha (tombstone do dedup).
export async function dismissNotifications(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await query(
    `UPDATE notifications SET dismissed_at = now()
      WHERE user_id = $1 AND dismissed_at IS NULL AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
}

// Grava em lote, ignorando os que ja existem (dedup). Retorna quantas foram novas.
export async function insertNotifications(notifs: NewNotif[]): Promise<number> {
  let inserted = 0;
  for (const n of notifs) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO notifications (user_id, kind, dedup_key, watchlist_id, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, dedup_key) DO NOTHING
       RETURNING id`,
      [n.userId, n.kind, n.dedupKey, n.watchlistId, n.title, n.body ?? null, n.data ? JSON.stringify(n.data) : null],
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
  if (w.kind !== "pokemon") return false;
  if (w.speciesId != null && m.speciesId !== w.speciesId) return false;
  if (w.type != null && m.type1 !== w.type && m.type2 !== w.type) return false;
  if (w.currency != null && m.currency !== w.currency) return false;
  if (w.maxPrice != null && m.price > w.maxPrice) return false;
  if (w.shinyOnly && !m.shiny) return false;
  if (w.minQuality != null && (m.quality == null || m.quality < w.minQuality)) return false;
  if (w.minIv != null && (m.ivTotal == null || m.ivTotal < w.minIv)) return false;
  if (w.belowFair && !(m.fairPrice != null && m.price < m.fairPrice)) return false;
  return true;
}

// Um anuncio de ITEM casa a watchlist de item? maxPrice compara o preco UNITARIO;
// belowFair vira "abaixo do NPC" (o justo de item e o preco de loja).
function itemMatches(w: Watchlist, i: MarketItem): boolean {
  if (w.kind !== "item") return false;
  if (w.itemId != null && i.refId !== w.itemId) return false;
  if (w.currency != null && i.currency !== w.currency) return false;
  if (w.maxPrice != null && i.price > w.maxPrice) return false;
  if (w.belowFair && !i.belowNpc) return false;
  return true;
}

// Casa as watchlists de ITEM contra as pilhas do mercado. dedup por (watchlist, item,
// preco): a MESMA pilha re-listada no mesmo preco nao re-alerta; preco novo alerta.
export function matchItemSnipes(watchlists: Watchlist[], items: MarketItem[]): NewNotif[] {
  const out: NewNotif[] = [];
  for (const w of watchlists) {
    if (w.kind !== "item") continue;
    for (const i of items) {
      if (!itemMatches(w, i)) continue;
      const coin = i.currency === "DIAMONDS" ? "diamantes" : "ouro";
      out.push({
        userId: w.userId,
        kind: "snipe",
        dedupKey: `snipe-item:${w.id}:${i.refId}:${i.currency}:${i.price}`,
        watchlistId: w.id,
        title: `${i.quantity}x ${i.name} por ${i.price.toLocaleString("pt-BR")} ${coin} cada${i.belowNpc ? " (abaixo do NPC)" : ""}`,
        body: `${i.sellers} vendedor${i.sellers > 1 ? "es" : ""} · ${i.category}`,
        data: {
          kind: "item",
          itemId: i.refId,
          itemKind: i.kind,
          name: i.name,
          icon: i.icon,
          category: i.category,
          quantity: i.quantity,
          price: i.price,
          currency: i.currency,
          belowNpc: i.belowNpc,
          listingId: i.listingId,
          watchlistId: w.id,
          wishLabel: w.label,
        },
      });
    }
  }
  return out;
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
        watchlistId: w.id,
        title: `${m.shiny ? "shiny " : ""}${m.name} por ${m.price.toLocaleString("pt-BR")} ${coin}${deal}`,
        body:
          m.quality != null || m.ivTotal != null || m.power != null
            ? `Q ${m.quality?.toFixed(3) ?? "?"} · IV ${m.ivTotal ?? "?"} · Power ${m.power ?? "?"} · Lv.${m.level}`
            : `Lv.${m.level}`,
        data: {
          // tudo que o modal do Mercado precisa pra remontar o anuncio (MarketMon):
          listingId: m.listingId,
          speciesId: m.speciesId,
          name: m.name,
          level: m.level,
          shiny: m.shiny,
          type1: m.type1,
          type2: m.type2,
          price: m.price,
          currency: m.currency,
          quality: m.quality,
          ivTotal: m.ivTotal,
          power: m.power,
          // stats REAIS do individuo: sem isso o modal do desejo caia nos stats
          // BASE da especie, ficando diferente do modal do mercado
          stats: m.stats,
          belowNpc: m.belowNpc,
          sellers: m.sellers,
          fairPrice: m.fairPrice ?? null,
          // vinculo com o desejo (agrupar/rotular na aba Alertas e Desejos):
          watchlistId: w.id,
          wishLabel: w.label,
        },
      });
    }
  }
  return out;
}
