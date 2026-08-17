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
import type { Rarity } from "./types";

const WS_BASE = (process.env.GAME_HOST || "https://poke.idleworld.online").replace(/^http/, "ws");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const ANALYZER_MS = 2000; // poll do analyzer (e keepalive da hunt)
const POKES_MS = 20000;   // poll da lista de pokemon (venda + keepalive)
const DROPS_MS = 30000;   // varredura de venda de drops

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

export interface PokeSellSub { on: boolean; lastSweepAt: number | null; lastSold: number; soldTotal: number; goldTotal: number; lastMatches: SoldPoke[] }

// visao "hunt" (GET /api/vip/hunt) — o que a aba Hunt e os Itens vendidos leem
export interface HuntState {
  status: SessStatus; error?: string;
  slug: string | null; since: number | null; updatedAt: number | null;
  analyzer: Analyzer | null; recentKills: KillLog[]; soldItems: SoldItem[]; autoSellCount: number;
  pokeSellOn: boolean;
}
// visao "auto-sell" (GET /api/vip/autosell) — o que o card de venda 24/7 le
export interface AutoSellView { status: SessStatus; error?: string; since: number | null; lastSweepAt: number | null; lastSold: number; soldTotal: number; goldTotal: number; lastMatches: SoldPoke[] }

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
  private poke: PokeSellSub = { on: false, lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, lastMatches: [] };

  private jobsActive() { return this.slug != null || this.pokeCfg != null; }

  getState(): HuntState {
    return {
      status: this.status, error: this.error, slug: this.slug, since: this.since, updatedAt: this.updatedAt,
      analyzer: this.analyzer, recentKills: this.recentKills.slice(0, 50), soldItems: this.soldItems.slice(0, 40),
      autoSellCount: this.sellIds.size, pokeSellOn: this.pokeCfg != null,
    };
  }

  getAutoSellView(): AutoSellView {
    return {
      status: this.pokeCfg ? this.status : "idle", error: this.error, since: this.since,
      lastSweepAt: this.poke.lastSweepAt, lastSold: this.poke.lastSold, soldTotal: this.poke.soldTotal,
      goldTotal: this.poke.goldTotal, lastMatches: this.poke.lastMatches,
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
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.summaryLogged = false;
    this.applyOrConnect(true);
  }

  stopHunt() {
    this.logSummary();
    this.slug = null; this.sellIds.clear(); this.inv.clear();
    this.analyzer = null; this.recentKills = []; this.soldItems = [];
    if (!this.jobsActive()) this.teardown(); else this.refreshTimers();
  }

  // liga/atualiza o job de VENDA DE POKEMON (cfg null = desliga)
  setPokeSell(userId: string, tokens: Tokens, shard: number, cfg: PokeSellConfig, onTokens: (t: Tokens) => Promise<void>) {
    this.ctx(userId, tokens, shard, onTokens);
    this.pokeCfg = cfg;
    this.poke = { on: true, lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, lastMatches: [] };
    this.applyOrConnect(false);
  }

  stopPokeSell() {
    this.pokeCfg = null;
    this.poke = { on: false, lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, lastMatches: [] };
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
      void this.sellPokesSweep(m.list);
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
        if (this.soldItems.length > 40) this.soldItems.length = 40;
        if (this.userId && qtyTotal > 0) void logRobotEvent(this.userId, { kind: "item-sold", title: `Vendeu ${qtyTotal} itens`, body: `+$${Math.round(goldTotal)}`, data: { count: qtyTotal, gold: goldTotal } });
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingDrops = false; }
  }

  // vende os pokemon que batem as travas (REST). Nunca time/lider/starter/shiny (filterSellable).
  private async sellPokesSweep(list: unknown[]) {
    if (this.sellingPokes || !this.tokens || !this.pokeCfg) return;
    this.sellingPokes = true;
    try {
      const all = normalizeActivePokes(list);
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const matches = filterSellable(all, this.pokeCfg, rarityOf);
      this.poke.lastSweepAt = Date.now();
      this.poke.lastMatches = matches.slice(0, 60).map((p) => ({ id: p.id, name: p.name, speciesId: p.speciesId, level: p.level, shiny: p.shiny, ivTotal: p.ivTotal, quality: p.quality, sellValue: p.sellValue, rarity: p.rarity }));
      if (!matches.length) { this.poke.lastSold = 0; return; }
      const ids = matches.map((p) => p.id);
      const w = await sellPokes(this.tokens, ids);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (w.ok && w.data) {
        const sold = w.data.sold ?? ids.length, gold = w.data.goldGained ?? 0;
        this.poke.lastSold = sold; this.poke.soldTotal += sold; this.poke.goldTotal += gold;
        if (this.userId && sold > 0) void logRobotEvent(this.userId, { kind: "poke-sold", title: `Vendeu ${sold} pokemon`, body: `+$${Math.round(gold)}`, data: { count: sold, gold } });
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingPokes = false; }
  }

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
