// Hunt Analyzer AO VIVO (server-side). O piwdex SEGURA uma sessao WS do jogo, entra na
// hunt e faz poll do analyzer que o servidor ja calcula. Single-session: enquanto o
// piwdex segura, o navegador do jogo fica em "conta em uso". O char farma server-side
// (idle) de qualquer jeito; segurar a sessao e so pra LER/registrar os numeros.
//
// Protocolo (ver scripts/ws-protocol.md, verificado contra a conta real):
//   ->  {"type":"enter-hunt","slug":"<hunt>"}   entra no campo (dispara field/analyzer)
//   ->  {"type":"analyzer-get"}                  pede o analyzer (poll ~5s)
//   <-  {"type":"analyzer", kills, xpGained, lootGold, supplyGold, balance, ...}
//   <-  {"type":"field-kill", xpGained, loot:[...], speciesName, shiny}  (log de kills)
//
// Singleton por processo (o piwdex roda 1 container long-lived; global sobrevive entre
// requests). Uma conta por vez — combina com o uso real. Server-only.

import crypto from "node:crypto";
import type { Tokens } from "./game-auth";

const WS_BASE = (process.env.GAME_HOST || "https://poke.idleworld.online").replace(/^http/, "ws");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const POLL_MS = 2000;

export interface Analyzer {
  kills: number; seconds: number; xpGained: number;
  lootItems: number; lootGold: number;
  ballsUsed: number; potionsUsed: number; supplyGold: number;
  captures: number; shinyCaptures: number; capturesGold: number;
  balance: number; goldPerHour: number; xpPerHour: number; killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
export interface KillLog { at: number; species: string; shiny: boolean; xp: number; loot: { itemId: number; name: string; qty: number }[] }
export type HuntStatus = "idle" | "connecting" | "running" | "kicked" | "error";
export interface HuntState {
  status: HuntStatus;
  slug: string | null;
  since: number | null; // quando o piwdex começou a segurar
  updatedAt: number | null;
  analyzer: Analyzer | null;
  recentKills: KillLog[]; // últimos kills capturados ao vivo (cap 50)
  error?: string;
}

class HuntSession {
  private ws: WebSocket | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private state: HuntState = { status: "idle", slug: null, since: null, updatedAt: null, analyzer: null, recentKills: [] };

  getState(): HuntState {
    return { ...this.state, recentKills: this.state.recentKills.slice(0, 50) };
  }

  start(tokens: Tokens, shard: number, slug: string) {
    this.stop(); // uma sessao por vez
    this.state = { status: "connecting", slug, since: Date.now(), updatedAt: null, analyzer: null, recentKills: [] };
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
        this.state.recentKills.unshift({ at: Date.now(), species: String(k.speciesName ?? "?"), shiny: Boolean(k.shiny), xp: Number(k.xpGained ?? 0), loot });
        if (this.state.recentKills.length > 50) this.state.recentKills.length = 50;
      }
    });

    ws.addEventListener("close", () => { this.onGone("kicked"); });
    ws.addEventListener("error", () => { this.onGone("error"); });
    return this.getState();
  }

  private onGone(status: HuntStatus) {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    this.ws = null;
    if (this.state.status === "running" || this.state.status === "connecting") {
      this.state = { ...this.state, status }; // mantem o ultimo analyzer pra mostrar "caiu, ultima leitura X"
    }
  }

  stop() {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.state = { status: "idle", slug: null, since: null, updatedAt: null, analyzer: null, recentKills: [] };
  }
}

// singleton por processo (sobrevive entre requests no server long-lived)
const g = globalThis as unknown as { __piwHunt?: HuntSession };
export const huntSession: HuntSession = g.__piwHunt ?? (g.__piwHunt = new HuntSession());
