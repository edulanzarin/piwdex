// Venda automatica 24/7 (server-side). O piwdex SEGURA uma sessao WS do jogo e, a cada
// ciclo, pede a lista viva (`pokes-get`), aplica as travas (poke-sell) e VENDE o que bate
// via REST (sellPokes). Single-session: enquanto o piwdex segura, o navegador do jogo fica
// em "conta em uso" (o char farma idle sozinho de qualquer jeito). Venda e IRREVERSIVEL —
// o guarda-costas de time/lider/starter/shiny mora no filterSellable e roda sempre.
//
// Protocolo (ver scripts/ws-protocol.md):
//   ->  {"type":"pokes-get"}              pede a lista atual
//   <-  {"type":"pokes","list":[...]}     a colecao viva (com IV/quality/shiny por individuo)
//
// Singleton por processo (o piwdex roda 1 container long-lived). Uma conta por vez, e
// MUTUAMENTE EXCLUSIVO com o Hunt Analyzer (os dois seguram o WS — o segundo kicka o
// primeiro). Quem liga um, para o outro (feito nas rotas). Server-only.

import crypto from "node:crypto";
import type { Tokens } from "./game-auth";
import { normalizeActivePokes } from "./game-account";
import { sellPokes } from "./game-shop";
import { getData } from "./data";
import { filterSellable, type PokeSellConfig } from "./poke-sell";
import type { Rarity } from "./types";

const WS_BASE = (process.env.GAME_HOST || "https://poke.idleworld.online").replace(/^http/, "ws");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SWEEP_MS = 60_000; // varre a lista e vende a cada 60s

export type AutoSellStatus = "idle" | "connecting" | "running" | "kicked" | "error";
export interface AutoSellState {
  status: AutoSellStatus;
  since: number | null; // quando ligou
  lastSweepAt: number | null; // ultima varredura concluida
  lastSold: number; // vendidos na ultima varredura
  soldTotal: number; // acumulado desde que ligou
  goldTotal: number; // ouro acumulado desde que ligou
  config: PokeSellConfig | null;
  error?: string;
}

class AutoSellSession {
  private ws: WebSocket | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;
  private tokens: Tokens | null = null;
  private cfg: PokeSellConfig | null = null;
  private onTokens: ((t: Tokens) => Promise<void>) | null = null;
  private state: AutoSellState = { status: "idle", since: null, lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, config: null };

  getState(): AutoSellState {
    return { ...this.state };
  }

  start(tokens: Tokens, shard: number, cfg: PokeSellConfig, onTokens: (t: Tokens) => Promise<void>) {
    this.stop(); // uma sessao por vez
    this.tokens = tokens;
    this.cfg = cfg;
    this.onTokens = onTokens;
    this.state = { status: "connecting", since: Date.now(), lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, config: cfg };

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
      this.state.status = "running";
      const ask = () => { try { ws.send(JSON.stringify({ type: "pokes-get" })); } catch {} };
      setTimeout(ask, 1500); // primeira varredura logo apos conectar
      this.poll = setInterval(ask, SWEEP_MS);
    });

    ws.addEventListener("message", (ev: MessageEvent) => {
      let m: { type?: string; list?: unknown };
      try { m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
      if (m.type === "pokes" && Array.isArray(m.list)) void this.sweep(m.list);
    });

    ws.addEventListener("close", () => this.onGone("kicked"));
    ws.addEventListener("error", () => this.onGone("error"));
    return this.getState();
  }

  // Uma varredura: filtra a lista viva pelas travas e vende o que bate (REST). Nunca
  // roda duas ao mesmo tempo (a venda e async e o poll pode reentrar).
  private async sweep(list: unknown[]) {
    if (this.sweeping || !this.tokens || !this.cfg) return;
    this.sweeping = true;
    try {
      const all = normalizeActivePokes(list);
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const matches = filterSellable(all, this.cfg, rarityOf);
      this.state.lastSweepAt = Date.now();
      if (!matches.length) { this.state.lastSold = 0; return; }

      const ids = matches.map((p) => p.id);
      const w = await sellPokes(this.tokens, ids);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (w.ok && w.data) {
        this.state.lastSold = w.data.sold ?? ids.length;
        this.state.soldTotal += this.state.lastSold;
        this.state.goldTotal += w.data.goldGained ?? 0;
      }
    } catch {
      // um erro de varredura nao derruba o robo — a proxima tenta de novo
    } finally {
      this.sweeping = false;
    }
  }

  private onGone(status: AutoSellStatus) {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    this.ws = null;
    if (this.state.status === "running" || this.state.status === "connecting") {
      this.state = { ...this.state, status }; // mantem os totais pra mostrar "caiu, vendeu X ate aqui"
    }
  }

  stop() {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.tokens = null;
    this.cfg = null;
    this.onTokens = null;
    this.state = { status: "idle", since: null, lastSweepAt: null, lastSold: 0, soldTotal: 0, goldTotal: 0, config: null };
  }
}

// singleton por processo (sobrevive entre requests no server long-lived)
const g = globalThis as unknown as { __piwAutoSell?: AutoSellSession };
export const autoSellSession: AutoSellSession = g.__piwAutoSell ?? (g.__piwAutoSell = new AutoSellSession());
