"use client";

// Provider de dados AO VIVO da area VIP: UMA conexao SSE (/api/vip/stream) alimenta todos
// os paineis — matou os 8 setInterval que cada painel fazia e o F5 de Desejos/Alertas.
// O EventSource reconecta sozinho; o estado `link` diz se o stream esta de pe (HUD mostra).
// Tipos aqui sao ESPELHOS client-side dos do servidor (game-hunt-session/hunt-brain sao
// server-only: importam node:crypto/pg — nao podem entrar no bundle do client).

import { createContext, useContext, useEffect, useRef, useState } from "react";

// ---- espelhos dos tipos do servidor ----

export interface LiveAnalyzer {
  kills: number; seconds: number; xpGained: number;
  lootItems: number; lootGold: number;
  ballsUsed: number; potionsUsed: number; supplyGold: number;
  captures: number; shinyCaptures: number; capturesGold: number;
  balance: number; goldPerHour: number; xpPerHour: number; killsPerHour: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
export interface LiveKill {
  at: number; kind: "kill" | "catch"; species: string; shiny: boolean;
  xp: number; loot: { itemId: number; name: string; qty: number }[]; ball?: string;
}
export interface LiveSoldItem { itemId: number; name: string; qty: number; gold: number; at: number }
// um corpo na fila de captura (frame pending da sessao — cresce no kill, drena na captura)
export interface LivePending {
  id: number; speciesId: number; name: string; level: number; shiny: boolean;
  at: number; row: number; col: number;
}
export type LiveStatus = "idle" | "connecting" | "running" | "kicked" | "error";
export type LiveMode = "manual" | "auto" | "leveling";

export interface LivePlanStep {
  from: number; to: number; slug: string; huntName: string; area: string;
  targetId: number; targetName: string; xpH: number; goldH: number; kosH: number;
}
export interface LiveLeveling {
  pokeId: string; speciesId: number; name: string;
  startLevel: number; targetLevel: number; currentLevel: number; done: boolean;
}

export interface LiveHunt {
  status: LiveStatus; error?: string;
  slug: string | null; since: number | null; updatedAt: number | null;
  analyzer: LiveAnalyzer | null; recentKills: LiveKill[]; soldItems: LiveSoldItem[];
  pending: LivePending[];
  autoSellCount: number; pokeSellOn: boolean;
  mode: LiveMode; leveling: LiveLeveling | null; plan: LivePlanStep[] | null;
  desiredOn: boolean; reconnecting: boolean; nextRetryAt: number | null;
  fighterLevel: number | null;
  // conexao-primeiro: o robo segura a sessao; hunt/venda sao jobs em cima
  holdOpen: boolean;
  wsOpen: boolean;
  team: LiveTeamPoke[] | null;
  teamAt: number | null;
}

export interface LiveSpeciesSold { speciesId: number; name: string; rarity: string; count: number; gold: number }
export interface LiveAutoSell { status: LiveStatus; error?: string; soldBySpecies: LiveSpeciesSold[] }

export interface LiveBall { id: number; name: string; count: number; iconUrl?: string; infinite?: boolean }
export interface LiveTeamPoke {
  id: string; speciesId: number; name: string; level: number; shiny: boolean;
  team: boolean; slot: number; leader: boolean; starter: boolean;
  sellValue: number; ivTotal: number; quality: number; power: number; type1: string;
  hp: number; maxHp: number;
  stats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number };
}
// conta do jogo (payload do /api/collection — tipado no que a UI usa; o resto passa junto)
export interface LiveAccount {
  connected: boolean;
  reason?: "expired";
  error?: string;
  account?: {
    profile: {
      name: string; level: number; xp: number; xpInLevel: number; xpForNext: number;
      gold: number; diamonds: number; catches: number; rank: number; totalPlayers: number;
      pokedexCount: number; pokedexTotal: number; fishingSkill: number; createdAt: string;
    };
    trainer: Record<string, unknown> & { vip: boolean; clan: string | null };
    auto: Record<string, unknown>;
    streak: { available: number; totalKills: number; bonusExp: number; bonusLoot: number; bonusShiny: number };
    breeding: Record<string, unknown> & { unlocked: boolean; usedSlots: number; maxSlots: number };
    balls: LiveBall[];
    inventory: unknown[];
    depot: unknown[];
    depotMaxSlots: number;
  };
  team?: { list: LiveTeamPoke[]; total: number; at: string } | null;
}

export interface LiveEvent {
  id: string; kind: string; title: string; body: string | null;
  data: Record<string, unknown> | null; readAt: string | null; createdAt: string;
}
export interface LiveNotification {
  id: string; watchlistId: string | null; title: string; body: string | null;
  data: Record<string, unknown> | null; readAt: string | null; createdAt: string;
  [k: string]: unknown;
}

export interface LiveChatMsg {
  at: number; from: string; text: string; channel: string;
  id?: string; mine?: boolean;
  level?: number; vip?: boolean; admin?: boolean;
}
export interface LiveAnnounce { on: boolean; text: string; everyMin: number; channel: "world" | "trade" | "help" }
export interface LiveChat {
  wsOpen: boolean;
  messages: LiveChatMsg[];
  announce: LiveAnnounce | null;
  lastSentAt: number | null;
  debugFrames: { at: number; type: string; raw: string }[];
}

export interface LiveTotals {
  itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number;
  hunts: number; kills: number; captures: number; xpGained: number;
  lootItems: number; lootGold: number; supplyGold: number; rareItems: number;
  acervo: { total: number; shiny: number; byRarity: Record<string, number> };
}

export interface VipLive {
  /** o stream SSE esta de pe? (nao confundir com a conexao do ROBO com o jogo) */
  link: "connecting" | "open" | "down";
  hunt: LiveHunt | null;
  autosell: LiveAutoSell | null;
  account: LiveAccount | null;
  events: { events: LiveEvent[]; unread: number } | null;
  alerts: { notifications: LiveNotification[]; unread: number } | null;
  totals: LiveTotals | null;
  chat: LiveChat | null;
  /** aplica um HuntState devolvido por um POST na hora (sem esperar o proximo push) */
  applyHunt: (h: LiveHunt) => void;
  applyChat: (c: LiveChat) => void;
  /** zera o contador local de alertas/eventos (apos marcar lido) */
  applyAlerts: (a: { notifications: LiveNotification[]; unread: number }) => void;
  applyEvents: (e: { events: LiveEvent[]; unread: number }) => void;
}

const Ctx = createContext<VipLive | null>(null);

export function useVipLive(): VipLive {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVipLive fora do VipLiveProvider");
  return v;
}

export function VipLiveProvider({ children }: { children: React.ReactNode }) {
  const [link, setLink] = useState<VipLive["link"]>("connecting");
  const [hunt, setHunt] = useState<LiveHunt | null>(null);
  const [autosell, setAutosell] = useState<LiveAutoSell | null>(null);
  const [account, setAccount] = useState<LiveAccount | null>(null);
  const [events, setEvents] = useState<VipLive["events"]>(null);
  const [alerts, setAlerts] = useState<VipLive["alerts"]>(null);
  const [totals, setTotals] = useState<LiveTotals | null>(null);
  const [chat, setChat] = useState<LiveChat | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/vip/stream");
    esRef.current = es;

    const on = <T,>(ev: string, fn: (data: T) => void) =>
      es.addEventListener(ev, (e) => {
        try { fn(JSON.parse((e as MessageEvent).data) as T); } catch { /* frame invalido */ }
      });

    es.onopen = () => setLink("open");
    // o EventSource re-tenta sozinho; "down" e so o rotulo enquanto isso
    es.onerror = () => setLink(es.readyState === EventSource.CLOSED ? "down" : "connecting");

    on<LiveHunt>("hunt", setHunt);
    on<LiveAutoSell>("autosell", setAutosell);
    on<LiveAccount>("account", setAccount);
    on<{ events: LiveEvent[]; unread: number }>("events", setEvents);
    on<{ notifications: LiveNotification[]; unread: number }>("alerts", setAlerts);
    on<LiveTotals>("totals", setTotals);
    on<LiveChat>("chat", setChat);

    return () => { es.close(); esRef.current = null; };
  }, []);

  const value: VipLive = {
    link, hunt, autosell, account, events, alerts, totals, chat,
    applyHunt: setHunt, applyChat: setChat, applyAlerts: setAlerts, applyEvents: setEvents,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
