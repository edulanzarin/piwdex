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
//   -> enter-hunt {slug} · leave-hunt · analyzer-get · pokes-get · pending-get
//   <- analyzer · field-kill · catch-result · inventory {items} · pokes {list} · pending {list}
//
// Singleton por processo (1 container long-lived). Uma conta por vez. Server-only.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { refreshTokens, type Tokens } from "./game-auth";
import {
  pickBestHunt, reconsiderHunt, buildLevelPlan, stepForLevel, getBrainData,
  type PlanStep, type FighterProfile,
} from "./hunt-brain";
import {
  saveRobotDesired, saveRobotStatus, getRobotDesired,
  type RobotMode, type LevelingGoal, type RobotDesired, type AnnounceCfg,
} from "./robot-session-store";
import { sellItems, sellPokes, fetchShop, buyBall, buyItem, fetchInventory } from "./game-shop";
import { readAuto } from "./game-auto";
import { getData } from "./data";
import { normalizeActivePokes, type ActivePoke } from "./game-account";
import { saveTeamSnapshot } from "./game-link";
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
// A venda de pokemon vende ASSIM QUE COLETA (a cada varredura de pokes que tenha match),
// igual a de drops — sem throttle de 1h. Sem alerta por venda (poluia o feed): o vendido
// aparece nos paineis "Itens/Pokemon vendidos" e no totalizador de Estatisticas.
// auto-compra de consumiveis: reabastece 1x/h as bolas da automacao quando ficam baixas.
const BUY_EVERY_MS = 60 * 60 * 1000;
const BALL_FLOOR = 100;   // abaixo disso, repoe
const BALL_TARGET = 500;  // repoe ate aqui (limitado pelo dinheiro)
// pocoes/revives sao mais caros que bola e gastam menos rapido (auto-potion so no HP baixo,
// auto-revive so quando desmaia) -> pisos/alvos menores pra nao drenar o ouro. Revive e o
// mais caro (ate 2500), entao alvo bem baixo. Sempre limitado pelo dinheiro na hora.
const POTION_FLOOR = 25;
const POTION_TARGET = 100;
const REVIVE_FLOOR = 5;
const REVIVE_TARGET = 20;
// reconexao automatica: enquanto o usuario QUER o robo ligado (desiredOn), a conexao que
// cai volta sozinha com backoff exponencial. Renova o access token antes de cada tentativa
// (token vencido = conexao recusada direto, sem o retry-em-401 do REST).
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;
// SESSAO CONTESTADA (single-session): o jogo so aceita 1 conexao por conta — a mais nova
// ganha. Se o robo e chutado LOGO depois de abrir (dentro da janela abaixo), foi outra
// sessao que roubou (quase sempre: o usuario entrou no jogo pelo navegador). O robo NAO
// cede: reconecta na hora pra reclamar a sessao (segurar ate o usuario desligar). A janela
// so serve pra distinguir "roubo" (reconecta rapido) de chute por rede (backoff normal).
const CONTESTED_MS = 25_000;   // conexao tem que durar isso pra "chute-rapido" nao contar
// chat do jogo: o snapshot da conexao traz o backlog (`history`) e as mensagens chegam
// na sessao que o robo ja segura. O formato exato dos frames de chat nao e documentado —
// o parser e TOLERANTE (varios nomes de campo) e o que nao casar cai num ring de frames
// desconhecidos exposto na UI (modo descoberta: da pra calibrar olhando o frame real).
const CHAT_MAX = 20;    // mensagens no ring: so as N ultimas ficam (a 21a derruba a mais velha)
const DEBUG_MAX = 30;   // frames desconhecidos no ring
const ANNOUNCE_MIN_MS = 60_000; // piso do intervalo do anuncio (= anti-flood do chat do jogo)
const CHAT_COOLDOWN_MS = 60_000; // anti-flood do chat do jogo (~1 msg/min) — barra no servidor
// frames que a sessao conhece (trata ou ignora de proposito) — o resto vira "descoberta"
const KNOWN_FRAMES = new Set([
  "analyzer", "field", "field-init", "field-kill", "poke-xp", "catch-result", "inventory",
  "pokes", "balls", "autohelper", "boosts", "mail-badge", "events", "shiny-global",
  "poke-summon", "trade", "badge-refresh", "hunt-config", "pending", "family",
]);

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
// um corpo na FILA DE CAPTURA (frame `pending` do jogo, confirmado por HAR ago/2026):
// o servidor reenvia a lista INTEIRA a cada mudanca — cresce a cada kill, drena conforme
// o auto-catch processa. `speciesId` no frame chama `pokeId` (numero da SPECIES, nao cuid).
export interface PendingCatch {
  id: number; speciesId: number; name: string; level: number; shiny: boolean;
  at: number; row: number; col: number;
}
export interface SoldPoke { id: string; name: string; speciesId: number; level: number; shiny: boolean; ivTotal: number; quality: number; sellValue: number; rarity: Rarity }
export type SessStatus = "idle" | "connecting" | "running" | "kicked" | "error";

// venda de pokemon agregada POR ESPECIE (o card mostra o bicho: icone+nome+raridade+qtd+valor):
// mesmo capturando o mesmo varias vezes na hunt, so soma a quantidade e o valor. Reseta ao
// trocar de hunt.
export interface SpeciesSold { speciesId: number; name: string; rarity: Rarity; count: number; gold: number }

export interface PokeSellSub { on: boolean; soldBySpecies: Record<number, SpeciesSold> }

// visao "hunt" (GET /api/vip/hunt + stream SSE) — o que a aba Hunt e o HUD leem
export interface HuntState {
  status: SessStatus; error?: string;
  slug: string | null; since: number | null; updatedAt: number | null;
  analyzer: Analyzer | null; recentKills: KillLog[]; soldItems: SoldItem[]; autoSellCount: number;
  pending: PendingCatch[];     // fila de captura AO VIVO (frame pending)
  pokeSellOn: boolean;
  // cerebro + reconexao (monitor fixo)
  mode: RobotMode;
  leveling: LevelingGoal | null;
  plan: PlanStep[] | null;
  desiredOn: boolean;          // usuario quer o robo rodando (religa sozinho)
  reconnecting: boolean;       // ha tentativa de reconexao agendada
  nextRetryAt: number | null;  // quando a proxima tentativa dispara
  contested: boolean;          // pausou porque a conta foi tomada (usuario entrou no jogo)
  fighterLevel: number | null; // nivel AO VIVO do pokemon que caca (frames do WS)
  // conexao-primeiro: o robo TOMA a sessao da conta e segura; hunt/venda sao jobs em cima
  holdOpen: boolean;           // usuario quer a conexao segurada (mesmo sem hunt)
  wsOpen: boolean;             // o socket esta aberto AGORA
  team: ActivePoke[] | null;   // time AO VIVO (frames pokes da sessao segurada)
  teamAt: number | null;
}
// visao "auto-sell" (GET /api/vip/autosell) — a aba Pokemon vendidos: status + o vendido
// agregado por especie (cards da hunt atual).
export interface AutoSellView { status: SessStatus; error?: string; soldBySpecies: SpeciesSold[] }

// chat do jogo (aba Chat + anuncio automatico). Formato REAL confirmado pelo modo
// descoberta (ago/2026): chat ao vivo = {type:"chat", msg:{id, channel, fromName, level,
// isAdmin, isTutor, isVip, body, at:ISO}}; backlog = {type:"history", world:[...],
// trade:[...], help:[...]} (um array POR CANAL, itens no mesmo shape do msg).
export interface ChatMsg {
  at: number; from: string; text: string; channel: string;
  id?: string;      // id do jogo (dedupe primario)
  mine?: boolean;   // mensagem SUA (append otimista no envio — o jogo nao ecoa pro remetente)
  level?: number; vip?: boolean; admin?: boolean;
}
export interface ChatView {
  wsOpen: boolean;
  messages: ChatMsg[];
  announce: AnnounceCfg | null;
  lastSentAt: number | null; // ultimo envio (manual ou anuncio) — a UI mostra "enviado"
  debugFrames: { at: number; type: string; raw: string }[]; // modo descoberta
}

class GameSession {
  // barramento de eventos pro stream SSE: emit("change", topic) a cada mudanca de estado.
  // topic "hunt" = analyzer/kills/vendas mudaram; "session" = status/modo/reconexao mudou.
  readonly bus = new EventEmitter();

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
  private pending: PendingCatch[] = []; // fila de captura ao vivo (frame pending)
  private soldItems: SoldItem[] = [];
  private poke: PokeSellSub = { on: false, soldBySpecies: {} };
  private recordedIds = new Set<string>(); // ids ja gravados no acervo (evita rescrever no banco)
  private gen = 0; // geracao do socket: invalida os handlers de um socket antigo no reconnect
  private baselineIds: Set<string> | null = null; // ids que voce JA tinha ao ligar (colecao antiga)
  // conexao NOVA pede refusao da base: o que apareceu na conta enquanto o robo esteve FORA
  // (ex: captura SUA no navegador, que rouba a sessao) nao e captura do robo. Sem isso, o
  // primeiro pokes apos reconectar jogava esses ids no acervo (bug do Yanma fantasma ago/2026).
  private rebaseline = false;
  // auto-compra de consumiveis (roda no proprio timer, REST — independe do WS de hunt/venda)
  private autoBuy = false;
  private buyTimer: ReturnType<typeof setInterval> | null = null;
  private buyTokens: Tokens | null = null;
  private buyUserId: string | null = null;
  private buyPersist: ((t: Tokens) => Promise<void>) | null = null;

  // cerebro (modo auto/leveling) + reconexao automatica
  private mode: RobotMode = "manual";
  private leveling: LevelingGoal | null = null;
  private plan: PlanStep[] | null = null;
  private fighter: FighterProfile | null = null; // perfil de combate do pokemon que caca
  private currentTargetId: number | null = null; // especie-alvo da hunt atual (pro reconsider)
  private thinking = false;                      // lock do cerebro (evita trocas concorrentes)
  private desiredOn = false;                     // usuario QUER o robo rodando -> reconecta sozinho
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private nextRetryAt: number | null = null;
  // sessao contestada (ver constantes acima): pausa em vez de brigar pela conexao
  private contested = false;
  private contestedStrikes = 0;
  private contestedSurvive: ReturnType<typeof setTimeout> | null = null;
  // conexao-primeiro: "ligar o robo" = tomar a sessao da conta e SEGURAR, mesmo sem hunt.
  // Hunt/venda viram jobs em cima da conexao viva; parar a hunt nao derruba a conexao.
  private holdOpen = false;
  private liveTeam: ActivePoke[] | null = null;  // time ao vivo (frames pokes)
  private liveTeamAt: number | null = null;
  private liveBox: ActivePoke[] | null = null;   // box ao vivo (fora do time) — so em memoria, fora do SSE

  // chat do jogo (ring) + anuncio automatico + frames desconhecidos (modo descoberta)
  private chatLog: ChatMsg[] = [];
  private chatSeenIds = new Set<string>();       // dedupe primario: id do jogo
  private chatSeenText = new Map<string, number>(); // dedupe secundario: from|text -> at (echo do envio otimista)
  private announce: AnnounceCfg | null = null;
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private lastSentAt: number | null = null;
  private selfName: string | null = null; // nome do jogador (casa o eco do envio)
  // envio aguardando veredito: o jogo ECOA a mensagem aceita (frame chat com seu nome) e
  // manda um frame de sistema SEM remetente quando recusa ("nao e permitida"). So o eco
  // confirma o envio — e so envio confirmado arma o cooldown.
  private pendingSend: { text: string; resolve: (r: "ok" | "rejected" | "timeout") => void } | null = null;
  private debugFrames: { at: number; type: string; raw: string }[] = [];

  private jobsActive() { return this.slug != null || this.pokeCfg != null || this.holdOpen; }

  private emit(topic: "hunt" | "session" | "chat") { try { this.bus.emit("change", topic); } catch { /* listener nao derruba a sessao */ } }

  // grava estado desejado/status observado — fire-and-forget (banco fora nao derruba o robo)
  private persistDesired(patch: Parameters<typeof saveRobotDesired>[1]) {
    if (this.userId) void saveRobotDesired(this.userId, patch).catch(() => {});
  }
  private setStatus(s: SessStatus, error?: string) {
    this.status = s; this.error = error;
    if (this.userId) void saveRobotStatus(this.userId, s, error ?? null).catch(() => {});
    this.emit("session");
  }

  getState(): HuntState {
    return {
      status: this.status, error: this.error, slug: this.slug, since: this.since, updatedAt: this.updatedAt,
      analyzer: this.analyzer, recentKills: this.recentKills.slice(0, 50), soldItems: this.soldItems.slice(0, 30),
      pending: this.pending, autoSellCount: this.sellIds.size, pokeSellOn: this.pokeCfg != null,
      mode: this.mode, leveling: this.leveling, plan: this.plan,
      desiredOn: this.desiredOn, reconnecting: this.reconnectTimer != null, nextRetryAt: this.nextRetryAt,
      contested: this.contested,
      fighterLevel: this.fighter?.level ?? null,
      holdOpen: this.holdOpen, wsOpen: this.ws != null && this.status === "running",
      team: this.liveTeam, teamAt: this.liveTeamAt,
    };
  }

  /** "Ligar o robo": TOMA a sessao da conta e segura (chuta o navegador do jogo). Nao
   *  liga hunt nenhuma — o time ao vivo, o summon e as vendas passam a operar nesta
   *  conexao; hunt/auto/leveling entram como jobs por cima. Se cair, religa sozinho. */
  connectSession(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>) {
    this.ctx(userId, tokens, shard, onTokens);
    this.clearContested(); // "Religar" apos ceder a sessao passa por aqui
    this.holdOpen = true;
    this.desiredOn = true;
    this.cancelReconnect();
    this.persistDesired({ enabled: true });
    if (!this.ws) this.connect(); else this.refreshTimers();
    this.emit("session");
  }

  /** "Desligar o robo": solta a sessao inteira (conexao + todos os jobs). */
  disconnectSession() {
    this.logSummary();
    this.leaveField(); // best-effort: avisa o jogo antes de fechar o socket
    this.holdOpen = false;
    this.desiredOn = false;
    this.cancelReconnect();
    this.slug = null; this.sellIds.clear(); this.pokeCfg = null; this.poke.on = false;
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.fighter = null;
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {};
    this.persistDesired({ enabled: false, mode: "manual", slug: null, pokeSellCfg: null, leveling: null });
    this.teardown();
  }

  getChatView(): ChatView {
    return {
      wsOpen: this.ws != null && this.status === "running",
      messages: this.chatLog.slice(-CHAT_MAX),
      announce: this.announce,
      lastSentAt: this.lastSentAt,
      debugFrames: this.debugFrames.slice(-DEBUG_MAX),
    };
  }

  /** Manda mensagem no chat e espera o VEREDITO do jogo (frame de envio confirmado por
   *  HAR: {"type":"send","channel","body"}). Mensagem aceita = o servidor ECOA de volta
   *  (frame chat com seu nome) — e o eco no feed. Recusada (conteudo proibido) = frame de
   *  sistema sem remetente. So envio CONFIRMADO arma o cooldown anti-flood (~1 msg/min):
   *  recusa nao gasta a janela — corrige o texto e manda de novo na hora. */
  async sendChat(text: string, channel: string, fromName?: string | null): Promise<{ ok: boolean; reason?: "not_live" | "cooldown" | "empty" | "busy" | "rejected" | "no_echo"; waitMs?: number }> {
    if (!this.ws || this.status !== "running") return { ok: false, reason: "not_live" };
    const t = text.trim();
    if (!t) return { ok: false, reason: "empty" };
    if (this.pendingSend) return { ok: false, reason: "busy" };
    const since = this.lastSentAt != null ? Date.now() - this.lastSentAt : Infinity;
    if (since < CHAT_COOLDOWN_MS) return { ok: false, reason: "cooldown", waitMs: CHAT_COOLDOWN_MS - since };
    if (fromName) this.selfName = fromName;

    this.send({ type: "send", channel, body: t });
    const verdict = await new Promise<"ok" | "rejected" | "timeout">((resolve) => {
      const timer = setTimeout(() => { this.pendingSend = null; resolve("timeout"); }, 6_000);
      this.pendingSend = {
        text: t,
        resolve: (r) => { clearTimeout(timer); this.pendingSend = null; resolve(r); },
      };
    });

    if (verdict === "ok") {
      this.lastSentAt = Date.now(); // cooldown so a partir de envio CONFIRMADO
      this.emit("chat");
      return { ok: true };
    }
    return { ok: false, reason: verdict === "rejected" ? "rejected" : "no_echo" };
  }

  // casa cada mensagem recebida com o envio pendente: eco com o SEU nome e o mesmo texto
  // confirma; frame de sistema (sem remetente) enquanto ha envio pendente = recusa.
  private checkPendingSend(msg: ChatMsg) {
    const p = this.pendingSend;
    if (!p) return;
    if (this.selfName && msg.from.toLowerCase() === this.selfName.toLowerCase() && msg.text === p.text) p.resolve("ok");
    else if (msg.from === "?") p.resolve("rejected");
  }

  /** Anuncio automatico: manda o texto no canal a cada N minutos enquanto conectado.
   *  Persistido (religa com a sessao no boot). cfg.on=false desliga. */
  setAnnounce(cfg: AnnounceCfg | null) {
    this.announce = cfg; // guarda mesmo desligado (a UI mantem o texto)
    if (this.announceTimer) { clearInterval(this.announceTimer); this.announceTimer = null; }
    if (cfg?.on && cfg.text.trim()) {
      const every = Math.max(ANNOUNCE_MIN_MS, Math.round(cfg.everySec * 1000));
      this.announceTimer = setInterval(() => {
        if (this.announce?.on) void this.sendChat(this.announce.text, this.announce.channel);
      }, every);
      void this.sendChat(cfg.text, cfg.channel); // primeiro envio na hora
    }
    this.persistDesired({ announce: cfg });
    this.emit("chat");
  }

  // ---- captura de chat (parser tolerante + modo descoberta) ----

  private static str(o: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v; }
    return null;
  }

  private parseChatMsg(o: Record<string, unknown>, fallbackChannel?: string): ChatMsg | null {
    const text = GameSession.str(o, ["body", "text", "message", "content"]);
    if (!text) return null;
    const from = GameSession.str(o, ["fromName", "from", "name", "player", "author", "sender", "playerName", "user", "username"]) ?? "?";
    const channel = GameSession.str(o, ["channel", "chan", "room"]) ?? fallbackChannel ?? "world";
    const raw = o.at ?? o.ts ?? o.time ?? o.createdAt ?? o.timestamp ?? o.date;
    let at = Date.now();
    if (typeof raw === "number" && Number.isFinite(raw)) at = raw < 1e12 ? raw * 1000 : raw; // s vs ms
    else if (typeof raw === "string") { const p = Date.parse(raw); if (Number.isFinite(p)) at = p; }
    const level = typeof o.level === "number" && Number.isFinite(o.level) ? o.level : undefined;
    return {
      at, from, text, channel, level,
      id: GameSession.str(o, ["id"]) ?? undefined,
      vip: o.isVip === true || undefined, admin: o.isAdmin === true || undefined,
    };
  }

  private pushChat(msg: ChatMsg) {
    this.checkPendingSend(msg); // veredito do envio pendente (antes do dedupe)
    // dedupe primario pelo id do jogo (history repete no reconnect)
    if (msg.id) {
      if (this.chatSeenIds.has(msg.id)) return false;
      this.chatSeenIds.add(msg.id);
      if (this.chatSeenIds.size > CHAT_MAX * 3) this.chatSeenIds.clear();
    }
    // dedupe secundario por conteudo numa janela de 60s: absorve o eco do envio otimista
    // (a mesma mensagem SUA entra local na hora e pode voltar do servidor com id)
    const key = `${msg.from}|${msg.text}`;
    const prev = this.chatSeenText.get(key);
    if (prev != null && Math.abs(msg.at - prev) < 60_000) return false;
    this.chatSeenText.set(key, msg.at);
    if (this.chatSeenText.size > CHAT_MAX * 3) this.chatSeenText.clear();

    this.chatLog.push(msg);
    this.chatLog.sort((a, b) => a.at - b.at);
    if (this.chatLog.length > CHAT_MAX) this.chatLog.splice(0, this.chatLog.length - CHAT_MAX);
    return true;
  }

  // frame de chat/history no formato real do jogo (ver comentario do ChatMsg):
  //   chat    -> mensagem unica aninhada em m.msg
  //   history -> um array POR CANAL (world/trade/help) com itens no mesmo shape
  // Mantem os fallbacks tolerantes (top-level, arrays com outros nomes) por robustez.
  private captureChat(m: Record<string, unknown>) {
    let got = false;
    // 1) chat ao vivo: {type:"chat", msg:{...}}
    if (m.msg && typeof m.msg === "object" && !Array.isArray(m.msg)) {
      const p = this.parseChatMsg(m.msg as Record<string, unknown>);
      if (p && this.pushChat(p)) got = true;
    }
    // 2) history/qualquer frame com arrays: varre TODAS as chaves que sao array — a chave
    //    (world/trade/help) vira o canal fallback dos itens
    for (const [key, val] of Object.entries(m)) {
      if (!Array.isArray(val)) continue;
      for (const o of val as Record<string, unknown>[]) {
        if (!o || typeof o !== "object") continue;
        const p = this.parseChatMsg(o, key);
        if (p && this.pushChat(p)) got = true;
      }
    }
    // 3) fallback: mensagem no top-level do frame
    if (!got) {
      const p = this.parseChatMsg(m);
      if (p && this.pushChat(p)) got = true;
    }
    if (got) this.emit("chat");
    else this.captureUnknown(m); // veio com cara de chat mas nao casou: vai pro descobridor
  }

  // frame que a sessao nao conhece: guarda truncado pro modo descoberta da aba Chat
  private captureUnknown(m: Record<string, unknown>) {
    let raw = "";
    try { raw = JSON.stringify(m).slice(0, 600); } catch { raw = String(m.type ?? "?"); }
    this.debugFrames.push({ at: Date.now(), type: String(m.type ?? "?"), raw });
    if (this.debugFrames.length > DEBUG_MAX) this.debugFrames.splice(0, this.debugFrames.length - DEBUG_MAX);
  }

  getAutoSellView(): AutoSellView {
    return {
      status: this.pokeCfg ? this.status : "idle", error: this.error,
      soldBySpecies: Object.values(this.poke.soldBySpecies),
    };
  }

  private ctx(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>) {
    this.userId = userId; this.tokens = tokens; this.shard = shard; this.onTokens = onTokens;
  }

  // corpo comum de "entrar numa hunt" (reinicia a acumulacao daquela caca)
  private beginHunt(userId: string, tokens: Tokens, shard: number, slug: string, sellItemIds: number[], onTokens: (t: Tokens) => Promise<void>) {
    this.logSummary(); // fecha o resumo da hunt anterior, se houve
    this.ctx(userId, tokens, shard, onTokens);
    this.slug = slug;
    this.sellIds = new Set(sellItemIds.filter((n) => Number.isInteger(n) && n > 0));
    this.inv.clear();
    // trocar de hunt zera o que foi vendido NA HUNT (itens e pokemon por raridade). O
    // totalizador cumulativo (robot_sales) NAO zera — vive no banco.
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {}; this.summaryLogged = false;
    this.pending = [];
    this.clearContested(); // acao do usuario (comecar hunt) religa se estava pausado
    this.desiredOn = true;
    this.holdOpen = true; // cacar implica conexao segurada: parar a hunt depois NAO derruba
    this.cancelReconnect();
    this.applyOrConnect(true);
    this.emit("hunt");
  }

  // liga/atualiza o job de HUNT em modo MANUAL (o usuario escolheu a hunt)
  setHunt(userId: string, tokens: Tokens, shard: number, slug: string, sellItemIds: number[], onTokens: (t: Tokens) => Promise<void>) {
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null;
    this.beginHunt(userId, tokens, shard, slug, sellItemIds, onTokens);
    this.persistDesired({ enabled: true, mode: "manual", slug, sellItemIds, leveling: null });
  }

  /** Modo AUTO: o cerebro escolhe a melhor hunt pro pokemon dado (lider) e vai. Re-escolhe
   *  sozinho a cada level-up (margem de 8%). Drops da especie-alvo entram pra venda. */
  async startAuto(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>, fighter: FighterProfile) {
    const pick = await pickBestHunt(fighter, true);
    if (!pick) return null;
    this.mode = "auto"; this.leveling = null; this.plan = null;
    this.fighter = fighter; this.currentTargetId = pick.target.pokeId;
    const sellIds = (await getBrainData()).sellableLoot(pick.target.pokeId);
    this.beginHunt(userId, tokens, shard, pick.target.slug, sellIds, onTokens);
    this.persistDesired({ enabled: true, mode: "auto", slug: pick.target.slug, sellItemIds: sellIds, leveling: null });
    if (this.userId) void logRobotEvent(this.userId, {
      kind: "brain", title: `Auto-hunt: ${pick.target.huntName}`,
      body: `${pick.target.name} · ~${Math.round(pick.est.xpH).toLocaleString("pt-BR")} XP/h`,
      data: { slug: pick.target.slug, targetId: pick.target.pokeId },
    });
    return pick;
  }

  /** Modo LEVELING: monta o plano do nivel atual ate `targetLevel` (buildRoute) e segue a
   *  sequencia sozinho, trocando de hunt quando o nivel entra na proxima faixa. */
  async startLeveling(
    userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>,
    fighter: FighterProfile, goal: { pokeId: string; name: string; targetLevel: number },
  ) {
    const plan = await buildLevelPlan(fighter, goal.targetLevel, true);
    if (!plan.length) return null;
    const step = stepForLevel(plan, fighter.level)!;
    this.mode = "leveling"; this.fighter = fighter; this.plan = plan; this.currentTargetId = step.targetId;
    this.leveling = {
      pokeId: goal.pokeId, speciesId: fighter.speciesId, name: goal.name,
      startLevel: fighter.level, targetLevel: goal.targetLevel, currentLevel: fighter.level, done: false,
    };
    const sellIds = (await getBrainData()).sellableLoot(step.targetId);
    this.beginHunt(userId, tokens, shard, step.slug, sellIds, onTokens);
    this.persistDesired({ enabled: true, mode: "leveling", slug: step.slug, sellItemIds: sellIds, leveling: this.leveling });
    if (this.userId) void logRobotEvent(this.userId, {
      kind: "brain", title: `Plano de leveling: ${goal.name} ${fighter.level} -> ${goal.targetLevel}`,
      body: `${plan.length} etapa${plan.length > 1 ? "s" : ""} · comeca em ${step.huntName}`,
      data: { targetLevel: goal.targetLevel, steps: plan.length },
    });
    return { plan, step };
  }

  /** Religa a sessao a partir do estado persistido (boot do container / instrumentation). */
  async resume(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>, d: RobotDesired, fighter: FighterProfile | null) {
    this.ctx(userId, tokens, shard, onTokens);
    this.mode = d.mode; this.leveling = d.leveling; this.fighter = fighter;
    if (d.pokeSellCfg) { this.pokeCfg = d.pokeSellCfg; this.poke.on = true; this.baselineIds = null; }
    if (d.autobuy) this.setAutoBuy(userId, tokens, true, onTokens);
    const data = await getBrainData();
    if (d.mode === "leveling" && d.leveling && !d.leveling.done && fighter) {
      fighter.level = Math.max(fighter.level, d.leveling.currentLevel);
      this.plan = await buildLevelPlan(fighter, d.leveling.targetLevel, true);
      const step = stepForLevel(this.plan, fighter.level);
      this.slug = step?.slug ?? d.slug;
      this.currentTargetId = step?.targetId ?? null;
      this.sellIds = new Set(step ? data.sellableLoot(step.targetId) : d.sellItemIds);
    } else if (d.mode === "auto" && fighter) {
      const pick = await pickBestHunt(fighter, true);
      this.slug = pick?.target.slug ?? d.slug;
      this.currentTargetId = pick?.target.pokeId ?? null;
      this.sellIds = new Set(pick ? data.sellableLoot(pick.target.pokeId) : d.sellItemIds);
    } else {
      this.slug = d.slug;
      this.sellIds = new Set(d.sellItemIds);
    }
    if (d.announce) this.setAnnounce(d.announce); // anuncio automatico religa junto
    this.holdOpen = true; // enabled persistido = conexao desejada (mesmo sem hunt)
    this.desiredOn = true;
    if (this.userId) void logRobotEvent(this.userId, {
      kind: "reconnect", title: "Robo retomado apos reinicio",
      body: this.slug ? `Hunt ${this.slug}` : null, data: { slug: this.slug },
    });
    this.applyOrConnect(true);
  }

  // para SO a hunt (e a venda atrelada a ela). Conexao-primeiro: se o usuario segura a
  // conexao (holdOpen), a sessao continua viva — time ao vivo, summon e religar a hunt
  // continuam instantaneos. Derrubar tudo e o disconnectSession().
  stopHunt() {
    this.logSummary();
    this.leaveField(); // sai do campo no servidor (a conexao segurada continua viva)
    this.slug = null; this.sellIds.clear(); this.inv.clear();
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {};
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.fighter = null;
    this.pokeCfg = null; this.poke.on = false;
    this.persistDesired({ enabled: this.holdOpen, mode: "manual", slug: null, pokeSellCfg: null, leveling: null });
    if (this.holdOpen) { this.refreshTimers(); this.emit("hunt"); this.emit("session"); return; }
    this.desiredOn = false;
    this.cancelReconnect();
    this.teardown();
  }

  // liga/atualiza o job de VENDA DE POKEMON (cfg null = desliga). NAO zera o vendido por
  // raridade (isso so zera ao trocar de hunt) — ligar/desligar preserva a contagem da hunt.
  setPokeSell(userId: string, tokens: Tokens, shard: number, cfg: PokeSellConfig, onTokens: (t: Tokens) => Promise<void>) {
    this.ctx(userId, tokens, shard, onTokens);
    this.pokeCfg = cfg;
    this.poke.on = true;
    this.baselineIds = null; // refaz a base: a conta atual nao entra no acervo, so novas capturas
    this.desiredOn = true;
    this.persistDesired({ enabled: true, pokeSellCfg: cfg });
    this.applyOrConnect(false);
  }

  stopPokeSell() {
    this.pokeCfg = null;
    this.poke.on = false;
    this.persistDesired({ pokeSellCfg: null });
    if (!this.jobsActive()) { this.desiredOn = false; this.cancelReconnect(); this.teardown(); } else this.refreshTimers();
  }

  stop() {
    this.logSummary();
    this.leaveField(); // best-effort: avisa o jogo antes de fechar o socket
    this.holdOpen = false;
    this.desiredOn = false; this.cancelReconnect();
    this.slug = null; this.sellIds.clear(); this.pokeCfg = null;
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.fighter = null;
    this.persistDesired({ enabled: false, mode: "manual", slug: null, pokeSellCfg: null, leveling: null });
    this.teardown();
  }

  // aplica a config: conecta se preciso; se ja conectado, so ajusta (sem derrubar)
  private applyOrConnect(reenter: boolean) {
    if (!this.ws) { this.connect(); return; }
    if (this.slug && reenter) this.enterHunt(this.slug);
    this.refreshTimers();
  }

  // Reaplica a automacao no campo VIVO sem reconectar: reenvia enter-hunt na MESMA conexao
  // pro jogo reler a autohelper (bola do auto-catch, bola shiny, pocao, bola selecionada).
  // Retorna true se havia hunt viva pra reaplicar.
  // ATENCAO: isso REGREDIU no jogo — a autohelper agora vem no SNAPSHOT da conexao e o
  // reenter nem sempre religa a config (bola trocada seguia a antiga). Pro caso critico
  // (config mudou com hunt viva) use bounceLive(), que garante a releitura.
  refreshHunt(): boolean {
    if (this.ws && this.slug) { this.enterHunt(this.slug); return true; }
    return false;
  }

  /** Reconecta a sessao VIVA na hora (bounce) pra o jogo reler a config do ZERO — a
   *  autohelper vem no snapshot da conexao, entao so uma conexao nova garante a bola
   *  certa. O rendimento atual e persistido ANTES (logSummary) porque o analyzer do
   *  jogo zera ao reconectar — os totais de Estatisticas nao perdem nada. Retorna true
   *  se havia sessao viva pra reciclar. */
  bounceLive(): boolean {
    if (!this.ws || !this.desiredOn) return false;
    this.logSummary(); // persiste o acumulado deste trecho (o analyzer vai zerar)
    const oldWs = this.ws;
    this.gen++;        // handlers do socket velho morrem (nao disparam onGone/reconnect)
    this.ws = null;
    this.clearTimers();
    try { oldWs.close(); } catch { /* ja caiu */ }
    this.analyzer = null;
    this.summaryLogged = false; // o proximo trecho gera o proprio resumo ao fechar
    this.connect();    // reabre AGORA (snapshot novo -> autohelper nova; enter-hunt no open)
    return true;
  }

  // Troca o pokemon ATIVO/LIDER (o que caca) na sessao VIVA: poke-summon na mesma conexao,
  // sem reconectar (single-session: abrir outro socket derrubaria a hunt). Pede pokes-get em
  // seguida pra a sessao reler o time e regravar o snapshot (Conta reflete o novo lider).
  // Retorna true se havia conexao viva. Sem conexao, o caller faz um one-shot (game-ws).
  summonActive(pokeId: string): boolean {
    if (this.ws && this.status === "running") {
      this.send({ type: "poke-summon", pokeId });
      setTimeout(() => this.send({ type: "pokes-get" }), 500);
      return true;
    }
    return false;
  }

  /** Move um poke BOX <-> TIME na sessao VIVA (poke-store guarda, poke-withdraw tira do
   *  box — HAR ago/2026). Mesmo desenho do summonActive: manda na conexao segurada e pede
   *  pokes-get pra o time ao vivo/snapshot refletirem. Retorna true se havia sessao viva;
   *  sem sessao, o caller faz o one-shot (game-ws.movePokeOneShot). MUTA a conta. */
  movePoke(pokeId: string, dir: "store" | "withdraw"): boolean {
    if (this.ws && this.status === "running") {
      this.send({ type: dir === "store" ? "poke-store" : "poke-withdraw", pokeId });
      setTimeout(() => this.send({ type: "pokes-get" }), 500);
      return true;
    }
    return false;
  }

  /** Box AO VIVO (pokes fora do time) da sessao segurada — null sem conexao. Alimenta o
   *  modal "tirar do box" sem entrar no HuntState (box pode ter centenas; nao vai no SSE). */
  getLiveBox(): ActivePoke[] | null {
    return this.ws && this.status === "running" ? this.liveBox : null;
  }

  private connect() {
    if (!this.tokens) return;
    this.setStatus("connecting");
    this.since = Date.now(); this.updatedAt = null;
    const url = `${WS_BASE}/ws${this.shard}?token=${encodeURIComponent(this.tokens.access)}&cmid=${crypto.randomBytes(16).toString("hex")}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, { headers: { Origin: "https://poke.idleworld.online", "User-Agent": UA } } as unknown as string[]);
    } catch (e) {
      this.setStatus("error", String(e));
      if (this.desiredOn && this.jobsActive()) this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    const myGen = ++this.gen; // handlers so valem enquanto este for o socket atual

    ws.addEventListener("open", () => {
      const wasRetry = this.reconnectAttempt > 0;
      this.rebaseline = true; // o 1o pokes desta conexao FUNDE na base (nao vira acervo)
      this.reconnectAttempt = 0; this.nextRetryAt = null;
      // arma a janela de "sobrevivencia": se a conexao durar CONTESTED_MS, o robo ganhou
      // a sessao e zera os strikes de contestacao. Se cair antes, o onGone conta o strike.
      if (this.contestedSurvive) clearTimeout(this.contestedSurvive);
      this.contestedSurvive = setTimeout(() => { this.contestedStrikes = 0; this.contestedSurvive = null; }, CONTESTED_MS);
      this.setStatus("running");
      if (wasRetry && this.userId) void logRobotEvent(this.userId, {
        kind: "reconnect", title: "Conexao restabelecida",
        body: this.slug ? `Hunt ${this.slug} retomada` : null, data: { slug: this.slug },
      });
      if (this.slug) this.enterHunt(this.slug);
      this.refreshTimers();
    });
    ws.addEventListener("message", (ev: MessageEvent) => { if (myGen === this.gen) this.onMessage(ev); });
    ws.addEventListener("close", (ev: unknown) => { if (myGen === this.gen) this.onGone("kicked", (ev as { code?: number } | undefined)?.code); });
    ws.addEventListener("error", () => { if (myGen === this.gen) this.onGone("error"); });
  }

  private send(obj: unknown) { try { this.ws?.send(JSON.stringify(obj)); } catch {} }

  // entra no campo IGUAL o cliente do jogo (HAR ago/2026): enter-hunt + pending-get logo
  // atras — o jogo so REENVIA a fila de captura quando ela muda, entao sem o pending-get
  // inicial a fila ficaria vazia ate o primeiro kill.
  private enterHunt(slug: string) {
    this.send({ type: "enter-hunt", slug });
    this.send({ type: "pending-get" });
  }

  // sai do campo DE VERDADE (leave-hunt, HAR ago/2026): sem esse frame, "parar a hunt"
  // mantendo a conexao segurada (holdOpen) deixava o char cacando no servidor — o campo
  // so morria quando a conexao inteira caia. Chamar ANTES de zerar this.slug.
  private leaveField() {
    if (this.ws && this.slug) this.send({ type: "leave-hunt" });
    this.pending = [];
  }

  private refreshTimers() {
    if (this.analyzerPoll) { clearInterval(this.analyzerPoll); this.analyzerPoll = null; }
    if (this.pokesPoll) { clearInterval(this.pokesPoll); this.pokesPoll = null; }
    if (this.dropTimer) { clearInterval(this.dropTimer); this.dropTimer = null; }
    if (this.slug) {
      this.send({ type: "analyzer-get" });
      this.analyzerPoll = setInterval(() => this.send({ type: "analyzer-get" }), ANALYZER_MS);
    }
    // pokes-get roda SEMPRE que ha conexao (nao so com venda ligada): alimenta o time AO
    // VIVO (HUD/painel), o acervo de capturados (recordKept, que roda com ou sem venda),
    // o fallback de nivel do cerebro e o keepalive. So sellPokesSweep exige pokeCfg.
    if (this.pokeCfg || this.slug || this.holdOpen) {
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
      this.emit("hunt");
    } else if (m.type === "field-kill") {
      if (!this.slug) return; // hunt desligada: ignora kills (o char ainda pode estar saindo do campo)
      const loot = Array.isArray(m.loot) ? (m.loot as Record<string, unknown>[]).map((l) => ({ itemId: Number(l.itemId ?? 0), name: String(l.name ?? ""), qty: Number(l.qty ?? 0) })) : [];
      this.push({ at: Date.now(), kind: "kill", species: String(m.speciesName ?? "?"), shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot });
      // nivel AO VIVO do lider (que e quem caca): alimenta o HUD e o cerebro
      this.trackLevel(Number(m.level), Boolean(m.leveledUp));
      this.emit("hunt");
    } else if (m.type === "poke-xp") {
      // XP por pokemon: no leveling, so interessa o pokemon do plano
      const id = String(m.id ?? "");
      if (!this.leveling || id === this.leveling.pokeId) this.trackLevel(Number(m.level), Boolean(m.leveledUp));
    } else if (m.type === "catch-result") {
      if (m.success && this.slug) {
        const species = String(m.speciesName ?? "?"), shiny = Boolean(m.shiny), ball = String(m.ballName ?? "");
        this.push({ at: Date.now(), kind: "catch", species, shiny, xp: 0, loot: [], ball });
        if (shiny && this.userId) void logRobotEvent(this.userId, { kind: "shiny", title: `Shiny ${species} capturado!`, body: ball || null, data: { species, ball } });
      }
    } else if (m.type === "pending" && Array.isArray(m.list)) {
      // fila de captura: o jogo reenvia a lista INTEIRA a cada mudanca. `pokeId` no frame
      // e o numero da SPECIES (nao cuid) — vira speciesId aqui pro sprite da UI.
      this.pending = (m.list as Record<string, unknown>[]).map((p) => ({
        id: Number(p.id ?? 0), speciesId: Number(p.pokeId ?? 0), name: String(p.name ?? "?"),
        level: Number(p.level ?? 0), shiny: Boolean(p.shiny),
        at: Number(p.at ?? Date.now()), row: Number(p.row ?? 0), col: Number(p.col ?? 0),
      }));
      this.emit("hunt");
    } else if (m.type === "inventory") {
      const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
      this.inv.clear();
      for (const it of items) this.inv.set(Number(it.itemId ?? 0), Number(it.quantity ?? it.qty ?? 0));
    } else if (m.type === "pokes" && Array.isArray(m.list)) {
      this.trackLiveTeam(m.list);       // time AO VIVO no estado (HUD/painel, sem banco)
      void this.updateTeamSnapshot(m.list); // Conta reflete o time ao vivo (lider incluso)
      this.trackLevelFromPokes(m.list); // fallback de nivel do cerebro (se poke-xp nao vier)
      void this.recordKept(m.list);   // acervo de capturados (real-time)
      void this.sellPokesSweep(m.list); // venda (assim que coleta)
    } else if (m.type === "history" || String(m.type ?? "").toLowerCase().includes("chat")) {
      this.captureChat(m); // backlog do snapshot + mensagens ao vivo
    } else if (!KNOWN_FRAMES.has(String(m.type ?? ""))) {
      this.captureUnknown(m); // modo descoberta: frame novo aparece na aba Chat
    }
  }

  private push(ev: KillLog) {
    this.recentKills.unshift(ev);
    if (this.recentKills.length > 50) this.recentKills.length = 50;
  }

  // ---- cerebro: nivel ao vivo + trocas de hunt automaticas (modo auto/leveling) ----

  // guarda o time AO VIVO no estado da sessao (o HUD e o painel leem direto do stream,
  // sem roundtrip no banco). Emite so quando algo visivel mudou (lider, nivel, hp, ordem).
  private trackLiveTeam(list: unknown[]) {
    try {
      const all = normalizeActivePokes(list);
      if (!all.length) return;
      const team = all.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
      const sig = team.map((p) => `${p.id}:${p.leader ? 1 : 0}:${p.level}:${p.hp}`).join("|");
      const prev = this.liveTeam?.map((p) => `${p.id}:${p.leader ? 1 : 0}:${p.level}:${p.hp}`).join("|");
      this.liveTeam = team;
      this.liveBox = all.filter((p) => !p.team); // box ao vivo (modal box<->time le daqui)
      this.liveTeamAt = Date.now();
      if (sig !== prev) this.emit("session");
    } catch { /* best-effort */ }
  }

  // fallback via lista de pokes (20s): se os frames de XP nao trouxerem level, a lista traz.
  private trackLevelFromPokes(list: unknown[]) {
    if (this.mode === "manual" || !this.fighter) return;
    try {
      const all = normalizeActivePokes(list);
      const target = this.leveling
        ? all.find((p) => p.id === this.leveling!.pokeId)
        : (all.find((p) => p.leader) ?? null);
      if (target && target.level > this.fighter.level) this.trackLevel(target.level, true);
    } catch { /* fallback e best-effort */ }
  }

  // registra o nivel observado nos frames do WS; num level-up, deixa o cerebro decidir.
  private trackLevel(level: number, leveledUp: boolean) {
    if (!Number.isFinite(level) || level <= 0) return;
    if (this.fighter && level !== this.fighter.level) { this.fighter.level = level; this.emit("session"); }
    if (this.leveling && level !== this.leveling.currentLevel) this.leveling.currentLevel = level;
    if (leveledUp && this.mode !== "manual") void this.onLevelUp(level);
  }

  private async onLevelUp(level: number) {
    if (this.thinking || !this.fighter || !this.userId) return;
    this.thinking = true;
    try {
      this.fighter.level = level;
      if (this.mode === "leveling" && this.leveling) {
        this.leveling.currentLevel = level;
        if (level >= this.leveling.targetLevel && !this.leveling.done) {
          // meta atingida: celebra e segue farmando em modo AUTO (nao para de render)
          this.leveling.done = true;
          void logRobotEvent(this.userId, {
            kind: "goal", title: `Meta atingida: ${this.leveling.name} chegou ao nivel ${level}!`,
            body: `Plano ${this.leveling.startLevel} -> ${this.leveling.targetLevel} concluido`,
            data: { level, pokeId: this.leveling.pokeId },
          });
          this.mode = "auto"; this.plan = null;
          this.persistDesired({ mode: "auto", leveling: this.leveling });
          // cai no bloco do modo auto abaixo (re-escolhe a hunt pro nivel atual)
        } else if (this.plan) {
          const step = stepForLevel(this.plan, level);
          if (step && step.slug !== this.slug) {
            await this.switchHunt(step.slug, step.targetId, `Plano: nivel ${level} entra na faixa ${step.from}-${step.to} (${step.huntName})`);
          }
          this.persistDesired({ leveling: this.leveling });
          this.emit("session");
          return;
        }
      }
      if (this.mode === "auto" && this.currentTargetId != null) {
        const better = await reconsiderHunt(this.fighter, this.currentTargetId, true);
        if (better) {
          await this.switchHunt(better.target.slug, better.target.pokeId,
            `Auto: ${better.target.huntName} rende mais no nivel ${level} (~${Math.round(better.est.xpH).toLocaleString("pt-BR")} XP/h)`);
        }
      }
      this.emit("session");
    } catch { /* cerebro nunca derruba a sessao */ } finally { this.thinking = false; }
  }

  // troca de hunt NA MESMA conexao (enter-hunt), atualizando alvo/drops. Mantem o feed de
  // kills (a sensacao e de continuidade); o analyzer zera porque e por-campo.
  private async switchHunt(slug: string, targetId: number, why: string) {
    this.logSummary(); // fecha o resumo da faixa anterior antes de trocar o slug
    this.slug = slug; this.currentTargetId = targetId;
    try { this.sellIds = new Set((await getBrainData()).sellableLoot(targetId)); } catch { /* mantem a lista atual */ }
    this.analyzer = null; this.summaryLogged = false; this.inv.clear(); this.pending = [];
    if (this.ws) { this.enterHunt(slug); this.refreshTimers(); }
    if (this.userId) void logRobotEvent(this.userId, { kind: "brain", title: `Robo trocou de hunt: ${slug}`, body: why, data: { slug, targetId } });
    this.persistDesired({ slug, sellItemIds: [...this.sellIds] });
    this.emit("hunt");
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
        // sem alerta por venda (poluia o feed): o vendido ja aparece em "Itens vendidos" e
        // no totalizador de Estatisticas. So acumula o totalizador cumulativo.
        if (this.userId && qtyTotal > 0) void addRobotSales(this.userId, { itemsCount: qtyTotal, itemsGold: goldTotal });
        this.emit("hunt");
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingDrops = false; }
  }

  // Uma VARREDURA de venda de pokemon: le a lista viva da conta, aplica as travas e vende
  // os que batem (REST). Nunca time/lider/starter/shiny (filterSellable). Vende ASSIM QUE
  // COLETA — roda a cada resposta de pokes-get (~20s) que tenha match, igual a venda de
  // drops. Sem throttle de 1h: assim o capturado nao fica em limbo (nem vendido nem no
  // acervo). O lock sellingPokes evita varreduras sobrepostas.
  private async sellPokesSweep(list: unknown[]) {
    if (this.sellingPokes || !this.tokens || !this.pokeCfg) return;
    this.sellingPokes = true;
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
        const sold = w.data.sold ?? 0, gold = w.data.goldGained ?? 0; // so conta o que o jogo CONFIRMOU
        if (sold > 0) {
          // agrega POR ESPECIE (os `sold` primeiros dos matches, ordenados do pior pro melhor)
          // — o card mostra o bicho (icone+nome+raridade), so quantidade e valor. E totalizador.
          for (const p of matches.slice(0, sold)) {
            const cur = this.poke.soldBySpecies[p.speciesId] ?? { speciesId: p.speciesId, name: p.name, rarity: p.rarity, count: 0, gold: 0 };
            cur.count += 1; cur.gold += p.sellValue;
            this.poke.soldBySpecies[p.speciesId] = cur;
          }
          // sem alerta por venda (o vendido aparece em "Pokemon vendidos" e em Estatisticas).
          if (this.userId) void addRobotSales(this.userId, { pokesCount: sold, pokesGold: gold });
          this.emit("hunt");
        }
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingPokes = false; }
  }

  // grava no acervo (captured_pokes) os pokemon MANTIDOS — os que NAO vao ser vendidos.
  // Com a venda ligada, mantido = nao bate as travas (bons demais, raridade nao marcada,
  // shiny, time/lider/starter); com a venda DESLIGADA, TODA captura nova e mantida — o
  // acervo nao depende da venda (senao capturado sem venda ficava invisivel: contava no
  // analyzer mas nao aparecia em lugar nenhum). Roda a cada lista de pokes (real-time,
  // sem throttle), so gravando ids novos (dedupe em memoria).
  private async recordKept(list: unknown[]) {
    if (!this.userId) return;
    try {
      const all = normalizeActivePokes(list);
      // A 1a lista NAO-VAZIA vira LINHA DE BASE (a colecao que voce JA tinha): nao entra no
      // acervo. So depois o robo grava o que capturar. Guard contra lista vazia/parcial: se
      // a base ficasse vazia, tudo viraria "novo" e a conta inteira entraria (bug do "voltou").
      if (this.baselineIds === null) {
        if (all.length) { this.baselineIds = new Set(all.map((p) => p.id)); this.rebaseline = false; }
        return;
      }
      // conexao nova: FUNDE na base o que apareceu com o robo fora (captura do navegador,
      // troca de conta, etc) — nao e captura do robo, nao entra no acervo. Consome a flag
      // no 1o pokes NAO-VAZIO da conexao; dali em diante id novo = captura do robo.
      if (this.rebaseline) {
        if (!all.length) return;
        for (const p of all) this.baselineIds.add(p.id);
        this.rebaseline = false;
        return;
      }
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const sellIds = this.pokeCfg
        ? new Set(filterSellable(all, this.pokeCfg, rarityOf).map((p) => p.id))
        : new Set<string>();
      // so o que o robo capturou nesta sessao: id NOVO (fora da base) + mantido (nao vai vender)
      const kept = all.filter((p) => !this.baselineIds!.has(p.id) && !sellIds.has(p.id) && !this.recordedIds.has(p.id));
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

  // depois que o usuario limpa o acervo (DELETE): esquece o cache e refaz a linha de base (a
  // proxima lista vira a base, entao a conta atual NAO volta pro acervo — so novas capturas).
  resetCapturedCache() { this.recordedIds.clear(); this.baselineIds = null; }

  // regrava o snapshot do time (game_links) a cada lista de pokes: enquanto o robo segura a
  // sessao, a Conta mostra o time AO VIVO (lider atual incluso) sem precisar reconectar.
  private async updateTeamSnapshot(list: unknown[]) {
    if (!this.userId) return;
    try {
      const all = normalizeActivePokes(list);
      if (!all.length) return;
      const team = all.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
      await saveTeamSnapshot(this.userId, team, all.length);
    } catch { /* snapshot e best-effort, nao derruba a sessao */ }
  }

  // liga/desliga a auto-compra de consumiveis. Roda no proprio timer (REST, nao precisa do WS).
  setAutoBuy(userId: string, tokens: Tokens, on: boolean, persist: (t: Tokens) => Promise<void>) {
    this.buyUserId = userId; this.buyTokens = tokens; this.buyPersist = persist;
    this.autoBuy = on;
    void saveRobotDesired(userId, { autobuy: on }).catch(() => {});
    if (this.buyTimer) { clearInterval(this.buyTimer); this.buyTimer = null; }
    if (on) {
      void this.restockSupplies();
      this.buyTimer = setInterval(() => void this.restockSupplies(), BUY_EVERY_MS);
    }
  }
  getAutoBuyOn() { return this.autoBuy; }

  // compra 1 lote de um item ate o alvo (se abaixo do piso), limitado pelo dinheiro. Devolve
  // o ouro restante. GASTA dolares do jogo — por isso loga cada compra. Compartilhado por
  // bolas (buyBall) e consumiveis (buyItem).
  private async buyUpTo(
    buy: (t: Tokens, id: number, qty: number) => Promise<import("./game-shop").WriteResult>,
    id: number, name: string, priceGold: number, have: number, floor: number, target: number, gold: number,
  ): Promise<number> {
    if (priceGold <= 0 || have >= floor) return gold;
    const qty = Math.min(target - have, Math.floor(gold / priceGold));
    if (qty <= 0) return gold;
    const w = await buy(this.buyTokens!, id, qty);
    if (w.changed) { this.buyTokens = w.tokens; await this.buyPersist?.(w.tokens); }
    if (!w.ok) return gold;
    const spent = qty * priceGold;
    if (this.buyUserId) void logRobotEvent(this.buyUserId, { kind: "item-bought", title: `Comprou ${qty} ${name}`, body: `-$${spent}`, data: { count: qty, gold: -spent } });
    return gold - spent;
  }

  // reabastece o que a automacao usa: as BOLAS (auto-catch, shiny, selecionada) e, se ligados,
  // a POCAO (auto-potion) e o REVIVE (auto-revive). Qual pocao/revive vem da escolha do usuario
  // (supply_cfg); null = "a melhor" (a mais forte que da pra comprar). Tudo abaixo do piso, ate
  // o alvo, limitado pelo dinheiro. GASTA dolares do jogo — opt-in, cada compra vira Alerta.
  private async restockSupplies() {
    if (!this.autoBuy || !this.buyTokens || !this.buyUserId) return;
    try {
      const a = await readAuto(this.buyTokens);
      if (!a || "unauth" in a) return;
      if (a.changed) { this.buyTokens = a.tokens; await this.buyPersist?.(a.tokens); }
      const shopRes = await fetchShop(this.buyTokens);
      if (!shopRes) return;
      if (shopRes.changed) { this.buyTokens = shopRes.tokens; await this.buyPersist?.(shopRes.tokens); }
      let gold = shopRes.shop.gold;

      // ---- BOLAS ----
      const ballCount = new Map(a.balls.map((b) => [b.id, b.count]));
      const wantBalls = [...new Set([a.auto.autoCatchBallId, a.auto.autoCatchShinyBallId, a.auto.selectedBallId].filter((id) => id > 0))];
      for (const id of wantBalls) {
        const shopBall = shopRes.shop.balls.find((b) => b.id === id);
        if (!shopBall) continue;
        gold = await this.buyUpTo(buyBall, id, shopBall.name, shopBall.priceGold, ballCount.get(id) ?? 0, BALL_FLOOR, BALL_TARGET, gold);
      }

      // ---- POCAO / REVIVE (so se a automacao correspondente esta ligada) ----
      if (!a.auto.autoPotion && !a.auto.autoRevive) return;
      const [data, invRes, desired] = await Promise.all([
        getData(),
        fetchInventory(this.buyTokens),
        getRobotDesired(this.buyUserId),
      ]);
      if (!invRes) return;
      if (invRes.changed) { this.buyTokens = invRes.tokens; await this.buyPersist?.(invRes.tokens); }
      const invCount = new Map(invRes.items.map((i) => [i.id, i.quantity]));
      const cfg = desired?.supplyCfg ?? null;

      // candidatos buyaveis de uma categoria (a categoria vem dos DADOS estaticos, o preco/
      // disponibilidade da LOJA), do mais forte (mais caro) pro mais fraco.
      const chooseId = (cat: string, prefer: number | null): { id: number; name: string; priceGold: number } | null => {
        const cands = shopRes.shop.items
          .filter((it) => it.priceGold > 0 && data.getItem(it.id)?.category === cat)
          .sort((x, y) => y.priceGold - x.priceGold);
        const pick = (prefer && cands.find((c) => c.id === prefer)) || cands[0];
        return pick ? { id: pick.id, name: pick.name, priceGold: pick.priceGold } : null;
      };

      if (a.auto.autoPotion) {
        const p = chooseId("heal", cfg?.potionId ?? null);
        if (p) gold = await this.buyUpTo(buyItem, p.id, p.name, p.priceGold, invCount.get(p.id) ?? 0, POTION_FLOOR, POTION_TARGET, gold);
      }
      if (a.auto.autoRevive) {
        const r = chooseId("revive", cfg?.reviveId ?? null);
        if (r) gold = await this.buyUpTo(buyItem, r.id, r.name, r.priceGold, invCount.get(r.id) ?? 0, REVIVE_FLOOR, REVIVE_TARGET, gold);
      }
    } catch { /* proxima hora tenta */ }
  }

  private logSummary() {
    if (this.summaryLogged || !this.userId) return;
    const a = this.analyzer;
    if (!a || a.kills <= 0) return;
    this.summaryLogged = true;
    const slug = this.slug ?? "";
    const userId = this.userId;
    void logRobotEvent(userId, { kind: "hunt-summary", title: `Hunt ${slug} — resumo`, body: `${a.kills} kills · ${a.captures} capturas · +$${Math.round(a.balance)}`, data: { slug, kills: a.kills, captures: a.captures, xp: a.xpGained, balance: a.balance } });
    // totalizador cumulativo (pra sempre) do que a hunt rendeu — alimenta o dashboard de
    // Estatisticas. Itens raros = soma da qtd dos drops marcados `rare` nos dados (resolve
    // pelo nome; cai pro itemId se o nome nao bater).
    void (async () => {
      let rareItems = 0;
      try {
        const data = await getData();
        for (const d of a.drops ?? []) {
          const it = data.getItemByName(d.name) ?? data.getItem(d.itemId);
          if (it?.rare) rareItems += d.qty;
        }
      } catch { /* raridade e best-effort; o resto do total nao depende dela */ }
      await addRobotSales(userId, { hunts: 1, kills: a.kills, captures: a.captures, xpGained: a.xpGained, lootItems: a.lootItems, lootGold: a.lootGold, supplyGold: a.supplyGold, rareItems });
    })();
  }

  private clearTimers() {
    for (const tmr of [this.analyzerPoll, this.pokesPoll, this.dropTimer]) if (tmr) clearInterval(tmr);
    this.analyzerPoll = this.pokesPoll = this.dropTimer = null;
  }

  // a conexao caiu (kicked/error). Mantem os jobs configurados e, se o usuario QUER o robo
  // ligado (desiredOn), religa sozinho com backoff — e o "manter a conexao pra farmar sozinho".
  // EXCECAO: sessao contestada (chutes-rapidos seguidos) -> CEDE e pausa, sem brigar.
  private onGone(status: SessStatus, code?: number) {
    this.clearTimers();
    this.ws = null;
    // "chute-rapido": abriu mas caiu antes de sobreviver a janela (survive timer ainda de pe).
    const quickKick = this.contestedSurvive != null;
    if (this.contestedSurvive) { clearTimeout(this.contestedSurvive); this.contestedSurvive = null; }
    if (this.status === "running" || this.status === "connecting") {
      this.logSummary();
      this.setStatus(status, code != null ? `close ${code}` : undefined);
    }
    if (!(this.desiredOn && this.jobsActive())) return;

    // Politica (pedido do Eduardo, ago/2026): o robo SEGURA a sessao e so a larga quando o
    // usuario DESLIGA (stop()). Ele NAO cede pro navegador. Se a conta foi tomada (chute-
    // rapido = outra sessao entrou, quase sempre o usuario abriu o jogo), reconecta NA HORA
    // pra reclamar a sessao — o jogo da a conta pra conexao mais nova. Quem quer jogar no
    // navegador desliga o robo antes (aviso fixado na UI). O antigo "ceder e pausar" saiu:
    // deixava o robo desligar sozinho sem o usuario saber. Backoff so pros chutes por rede.
    if (quickKick) this.reconnectAttempt = 0; // reclamar rapido, sem o backoff subir a toa
    this.scheduleReconnect();
  }

  // religa apos ceder a sessao (chamado pelas acoes do usuario: connect / comecar hunt)
  private clearContested() {
    this.contested = false;
    this.contestedStrikes = 0;
    if (this.contestedSurvive) { clearTimeout(this.contestedSurvive); this.contestedSurvive = null; }
  }

  private cancelReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.reconnectAttempt = 0; this.nextRetryAt = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt++;
    this.nextRetryAt = Date.now() + delay;
    this.emit("session");
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.tryReconnect(); }, delay);
  }

  private async tryReconnect() {
    if (!this.desiredOn || !this.jobsActive() || this.ws) return;
    // renova o access ANTES de reabrir: o WS nao tem o retry-em-401 do REST — token vencido
    // seria recusado direto e o backoff subiria a toa.
    if (this.tokens?.refresh) {
      try {
        const nt = await refreshTokens(this.tokens);
        if (nt) { this.tokens = nt; await this.onTokens?.(nt); }
      } catch { /* tenta com o token atual mesmo */ }
    }
    this.connect();
  }

  private teardown() {
    this.clearTimers();
    this.clearContested();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.inv.clear(); this.pending = [];
    this.since = null; this.updatedAt = null;
    this.setStatus("idle");
    this.emit("hunt");
  }
}

// singleton por processo (sobrevive entre requests no server long-lived).
// SESSION_REV: bump SEMPRE que a classe ganhar/mudar metodo — no dev, o hot-reload
// re-avalia o modulo mas a instancia antiga (prototype velho) fica presa no globalThis;
// sem o rev, chamar um metodo novo dava "is not a function" ate reiniciar o server.
const SESSION_REV = 14;
const g = globalThis as unknown as { __piwSession?: GameSession; __piwSessionRev?: number };
if (!g.__piwSession || g.__piwSessionRev !== SESSION_REV) {
  // silencia a instancia velha SEM persistir nada (stop() gravaria enabled=false no banco
  // e apagaria a intencao do usuario so por causa de um hot-reload)
  try {
    const old = g.__piwSession as unknown as Record<string, unknown> | undefined;
    if (old) {
      old.desiredOn = false; old.holdOpen = false;
      for (const k of ["analyzerPoll", "pokesPoll", "dropTimer", "buyTimer"]) {
        const t = old[k]; if (t) clearInterval(t as ReturnType<typeof setInterval>);
      }
      for (const k of ["reconnectTimer", "contestedSurvive"]) {
        const tm = old[k]; if (tm) clearTimeout(tm as ReturnType<typeof setTimeout>);
      }
      (old.ws as { close?: () => void } | null | undefined)?.close?.();
    }
  } catch { /* melhor um socket orfao no dev que derrubar o modulo */ }
  g.__piwSession = new GameSession();
  g.__piwSessionRev = SESSION_REV;
}
export const gameSession: GameSession = g.__piwSession;
