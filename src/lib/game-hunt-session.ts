// Sessao de jogo UNIFICADA (server-side). O jogo e single-session: 1 conexao WS por conta.
// Entao existe UMA sessao que faz tudo ao mesmo tempo, como jobs independentes que ligam/
// desligam sem derrubar a conexao:
//   - HUNT: entra no campo (enter-hunt), faz poll do analyzer, registra kills/capturas.
//   - VENDA DE DROPS: rastreia a mochila (frame inventory) e vende os itens marcados (REST).
//   - VENDA DE POKEMON: pede a lista (pokes-get) e vende o que bate as travas (REST).
// Segurar a sessao chuta o navegador do jogo (o char farma idle sozinho). Os robos gravam
// eventos no banco (robot_events) — sobrevive a fechar o navegador.
//
// Protocolo (ver scripts/ws-protocol.md):
//   -> enter-hunt {slug} · analyzer-get · pokes-get
//   <- analyzer · field-kill · catch-result · inventory {items} · pokes {list}
//
// Singleton por processo (1 container long-lived). Uma conta por vez. Server-only.

import crypto from "node:crypto";
import type { Tokens } from "./game-auth";
import { sellItems, sellPokes } from "./game-shop";
import { getData } from "./data";
import { normalizeActivePokes } from "./game-account";
import { filterSellable, type PokeSellConfig } from "./poke-sell";
import { logRobotEvent } from "./robot-events";
import { addRobotSales } from "./robot-sales";
import { recordCaptured } from "./captured-pokes";
import type { PokeType, Rarity } from "./types";

const WS_BASE = (process.env.GAME_HOST || "https://poke.idleworld.online").replace(/^http/, "ws");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const ANALYZER_MS = 2000; // poll do analyzer (e keepalive da hunt)
const POKES_MS = 20000;   // poll da lista de pokemon (venda + keepalive)
const DROPS_MS = 30000;   // varredura de venda de drops
const SELL_EVERY_MS = 60 * 60 * 1000; // venda de pokemon roda 1x por hora (ou no "Vender agora")

export interface Analyzer {
  kills: number; seconds: number; xpGained: number;
  lootItems: number; lootGold: number;
  ballsUsed: number; potionsUsed: number; supplyGold: number;
  captures: number; shinyCaptures: number; capturesGold: number;
  balance: number; goldPerHour: number; xpPerHour: number; killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
export interface KillLog {
  at: number; kind: "kill" | "catch"; species: string; shiny: boolean;
  xp: number; loot: { itemId: number; name: string; qty: number }[]; ball?: string;
}
export interface SoldItem { itemId: number; name: string; qty: number; gold: number; at: number }
export interface SoldPoke { id: string; name: string; speciesId: number; level: number; shiny: boolean; ivTotal: number; quality: number; sellValue: number; rarity: Rarity }
export type SessStatus = "idle" | "connecting" | "running" | "kicked" | "error";

// venda de pokemon agregada POR RARIDADE (o card e por raridade escolhida, nao por bicho):
// a hunt so soma quantidade e valor de cada raridade. Reseta ao trocar de hunt.
export type RaritySold = Partial<Record<Rarity, { count: number; gold: number }>>;

export interface PokeSellSub { on: boolean; soldByRarity: RaritySold }

// visao "hunt" (GET /api/vip/hunt) — o que a aba Hunt e os Itens vendidos leem
export interface HuntState {
  status: SessStatus; error?: string;
  slug: string | null; since: number | null; updatedAt: number | null;
  analyzer: Analyzer | null; recentKills: KillLog[]; soldItems: SoldItem[]; autoSellCount: number;
  pokeSellOn: boolean;
}
// visao "auto-sell" (GET /api/vip/autosell) — Configuracoes (24/7) e a aba Pokemon vendidos.
// So o essencial: status, as raridades configuradas (cards fixos) e o vendido por raridade.
export interface AutoSellView { status: SessStatus; error?: string; sellRarities: Rarity[]; soldByRarity: RaritySold }

class GameSession {
  private ws: WebSocket | null = null;
  private analyzerPoll: ReturnType<typeof setInterval> | null = null;
  private pokesPoll: ReturnType<typeof setInterval> | null = null;
  private dropTimer: ReturnType<typeof setInterval> | null = null;
  private sellingDrops = false;
  private sellingPokes = false;
  private summaryLogged = false;

  private userId: string | null = null;
  private tokens: Tokens | null = null;
  private onTokens: ((t: Tokens) => Promise<void>) | null = null;
  private shard = 0;

  // jobs configurados
  private slug: string | null = null;
  private sellIds = new Set<number>();
  private pokeCfg: PokeSellConfig | null = null;

  private inv = new Map<number, number>();
  private status: SessStatus = "idle";
  private error: string | undefined;
  private since: number | null = null;
  private updatedAt: number | null = null;
  private analyzer: Analyzer | null = null;
  private recentKills: KillLog[] = [];
  private soldItems: SoldItem[] = [];
  private poke: PokeSellSub = { on: false, soldByRarity: {} };
  private lastPokeSellAt = 0; // ultima venda de pokemon (throttle de 1h)
  private forceSell = false;  // "Vender agora" forca a proxima varredura
  private recordedIds = new Set<string>(); // ids ja gravados no acervo (evita rescrever no banco)

  private jobsActive() { return this.slug != null || this.pokeCfg != null; }

  getState(): HuntState {
    return {
      status: this.status, error: this.error, slug: this.slug, since: this.since, updatedAt: this.updatedAt,
      analyzer: this.analyzer, recentKills: this.recentKills.slice(0, 50), soldItems: this.soldItems.slice(0, 30),
      autoSellCount: this.sellIds.size, pokeSellOn: this.pokeCfg != null,
    };
  }

  getAutoSellView(): AutoSellView {
    return {
      status: this.pokeCfg ? this.status : "idle", error: this.error,
      sellRarities: this.pokeCfg?.sellRarities ?? [],
      soldByRarity: this.poke.soldByRarity,
    };
  }

  private ctx(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>) {
    this.userId = userId; this.tokens = tokens; this.shard = shard; this.onTokens = onTokens;
  }

  // liga/atualiza o job de HUNT (reinicia a acumulacao daquela caca)
  setHunt(userId: string, tokens: Tokens, shard: number, slug: string, sellItemIds: number[], onTokens: (t: Tokens) => Promise<void>) {
    this.logSummary(); // fecha o resumo da hunt anterior, se houve
    this.ctx(userId, tokens, shard, onTokens);
    this.slug = slug;
    this.sellIds = new Set(sellItemIds.filter((n) => Number.isInteger(n) && n > 0));
    this.inv.clear();
    // trocar de hunt zera o que foi vendido NA HUNT (itens e pokemon por raridade). O
    // totalizador cumulativo (robot_sales) NAO zera — vive no banco.
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldByRarity = {}; this.summaryLogged = false;
    this.applyOrConnect(true);
  }

  stopHunt() {
    this.logSummary();
    this.slug = null; this.sellIds.clear(); this.inv.clear();
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldByRarity = {};
    if (!this.jobsActive()) this.teardown(); else this.refreshTimers();
  }

  // liga/atualiza o job de VENDA DE POKEMON (cfg null = desliga). NAO zera o vendido por
  // raridade (isso so zera ao trocar de hunt) — ligar/desligar preserva a contagem da hunt.
  setPokeSell(userId: string, tokens: Tokens, shard: number, cfg: PokeSellConfig, onTokens: (t: Tokens) => Promise<void>) {
    this.ctx(userId, tokens, shard, onTokens);
    this.pokeCfg = cfg;
    this.poke.on = true;
    this.lastPokeSellAt = 0; // a primeira varredura vende logo; depois e de 1h em 1h
    this.applyOrConnect(false);
  }

  stopPokeSell() {
    this.pokeCfg = null;
    this.poke.on = false;
    if (!this.jobsActive()) this.teardown(); else this.refreshTimers();
  }

  stop() { this.logSummary(); this.slug = null; this.sellIds.clear(); this.pokeCfg = null; this.teardown(); }

  // aplica a config: conecta se preciso; se ja conectado, so ajusta (sem derrubar)
  private applyOrConnect(reenter: boolean) {
    if (!this.ws) { this.connect(); return; }
    if (this.slug && reenter) this.send({ type: "enter-hunt", slug: this.slug });
    this.refreshTimers();
  }

  private connect() {
    if (!this.tokens) return;
    this.status = "connecting"; this.error = undefined; this.since = Date.now(); this.updatedAt = null;
    const url = `${WS_BASE}/ws${this.shard}?token=${encodeURIComponent(this.tokens.access)}&cmid=${crypto.randomBytes(16).toString("hex")}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, { headers: { Origin: "https://poke.idleworld.online", "User-Agent": UA } } as unknown as string[]);
    } catch (e) { this.status = "error"; this.error = String(e); return; }
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.status = "running";
      if (this.slug) this.send({ type: "enter-hunt", slug: this.slug });
      this.refreshTimers();
    });
    ws.addEventListener("message", (ev: MessageEvent) => this.onMessage(ev));
    ws.addEventListener("close", (ev: unknown) => this.onGone("kicked", (ev as { code?: number } | undefined)?.code));
    ws.addEventListener("error", () => this.onGone("error"));
  }

  private send(obj: unknown) { try { this.ws?.send(JSON.stringify(obj)); } catch {} }

  private refreshTimers() {
    if (this.analyzerPoll) { clearInterval(this.analyzerPoll); this.analyzerPoll = null; }
    if (this.pokesPoll) { clearInterval(this.pokesPoll); this.pokesPoll = null; }
    if (this.dropTimer) { clearInterval(this.dropTimer); this.dropTimer = null; }
    if (this.slug) {
      this.send({ type: "analyzer-get" });
      this.analyzerPoll = setInterval(() => this.send({ type: "analyzer-get" }), ANALYZER_MS);
    }
    if (this.pokeCfg) {
      setTimeout(() => this.send({ type: "pokes-get" }), 500);
      this.pokesPoll = setInterval(() => this.send({ type: "pokes-get" }), POKES_MS);
    }
    if (this.sellIds.size) this.dropTimer = setInterval(() => void this.sellDrops(), DROPS_MS);
  }

  private onMessage(ev: MessageEvent) {
    let m: Record<string, unknown>;
    try { m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
    if (m.type === "analyzer") {
      this.analyzer = m as unknown as Analyzer; this.updatedAt = Date.now();
    } else if (m.type === "field-kill") {
      const loot = Array.isArray(m.loot) ? (m.loot as Record<string, unknown>[]).map((l) => ({ itemId: Number(l.itemId ?? 0), name: String(l.name ?? ""), qty: Number(l.qty ?? 0) })) : [];
      this.push({ at: Date.now(), kind: "kill", species: String(m.speciesName ?? "?"), shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot });
    } else if (m.type === "catch-result") {
      if (m.success) {
        const species = String(m.speciesName ?? "?"), shiny = Boolean(m.shiny), ball = String(m.ballName ?? "");
        this.push({ at: Date.now(), kind: "catch", species, shiny, xp: 0, loot: [], ball });
        if (shiny && this.userId) void logRobotEvent(this.userId, { kind: "shiny", title: `Shiny ${species} capturado!`, body: ball || null, data: { species, ball } });
      }
    } else if (m.type === "inventory") {
      const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
      this.inv.clear();
      for (const it of items) this.inv.set(Number(it.itemId ?? 0), Number(it.quantity ?? it.qty ?? 0));
    } else if (m.type === "pokes" && Array.isArray(m.list)) {
      void this.recordKept(m.list);   // acervo de capturados (real-time)
      void this.sellPokesSweep(m.list); // venda (throttle 1h)
    }
  }

  private push(ev: KillLog) {
    this.recentKills.unshift(ev);
    if (this.recentKills.length > 50) this.recentKills.length = 50;
  }

  // vende os drops marcados que tem na mochila (REST)
  private async sellDrops() {
    if (this.sellingDrops || !this.tokens || this.sellIds.size === 0) return;
    const toSell: { itemId: number; qty: number }[] = [];
    for (const id of this.sellIds) { const q = this.inv.get(id) ?? 0; if (q > 0) toSell.push({ itemId: id, qty: q }); }
    if (!toSell.length) return;
    this.sellingDrops = true;
    try {
      const w = await sellItems(this.tokens, toSell);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (w.ok) {
        const data = await getData();
        let qtyTotal = 0, goldTotal = 0;
        for (const s of toSell) {
          this.inv.set(s.itemId, 0);
          const it = data.getItem(s.itemId);
          const gold = (it?.npcPrice ?? 0) * s.qty;
          qtyTotal += s.qty; goldTotal += gold;
          const ex = this.soldItems.find((x) => x.itemId === s.itemId);
          if (ex) { ex.qty += s.qty; ex.gold += gold; ex.at = Date.now(); }
          else this.soldItems.unshift({ itemId: s.itemId, name: it?.name ?? `#${s.itemId}`, qty: s.qty, gold, at: Date.now() });
        }
        if (this.soldItems.length > 30) this.soldItems.length = 30;
        if (this.userId && qtyTotal > 0) {
          void logRobotEvent(this.userId, { kind: "item-sold", title: `Vendeu ${qtyTotal} itens`, body: `+$${Math.round(goldTotal)}`, data: { count: qtyTotal, gold: goldTotal } });
          void addRobotSales(this.userId, { itemsCount: qtyTotal, itemsGold: goldTotal }); // totalizador cumulativo
        }
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingDrops = false; }
  }

  // Uma VARREDURA de venda de pokemon: le a lista viva da conta, aplica as travas e vende
  // os que batem (REST). Nunca time/lider/starter/shiny (filterSellable). Roda 1x por hora
  // (throttle) ou quando o usuario clica "Vender agora" (forceSell) — evita gastar servidor
  // vendendo a cada poll. O poll de pokes-get (20s) segue so como keepalive.
  private async sellPokesSweep(list: unknown[]) {
    if (this.sellingPokes || !this.tokens || !this.pokeCfg) return;
    const now = Date.now();
    if (!this.forceSell && now - this.lastPokeSellAt < SELL_EVERY_MS) return; // ainda nao e hora
    this.sellingPokes = true;
    this.forceSell = false;
    this.lastPokeSellAt = now;
    try {
      const all = normalizeActivePokes(list);
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const matches = filterSellable(all, this.pokeCfg, rarityOf);
      if (!matches.length) return;
      const ids = matches.map((p) => p.id);
      const w = await sellPokes(this.tokens, ids);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (w.ok && w.data) {
        const sold = w.data.sold ?? ids.length, gold = w.data.goldGained ?? 0;
        if (sold > 0) {
          // agrega POR RARIDADE (os `sold` primeiros dos matches, ordenados do pior pro
          // melhor) — o card e por raridade, so quantidade e valor. E soma no totalizador.
          for (const p of matches.slice(0, sold)) {
            const cur = this.poke.soldByRarity[p.rarity] ?? { count: 0, gold: 0 };
            cur.count += 1; cur.gold += p.sellValue;
            this.poke.soldByRarity[p.rarity] = cur;
          }
          if (this.userId) {
            void logRobotEvent(this.userId, { kind: "poke-sold", title: `Vendeu ${sold} pokemon`, body: `+$${Math.round(gold)}`, data: { count: sold, gold } });
            void addRobotSales(this.userId, { pokesCount: sold, pokesGold: gold }); // totalizador cumulativo
          }
        }
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingPokes = false; }
  }

  // "Vender agora": forca a proxima resposta de pokes-get a vender (ignora o throttle de 1h).
  sellNow() {
    if (!this.pokeCfg) return;
    this.forceSell = true;
    this.send({ type: "pokes-get" });
  }

  // grava no acervo (captured_pokes) os pokemon MANTIDOS — os que NAO batem as travas de
  // venda (bons demais, raridade nao marcada, shiny, time/lider/starter). Roda a cada lista
  // de pokes (real-time, sem throttle), so gravando ids novos (dedupe em memoria).
  private async recordKept(list: unknown[]) {
    if (!this.userId || !this.pokeCfg) return;
    try {
      const all = normalizeActivePokes(list);
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const sellIds = new Set(filterSellable(all, this.pokeCfg, rarityOf).map((p) => p.id));
      const kept = all.filter((p) => !sellIds.has(p.id) && !this.recordedIds.has(p.id));
      if (!kept.length) return;
      const rows = kept.map((p) => {
        const cr = data.getCreature(p.speciesId);
        return {
          pokeId: p.id, speciesId: p.speciesId, name: p.name, level: p.level, shiny: p.shiny,
          ivTotal: p.ivTotal, quality: p.quality, rarity: cr?.rarity ?? ("COMMON" as Rarity),
          type1: cr?.type1 ?? ("NORMAL" as PokeType), type2: cr?.type2 ?? null,
        };
      });
      for (const p of kept) this.recordedIds.add(p.id);
      await recordCaptured(this.userId, rows);
    } catch { /* nao derruba a sessao */ }
  }

  // depois que o usuario limpa o acervo (DELETE), esquece o cache pra re-gravar o que ainda esta na conta
  resetCapturedCache() { this.recordedIds.clear(); }

  private logSummary() {
    if (this.summaryLogged || !this.userId) return;
    const a = this.analyzer;
    if (!a || a.kills <= 0) return;
    this.summaryLogged = true;
    const slug = this.slug ?? "";
    void logRobotEvent(this.userId, { kind: "hunt-summary", title: `Hunt ${slug} — resumo`, body: `${a.kills} kills · ${a.captures} capturas · +$${Math.round(a.balance)}`, data: { slug, kills: a.kills, captures: a.captures, xp: a.xpGained, balance: a.balance } });
  }

  private clearTimers() {
    for (const tmr of [this.analyzerPoll, this.pokesPoll, this.dropTimer]) if (tmr) clearInterval(tmr);
    this.analyzerPoll = this.pokesPoll = this.dropTimer = null;
  }

  // a conexao caiu (kicked/error). Mantem os jobs configurados; o usuario religa.
  private onGone(status: SessStatus, code?: number) {
    this.clearTimers();
    this.ws = null;
    if (this.status === "running" || this.status === "connecting") {
      this.logSummary();
      this.status = status;
      this.error = code != null ? `close ${code}` : undefined;
    }
  }

  private teardown() {
    this.clearTimers();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.inv.clear();
    this.status = "idle"; this.error = undefined; this.since = null; this.updatedAt = null;
  }
}

// singleton por processo (sobrevive entre requests no server long-lived)
const g = globalThis as unknown as { __piwSession?: GameSession };
export const gameSession: GameSession = g.__piwSession ?? (g.__piwSession = new GameSession());
