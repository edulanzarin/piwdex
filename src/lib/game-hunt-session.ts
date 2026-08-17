// Hunt Analyzer AO VIVO (server-side). O piwdex SEGURA uma sessao WS do jogo, entra na
// hunt e faz poll do analyzer que o servidor ja calcula. Single-session: enquanto o
// piwdex segura, o navegador do jogo fica em "conta em uso". O char farma server-side
// (idle) de qualquer jeito; segurar a sessao e so pra LER/registrar os numeros — e, se o
// jogador pediu, VENDER automaticamente os drops selecionados da hunt.
//
// Protocolo (ver scripts/ws-protocol.md, verificado contra a conta real):
//   ->  {"type":"enter-hunt","slug":"<hunt>"}   entra no campo (dispara field/analyzer)
//   ->  {"type":"analyzer-get"}                  pede o analyzer (poll ~2s)
//   <-  {"type":"analyzer", kills, xpGained, lootGold, supplyGold, balance, ...}
//   <-  {"type":"field-kill", xpGained, loot:[...], speciesName, shiny}  (log de kills)
//   <-  {"type":"catch-result", success, speciesName, ballName}          (captura)
//   <-  {"type":"inventory", items:[{itemId, quantity}]}                 (mochila, reenviada)
//
// Singleton por processo (o piwdex roda 1 container long-lived; global sobrevive entre
// requests). Uma conta por vez — combina com o uso real. Server-only.

import crypto from "node:crypto";
import type { Tokens } from "./game-auth";
import { sellItems } from "./game-shop";
import { getData } from "./data";

const WS_BASE = (process.env.GAME_HOST || "https://poke.idleworld.online").replace(/^http/, "ws");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const POLL_MS = 2000;
const SELL_MS = 30000; // varre a mochila e vende os drops selecionados a cada 30s

export interface Analyzer {
  kills: number; seconds: number; xpGained: number;
  lootItems: number; lootGold: number;
  ballsUsed: number; potionsUsed: number; supplyGold: number;
  captures: number; shinyCaptures: number; capturesGold: number;
  balance: number; goldPerHour: number; xpPerHour: number; killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
// Um evento da hunt ao vivo: um KILL (derrotou -> xp + loot) ou um CATCH (capturou com
// uma bola). Feed unico, ordenado por tempo. `at` e o horario (ms) de quando chegou.
export interface KillLog {
  at: number;
  kind: "kill" | "catch";
  species: string;
  shiny: boolean;
  xp: number; // kill
  loot: { itemId: number; name: string; qty: number }[]; // kill
  ball?: string; // catch: nome da bola usada
}
// Item que o robo vendeu automaticamente durante a hunt (acumulado, agrupado por item).
export interface SoldItem { itemId: number; name: string; qty: number; gold: number; at: number }
export type HuntStatus = "idle" | "connecting" | "running" | "kicked" | "error";
export interface HuntState {
  status: HuntStatus;
  slug: string | null;
  since: number | null; // quando o piwdex começou a segurar
  updatedAt: number | null;
  analyzer: Analyzer | null;
  recentKills: KillLog[]; // últimos eventos capturados ao vivo (cap 50)
  soldItems: SoldItem[]; // drops vendidos automaticamente nesta sessao
  autoSellCount: number; // quantos itemIds estao marcados pra venda automatica
  error?: string;
}

const freshState = (over: Partial<HuntState> = {}): HuntState => ({
  status: "idle", slug: null, since: null, updatedAt: null, analyzer: null,
  recentKills: [], soldItems: [], autoSellCount: 0, ...over,
});

class HuntSession {
  private ws: WebSocket | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private sellTimer: ReturnType<typeof setInterval> | null = null;
  private selling = false;
  private tokens: Tokens | null = null;
  private onTokens: ((t: Tokens) => Promise<void>) | null = null;
  private sellIds = new Set<number>(); // itemIds que o jogador marcou pra vender sozinho
  private inv = new Map<number, number>(); // mochila atual (itemId -> qtd), da ultima frame
  private state: HuntState = freshState();

  getState(): HuntState {
    return { ...this.state, recentKills: this.state.recentKills.slice(0, 50), soldItems: this.state.soldItems.slice(0, 40) };
  }

  // adiciona um evento (kill/catch) no topo do feed e limita a 50
  private push(ev: KillLog) {
    this.state.recentKills.unshift(ev);
    if (this.state.recentKills.length > 50) this.state.recentKills.length = 50;
  }

  start(tokens: Tokens, shard: number, slug: string, sellItemIds: number[], onTokens: (t: Tokens) => Promise<void>) {
    this.stop(); // uma sessao por vez
    this.tokens = tokens;
    this.onTokens = onTokens;
    this.sellIds = new Set(sellItemIds.filter((n) => Number.isInteger(n) && n > 0));
    this.inv.clear();
    this.state = freshState({ status: "connecting", slug, since: Date.now(), autoSellCount: this.sellIds.size });

    const url = `${WS_BASE}/ws${shard}?token=${encodeURIComponent(tokens.access)}&cmid=${crypto.randomBytes(16).toString("hex")}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, { headers: { Origin: "https://poke.idleworld.online", "User-Agent": UA } } as unknown as string[]);
    } catch (e) {
      this.state = { ...this.state, status: "error", error: String(e) };
      return this.getState();
    }
    this.ws = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "enter-hunt", slug }));
      this.state.status = "running";
      const ask = () => { try { ws.send(JSON.stringify({ type: "analyzer-get" })); } catch {} };
      setTimeout(ask, 1200);
      this.poll = setInterval(ask, POLL_MS);
      if (this.sellIds.size) this.sellTimer = setInterval(() => void this.sellDrops(), SELL_MS);
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
      if (m.type === "analyzer") {
        this.state.analyzer = m as unknown as Analyzer;
        this.state.updatedAt = Date.now();
      } else if (m.type === "field-kill") {
        const k = m as Record<string, unknown>;
        const loot = Array.isArray(k.loot) ? (k.loot as Record<string, unknown>[]).map((l) => ({ itemId: Number(l.itemId ?? 0), name: String(l.name ?? ""), qty: Number(l.qty ?? 0) })) : [];
        this.push({ at: Date.now(), kind: "kill", species: String(k.speciesName ?? "?"), shiny: Boolean(k.shiny), xp: Number(k.xpGained ?? 0), loot });
      } else if (m.type === "catch-result") {
        const k = m as Record<string, unknown>;
        if (k.success) {
          this.push({ at: Date.now(), kind: "catch", species: String(k.speciesName ?? "?"), shiny: Boolean(k.shiny), xp: 0, loot: [], ball: String(k.ballName ?? "") });
        }
      } else if (m.type === "inventory") {
        const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
        this.inv.clear();
        for (const it of items) this.inv.set(Number(it.itemId ?? 0), Number(it.quantity ?? it.qty ?? 0));
      }
    });

    ws.addEventListener("close", () => { this.onGone("kicked"); });
    ws.addEventListener("error", () => { this.onGone("error"); });
    return this.getState();
  }

  // vende (REST) os itens marcados que tem qtd na mochila; acumula em soldItems.
  private async sellDrops() {
    if (this.selling || !this.tokens || this.sellIds.size === 0) return;
    const toSell: { itemId: number; qty: number }[] = [];
    for (const id of this.sellIds) { const q = this.inv.get(id) ?? 0; if (q > 0) toSell.push({ itemId: id, qty: q }); }
    if (!toSell.length) return;
    this.selling = true;
    try {
      const w = await sellItems(this.tokens, toSell);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (w.ok) {
        const data = await getData();
        for (const s of toSell) {
          this.inv.set(s.itemId, 0); // vendido — evita revender antes da proxima frame
          const it = data.getItem(s.itemId);
          const gold = (it?.npcPrice ?? 0) * s.qty;
          const ex = this.state.soldItems.find((x) => x.itemId === s.itemId);
          if (ex) { ex.qty += s.qty; ex.gold += gold; ex.at = Date.now(); }
          else this.state.soldItems.unshift({ itemId: s.itemId, name: it?.name ?? `#${s.itemId}`, qty: s.qty, gold, at: Date.now() });
        }
        if (this.state.soldItems.length > 40) this.state.soldItems.length = 40;
      }
    } catch {
      // erro de venda nao derruba a hunt — a proxima varredura tenta de novo
    } finally {
      this.selling = false;
    }
  }

  private clearTimers() {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    if (this.sellTimer) { clearInterval(this.sellTimer); this.sellTimer = null; }
  }

  private onGone(status: HuntStatus) {
    this.clearTimers();
    this.ws = null;
    if (this.state.status === "running" || this.state.status === "connecting") {
      this.state = { ...this.state, status }; // mantem analyzer/soldItems pra mostrar "caiu, ate aqui X"
    }
  }

  stop() {
    this.clearTimers();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.tokens = null;
    this.onTokens = null;
    this.sellIds.clear();
    this.inv.clear();
    this.state = freshState();
  }
}

// singleton por processo (sobrevive entre requests no server long-lived)
const g = globalThis as unknown as { __piwHunt?: HuntSession };
export const huntSession: HuntSession = g.__piwHunt ?? (g.__piwHunt = new HuntSession());
