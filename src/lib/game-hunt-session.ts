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
//   -> enter-hunt {slug} · leave-hunt · analyzer-get · pokes-get · pending-get · joy-heal
//   <- analyzer · field-kill · catch-result · inventory {items} · pokes {list} · pending {list}
//      · joy-healed
//
// Singleton por processo (1 container long-lived). Uma conta por vez. Server-only.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { gameFetch, refreshTokens, refusalOf, type Refusal, type Tokens } from "./game-auth";
import {
  pickBestHunt, reconsiderHunt, buildLevelPlan, stepForLevel, getBrainData, fighterOf,
  type PlanStep, type FighterProfile, type Avoid,
} from "./hunt-brain";
import {
  saveRobotDesired, saveRobotStatus, getRobotDesired, MAX_GOALS,
  type RobotMode, type LevelingGoal, type QueuedGoal, type RobotDesired, type AnnounceCfg,
} from "./robot-session-store";
import { sellItems, sellPokes, fetchShop, buyBall, buyItem, fetchInventory, fetchLocks, gameErrorMsg } from "./game-shop";
import { readAuto, parseBalls } from "./game-auto";
import { getData } from "./data";
import { normalizeActivePokes, type ActivePoke } from "./game-account";
import { saveTeamSnapshot, getGameLink, markGameLinkBlocked } from "./game-link";
import { filterSellable, pokeSellOn, type PokeSellConfig } from "./poke-sell";
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
// auto-compra de consumiveis: varredura periodica + GATILHO ao vivo (frame `balls` do WS).
// A varredura de 1h era LENTA demais: uma hunt queima ~700 bolas/h, entao a conta passava
// a maior parte da hora com 0 bolas e o auto-catch do jogo travava a fila de captura.
const BUY_EVERY_MS = 10 * 60 * 1000; // varredura de seguranca (o gatilho ao vivo e o principal)
const BUY_TRIGGER_COOLDOWN_MS = 3 * 60 * 1000; // frame balls dispara no maximo 1 compra a cada 3min
const BALL_FLOOR = 150;   // abaixo disso, repoe
const BALL_TARGET = 1000; // repoe ate aqui (limitado pelo dinheiro) — bola e barata perto do ganho/h
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
// enfermeira Joy: pokemon desmaiado (hp 0) nao entra em campo, entao a hunt fica ligada
// sem matar nada. O robo passa na Joy sozinho (`joy-heal`) quando ve o LIDER desmaiado no
// frame `pokes`. Cooldown pra nao repetir o frame a cada varredura se a cura nao pegar
// (ex: o jogo exigir estar na cidade) — a confirmacao e o HP voltando, nao o ack.
const HEAL_COOLDOWN_MS = 60_000;
// DESMAIO EM CAMPO (bundle do jogo, ago/2026 — ver scripts/ws-protocol.md):
//   - o frame `field` (~2/s) traz heroHp/heroMaxHp/fainted/reviveInMs: e a fonte RAPIDA
//     de "caiu", contra os 20s do `pokes`;
//   - `field-revive` gasta um Revive da bolsa e levanta o lider SEM sair da hunt;
//   - sem Revive o jogo te devolve pra cidade quando o timer estoura, e la a Joy cura de
//     graca — mas `joy-heal` com o char EM CAMPO nao levanta ninguem (era por isso que o
//     robo "curava" e o pokemon continuava morto);
//   - com o lider desmaiado o jogo RECUSA entrar em hunt ("Cure-o com a Nurse Joy ou use
//     um Revive antes de ir cacar"), entao trocar de hunt em cima do corpo nao funciona.
const REVIVE_COOLDOWN_MS = 15_000; // anti-flood do field-revive (o `field` vem 2x/s)
const REVIVE_GRACE_MS = 8_000;     // sem levantar nesse tempo, sai do campo e vai pra Joy
const RECOVER_MAX_MS = 3 * 60_000; // curando ha tempo demais: avisa (1x por episodio)
// DESMAIO NAO E SO CURAR: se o bicho cai duas vezes no MESMO alvo, a hunt esta errada pra
// ele — o motor estima o dano que voce toma, mas estimativa erra e a realidade nao. O robo
// bane o alvo e troca, em vez de voltar pro mesmo bicho que acabou de mata-lo (o loop
// "morre -> Joy -> morre" que deixava o pokemon travado no mesmo nivel por horas). O ban
// caduca quando o pokemon ganha DANGER_FORGET_LEVELS niveis: ai a conta muda de figura.
const DEATHS_BEFORE_FLEE = 2;
const DANGER_FORGET_LEVELS = 10;
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
  "poke-summon", "trade", "badge-refresh", "hunt-config", "pending", "family", "joy-healed",
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
// `blocked` e um estado TERMINAL: o jogo recusou a conta e nenhuma tentativa muda isso.
// Diferente de `kicked`/`error`, que sao passageiros e pedem reconexao.
export type SessStatus = "idle" | "connecting" | "running" | "kicked" | "error" | "blocked";

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
  queue: QueuedGoal[];         // planos que comecam sozinhos quando o atual fecha
  desiredOn: boolean;          // usuario quer o robo rodando (religa sozinho)
  reconnecting: boolean;       // ha tentativa de reconexao agendada
  nextRetryAt: number | null;  // quando a proxima tentativa dispara
  contested: boolean;          // pausou porque a conta foi tomada (usuario entrou no jogo)
  // motivo cru da recusa do jogo (status 'blocked'); null nos demais estados
  blockedReason: string | null;
  fighterLevel: number | null; // nivel AO VIVO do pokemon que caca (frames do WS)
  // XP/h do POKEMON medido nesta sessao — grandeza diferente do XP/h do treinador,
  // que vive no analyzer. null = sem amostra ainda.
  pokeXpPerHour: number | null;
  // desmaio do lider: a hunt esta parada e o robo esta levantando o bicho (Revive/Joy)
  reviving: boolean;
  heroHp: number | null;       // vida do lider no campo (frame `field`, ~2/s)
  heroMaxHp: number | null;
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

// Campos ACUMULATIVOS do frame `analyzer` (o resto e taxa derivada, recalculada no delta).
const ANALYZER_SUMS = [
  "kills", "seconds", "xpGained", "lootItems", "lootGold", "ballsUsed", "potionsUsed",
  "supplyGold", "captures", "shinyCaptures", "capturesGold",
] as const;

// O analyzer do jogo e cumulativo por CONEXAO: subtrai a base pra sobrar so a hunt atual.
// Saldo e taxas sao RECALCULADOS (nao dao pra subtrair): saldo = loot + capturas - supply,
// taxa = total/horas do trecho.
function analyzerDelta(raw: Analyzer, base: Analyzer | null): Analyzer {
  if (!base) return raw;
  const out = { ...raw } as Analyzer;
  for (const k of ANALYZER_SUMS) out[k] = Math.max(0, (raw[k] ?? 0) - (base[k] ?? 0));
  out.balance = out.lootGold + out.capturesGold - out.supplyGold;
  const h = out.seconds / 3600;
  out.goldPerHour = h > 0 ? out.balance / h : 0;
  out.xpPerHour = h > 0 ? out.xpGained / h : 0;
  out.killsPerHour = h > 0 ? out.kills / h : 0;
  // drops tambem sao cumulativos, item a item: sobra so o que caiu depois da base
  const before = new Map((base.drops ?? []).map((d) => [d.itemId, d]));
  out.drops = (raw.drops ?? [])
    .map((d) => { const b = before.get(d.itemId); return b ? { ...d, qty: d.qty - b.qty, gold: d.gold - b.gold } : d; })
    .filter((d) => d.qty > 0);
  return out;
}

// o jogo zerou o analyzer por conta propria (reconexao): algum acumulado veio MENOR que a base
const analyzerZeroed = (raw: Analyzer, base: Analyzer) =>
  ANALYZER_SUMS.some((k) => (raw[k] ?? 0) < (base[k] ?? 0));

// Estado de quem NAO tem sessao carregada. E o que o motor devolve pra usuario que nao
// e dono: mesmo formato do getState(), tudo vazio. Sem ele a alternativa seria devolver
// null e espalhar checagem de nulo por toda a UI.
function idleHuntState(): HuntState {
  return {
    status: "idle", slug: null, since: null, updatedAt: null,
    analyzer: null, recentKills: [], soldItems: [], autoSellCount: 0,
    pending: [], pokeSellOn: false,
    mode: "manual", leveling: null, plan: null, queue: [],
    desiredOn: false, reconnecting: false, nextRetryAt: null, contested: false, blockedReason: null,
    fighterLevel: null, pokeXpPerHour: null, reviving: false, heroHp: null, heroMaxHp: null,
    holdOpen: false, wsOpen: false, team: null, teamAt: null,
  };
}

// Identidade da conta do jogo a partir do access token. Le o claim `sub` sem verificar
// assinatura: aqui o token nao esta sendo autenticado, so COMPARADO com o que ja esta
// carregado. Token ilegivel devolve null e o chamador trata como "nao sei" (conservador).
function gameAccountIdOf(tokens: Tokens): string | null {
  try {
    const payload = tokens.access.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof json.sub === "string" && json.sub ? json.sub : null;
  } catch {
    return null;
  }
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
  // pokemon que o JOGO recusou vender (400) e a lista viva nao explica — tipicamente
  // ANUNCIADO NO MERCADO (o frame `pokes` nao traz essa flag). Ignorados nas varreduras
  // ate a config de venda mudar (setPokeSell limpa), pra nao travarem o lote de novo.
  private pokeSellBlocked = new Set<string>();
  private summaryLogged = false;

  private userId: string | null = null;
  // Identidade da CONTA DO JOGO segurada (claim `sub` do JWT). O userId diz de quem e a
  // assinatura no piwdex; ESTE campo diz qual Poke Idle esta na ponta do socket. Sao
  // coisas diferentes: o mesmo assinante pode trocar de conta do jogo, e ai tudo que
  // passa pelo WS (chat inclusive) sairia pelo personagem velho.
  private gameAccountId: string | null = null;
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
  // O analyzer do JOGO e por CONEXAO, nao por hunt: `enter-hunt` NAO zera nada (so
  // reconectar zera). Trocar de hunt na sessao segurada (manual -> auto, ou o cerebro
  // trocando de faixa) deixava os numeros da hunt anterior colados na hunt nova — e o
  // logSummary ainda relancava o acumulado INTEIRO no totalizador (dupla contagem no
  // dashboard de Estatisticas). Bug do "liguei o auto e a hunt do Abra continuou",
  // ago/2026. Solucao: guarda uma BASE (o frame no marco zero da hunt) e o que a UI,
  // o logSummary e os totais veem e sempre o DELTA em cima dela.
  private analyzerBase: Analyzer | null = null;
  private analyzerRebase = false; // proximo frame vira a base (hunt nova comecou)
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
  private buying = false;                 // lock: varredura + gatilho ao vivo nao sobrepoem
  private wantedBallIds: number[] = [];   // bolas que a automacao usa (da ultima varredura) — gatilho ao vivo
  private lastBuyTriggerAt = 0;
  // falhas operacionais (venda/compra que nao rodou) viram Alerta — throttled por operacao
  // pra nao inundar o feed quando o jogo fica fora um tempo.
  private lastOpErrAt = new Map<string, number>();
  // itens com CADEADO do jogador: o jogo recusa vender (403) e UM travado derruba o lote
  // inteiro — a varredura de drops exclui. Cache de 5min (o cadeado muda raramente).
  private lockedItems = new Set<number>();
  private lockedItemsAt = 0;

  // cerebro (modo auto/leveling) + reconexao automatica
  private mode: RobotMode = "manual";
  private leveling: LevelingGoal | null = null;
  private plan: PlanStep[] | null = null;
  private fighter: FighterProfile | null = null; // perfil de combate do pokemon que caca
  // ritmo de XP do POKEMON medido na sessao (o do treinador vive no analyzer)
  private pokeXp: { id: string; since: number; gained: number; lastTotal: number | null } | null = null;
  private currentTargetId: number | null = null; // especie-alvo da hunt atual (pro reconsider)
  private thinking = false;                      // lock do cerebro (evita trocas concorrentes)
  private desiredOn = false;                     // usuario QUER o robo rodando -> reconecta sozinho
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private nextRetryAt: number | null = null;
  // sessao contestada (ver constantes acima): pausa em vez de brigar pela conexao
  private contested = false;
  // motivo da recusa do jogo (so com status 'blocked') — e a frase que o jogo respondeu
  private blockedReason: string | null = null;
  private contestedStrikes = 0;
  private contestedSurvive: ReturnType<typeof setTimeout> | null = null;
  // conexao-primeiro: "ligar o robo" = tomar a sessao da conta e SEGURAR, mesmo sem hunt.
  // Hunt/venda viram jobs em cima da conexao viva; parar a hunt nao derruba a conexao.
  private holdOpen = false;
  // FILA de planos: quando o plano corrente fecha, o proximo daqui comeca sozinho
  // (summon do bicho + rota nova). Ate MAX_GOALS no total, contando o que ja roda.
  private queue: QueuedGoal[] = [];
  // vida do LIDER em campo + episodio de desmaio (frame `field`)
  private heroHp = 0;
  private heroMaxHp = 0;
  private downSince: number | null = null;   // quando o lider caiu (null = de pe)
  private reviveSentAt = 0;                  // ultimo field-revive
  private owesEnter = false;                 // deve uma entrada em `slug` (esta fora do campo)
  private recoverWarned = false;             // ja avisou que a cura esta demorando
  private reviveIds: Set<number> | null = null; // itens de categoria "revive" (do catalogo)
  private reviveIdsVersion: string | null = null; // versao do catalogo que produziu o set acima
  private deaths = new Map<number, number>();  // alvo -> desmaios seguidos nele
  private banned = new Map<number, number>();  // alvo banido -> nivel do bicho quando caiu
  private healSentAt = 0;        // ultimo joy-heal enviado (anti-flood)
  private healPending = false;   // curou COM alguem caido e espera o HP voltar
  private healNoticed = false;   // ja avisou deste desmaio (1 alerta por episodio)
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

  // Tokens SEMPRE do banco antes de cada frente REST (venda de drops/pokemon, auto-compra).
  // TRES frentes renovam token no jogo (WS/reconnect, snapshots do SSE, auto-compra) e o
  // refresh ROTACIONA — a copia em memoria de uma frente ficava stale e cada venda/compra
  // dela morria num 401 silencioso ("vive falhando"). O banco tem sempre o ultimo token
  // persistido por qualquer frente; ler de la faz todas convergirem.
  private async syncTokens(): Promise<boolean> {
    if (this.userId) {
      try {
        const l = await getGameLink(this.userId);
        if (l && l.status !== "expired") { this.tokens = l.tokens; return true; }
      } catch { /* banco fora: tenta com o token em memoria */ }
    }
    return this.tokens != null;
  }

  // Falha operacional vira Alerta (kind "error") — no maximo 1 por operacao a cada 30min.
  // Antes toda falha caia num catch{} mudo e o usuario so via "nao vendeu/nao comprou".
  private logOpError(op: string, title: string, body: string | null) {
    const uid = this.userId ?? this.buyUserId;
    if (!uid) return;
    const last = this.lastOpErrAt.get(op) ?? 0;
    if (Date.now() - last < 30 * 60_000) return;
    this.lastOpErrAt.set(op, Date.now());
    void logRobotEvent(uid, { kind: "error", title, body, data: { op } });
  }

  getState(): HuntState {
    return {
      status: this.status, error: this.error, slug: this.slug, since: this.since, updatedAt: this.updatedAt,
      analyzer: this.analyzer, recentKills: this.recentKills.slice(0, 50), soldItems: this.soldItems.slice(0, 30),
      pending: this.pending, autoSellCount: this.sellIds.size, pokeSellOn: this.pokeCfg != null,
      mode: this.mode, leveling: this.leveling, plan: this.plan, queue: this.queue,
      desiredOn: this.desiredOn, reconnecting: this.reconnectTimer != null, nextRetryAt: this.nextRetryAt,
      contested: this.contested,
      blockedReason: this.blockedReason,
      fighterLevel: this.fighter?.level ?? null,
      pokeXpPerHour: this.pokeXpPerHour(),
      reviving: this.downSince != null || this.owesEnter,
      heroHp: this.heroMaxHp > 0 ? this.heroHp : null,
      heroMaxHp: this.heroMaxHp > 0 ? this.heroMaxHp : null,
      holdOpen: this.holdOpen, wsOpen: this.ws != null && this.status === "running",
      team: this.liveTeam, teamAt: this.liveTeamAt,
    };
  }

  // --- POSSE ---------------------------------------------------------------
  // Cada usuario tem a SUA instancia (ver o registro no fim do arquivo), entao ler a
  // sessao de outro deixou de ser possivel — nao ha referencia compartilhada. O que
  // sobra pra checar e a identidade DENTRO da instancia: ela so solta/serve a conta que
  // realmente carregou.

  /** Este usuario e o dono desta instancia? */
  ownedBy(userId: string | null | undefined): boolean {
    return !!userId && this.userId === userId;
  }

  /** Zera TUDO que pertence a conta carregada e que o disconnectSession preserva de
   *  proposito (time ao vivo, box, chat, anuncio, acervo ja gravado). Nao mexe em banco:
   *  quem chama decide o que persistir. */
  private wipeAccountState() {
    this.liveTeam = null; this.liveTeamAt = null; this.liveBox = null;
    this.chatLog = []; this.chatSeenIds.clear(); this.chatSeenText.clear();
    this.setAnnounce(null);
    this.recordedIds.clear(); this.baselineIds = null;
  }

  release(userId: string | null | undefined): boolean {
    if (!this.ownedBy(userId)) return false;
    const uid = this.userId!;
    this.disconnectSession();
    // auto-compra e um timer REST proprio (sobrevive ao disconnect de proposito): aqui
    // ela cai junto, senao o processo segue comprando na conta que acabou de ser solta.
    this.autoBuy = false;
    if (this.buyTimer) { clearInterval(this.buyTimer); this.buyTimer = null; }
    this.buyTokens = null; this.buyPersist = null;
    void saveRobotDesired(uid, { autobuy: false }).catch(() => {});
    this.userId = null; this.buyUserId = null; this.gameAccountId = null;
    this.tokens = null; this.onTokens = null; this.shard = 0;
    this.wipeAccountState();
    this.emit("session");
    return true;
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
    this.queue = [];
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {};
    // NAO apaga poke_sell_cfg: desligar o robo nao e "desligar a venda" — a config do
    // usuario sobrevive e religa junto com a proxima conexao/hunt.
    this.persistDesired({ enabled: false, mode: "manual", slug: null, leveling: null, levelingQueue: [] });
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

  // Comeco de hunt: o proximo frame do analyzer vira a BASE (o jogo segue contando do
  // trecho anterior). Ate ele chegar, a UI mostra "—" em vez dos numeros da hunt velha.
  private rebaseAnalyzer() {
    this.analyzerBase = null;
    this.analyzerRebase = true;
    this.analyzer = null;
  }

  private ctx(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>) {
    // TROCA DE CONTA: o socket vivo pertence a outra conta do jogo (ou a outro assinante).
    // Ele tem que MORRER antes do contexto novo entrar — reaproveitar a conexao fazia todo
    // comando seguir saindo pelo personagem anterior (o chat entregava com o nome velho).
    // A checagem mora aqui, no unico ponto por onde TODO caminho instala contexto
    // (connect, hunt, auto, leveling, venda, resume), em vez de em cada rota.
    const account = gameAccountIdOf(tokens);
    const switched =
      (account != null && this.gameAccountId != null && account !== this.gameAccountId) ||
      (this.userId != null && this.userId !== userId);
    if (switched) {
      this.teardown();
      this.wipeAccountState();
    }
    this.userId = userId; this.gameAccountId = account;
    this.tokens = tokens; this.shard = shard; this.onTokens = onTokens;
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
    this.rebaseAnalyzer();
    this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {}; this.summaryLogged = false;
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
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.queue = [];
    this.beginHunt(userId, tokens, shard, slug, sellItemIds, onTokens);
    this.persistDesired({ enabled: true, mode: "manual", slug, sellItemIds, leveling: null, levelingQueue: [] });
  }

  /** Modo AUTO: o cerebro escolhe a melhor hunt pro pokemon dado (lider) e vai. Re-escolhe
   *  sozinho a cada level-up (margem de 8%). Drops da especie-alvo entram pra venda. */
  async startAuto(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>, fighter: FighterProfile) {
    this.resetDangerIf(fighter);
    const pick = await pickBestHunt(fighter, true, this.avoidFor(fighter));
    if (!pick) return null;
    this.mode = "auto"; this.leveling = null; this.plan = null; this.queue = [];
    this.fighter = fighter; this.currentTargetId = pick.target.pokeId;
    const sellIds = (await getBrainData()).sellableLoot(pick.target.pokeId);
    this.beginHunt(userId, tokens, shard, pick.target.slug, sellIds, onTokens);
    this.persistDesired({ enabled: true, mode: "auto", slug: pick.target.slug, sellItemIds: sellIds, leveling: null, levelingQueue: [] });
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
    queue: QueuedGoal[] = [],
  ) {
    this.resetDangerIf(fighter);
    const plan = await buildLevelPlan(fighter, goal.targetLevel, true, this.avoidFor(fighter));
    if (!plan.length) return null;
    this.queue = queue.slice(0, MAX_GOALS - 1);
    const step = stepForLevel(plan, fighter.level)!;
    this.mode = "leveling"; this.fighter = fighter; this.plan = plan; this.currentTargetId = step.targetId;
    this.leveling = {
      pokeId: goal.pokeId, speciesId: fighter.speciesId, name: goal.name,
      startLevel: fighter.level, targetLevel: goal.targetLevel, currentLevel: fighter.level, done: false,
    };
    const sellIds = (await getBrainData()).sellableLoot(step.targetId);
    this.beginHunt(userId, tokens, shard, step.slug, sellIds, onTokens);
    this.persistDesired({ enabled: true, mode: "leveling", slug: step.slug, sellItemIds: sellIds, leveling: this.leveling, levelingQueue: this.queue });
    if (this.userId) void logRobotEvent(this.userId, {
      kind: "brain", title: `Plano de leveling: ${goal.name} ${fighter.level} -> ${goal.targetLevel}`,
      body: `${plan.length} etapa${plan.length > 1 ? "s" : ""} · comeca em ${step.huntName}`
        + (this.queue.length ? ` · +${this.queue.length} na fila` : ""),
      data: { targetLevel: goal.targetLevel, steps: plan.length, queued: this.queue.length },
    });
    return { plan, step };
  }

  /** Religa a sessao a partir do estado persistido (boot do container / instrumentation). */
  async resume(userId: string, tokens: Tokens, shard: number, onTokens: (t: Tokens) => Promise<void>, d: RobotDesired, fighter: FighterProfile | null) {
    this.ctx(userId, tokens, shard, onTokens);
    this.mode = d.mode; this.leveling = d.leveling; this.fighter = fighter;
    this.queue = d.mode === "leveling" ? d.levelingQueue : []; // a fila volta com o plano
    // config salva com on:false NAO religa a venda (as travas ficam guardadas, so isso)
    if (pokeSellOn(d.pokeSellCfg)) { this.pokeCfg = d.pokeSellCfg; this.poke.on = true; this.baselineIds = null; }
    if (d.autobuy) this.setAutoBuy(userId, tokens, true, onTokens);
    const data = await getBrainData();
    if (d.mode === "leveling" && d.leveling && !d.leveling.done && fighter) {
      fighter.level = Math.max(fighter.level, d.leveling.currentLevel);
      this.plan = await buildLevelPlan(fighter, d.leveling.targetLevel, true, this.avoidFor(fighter));
      const step = stepForLevel(this.plan, fighter.level);
      this.slug = step?.slug ?? d.slug;
      this.currentTargetId = step?.targetId ?? null;
      this.sellIds = new Set(step ? data.sellableLoot(step.targetId) : d.sellItemIds);
    } else if (d.mode === "auto" && fighter) {
      const pick = await pickBestHunt(fighter, true, this.avoidFor(fighter));
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
    // parar a hunt cancela a divida de entrada: nao ha pra onde voltar depois da cura
    this.owesEnter = false; this.downSince = null; this.healNoticed = false; this.recoverWarned = false;
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {};
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.fighter = null;
    this.queue = []; // parar a hunt cancela a fila (ela e da hunt, nao da conexao)
    // A VENDA DE POKEMON NAO MORRE AQUI: parar a hunt parava a venda e ainda APAGAVA a
    // config do banco — a proxima hunt nascia sem venda e tudo ia pro acervo (bug dos
    // uncommon vendaveis "mantidos", ago/2026). Com a conexao segurada a venda continua;
    // sem conexao, a config persiste e religa no proximo start.
    this.persistDesired({ enabled: this.holdOpen, mode: "manual", slug: null, leveling: null, levelingQueue: [] });
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
    this.pokeSellBlocked.clear(); // config nova = todo mundo re-testado (anuncio pode ter saido do mercado)
    this.poke.on = true;
    this.baselineIds = null; // refaz a base: a conta atual nao entra no acervo, so novas capturas
    this.desiredOn = true;
    this.persistDesired({ enabled: true, pokeSellCfg: { ...cfg, on: true } });
    this.applyOrConnect(false);
  }

  stopPokeSell() {
    const cfg = this.pokeCfg;
    this.pokeCfg = null;
    this.poke.on = false;
    // desligar NAO apaga as travas: grava on:false com a config preservada (religar nao
    // exige reconfigurar). Sem config em memoria, nao mexe no banco (a rota ja cuidou).
    if (cfg) this.persistDesired({ pokeSellCfg: { ...cfg, on: false } });
    if (!this.jobsActive()) { this.desiredOn = false; this.cancelReconnect(); this.teardown(); } else this.refreshTimers();
  }

  stop() {
    this.logSummary();
    this.leaveField(); // best-effort: avisa o jogo antes de fechar o socket
    this.holdOpen = false;
    this.desiredOn = false; this.cancelReconnect();
    this.slug = null; this.sellIds.clear(); this.pokeCfg = null; this.pokeSellBlocked.clear();
    this.mode = "manual"; this.leveling = null; this.plan = null; this.currentTargetId = null; this.fighter = null;
    this.queue = [];
    // poke_sell_cfg fica no banco (so o interruptor da venda apaga/desliga a config)
    this.persistDesired({ enabled: false, mode: "manual", slug: null, leveling: null, levelingQueue: [] });
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
    this.analyzer = null; this.analyzerBase = null;
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

  /** Cura o time na enfermeira Joy pela sessao VIVA (`joy-heal`, HAR ago/2026: o jogo
   *  responde `joy-healed` e reenvia `pokes` com o HP cheio). Cura so o TIME — pokemon no
   *  box continua desmaiado (visto no HAR: Ledian 0/24 no box seguiu 0 depois do healed).
   *  Retorna true se havia sessao viva; sem sessao, o caller faz o one-shot. MUTA a conta. */
  healTeam(): boolean {
    if (this.ws && this.status === "running") {
      this.send({ type: "joy-heal" });
      this.healSentAt = Date.now();
      // so espera confirmacao se havia MESMO alguem caido — curar time inteiro nao gera
      // evento ("curei e nada mudou" nao e noticia)
      this.healPending = (this.liveTeam ?? []).some((p) => p.maxHp > 0 && p.hp <= 0);
      setTimeout(() => this.send({ type: "pokes-get" }), 500); // confirma pelo estado
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
    // conexao nova = analyzer do jogo zerado: sem base, o frame JA e so desta hunt
    this.analyzerBase = null; this.analyzerRebase = false;
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
    // com o lider caido o jogo RECUSA a entrada — entrar em cima do corpo era a hunt
    // "ligada" que nao matava nada. Levanta primeiro; o retorno ao campo e automatico.
    if (this.leaderDown()) {
      this.owesEnter = true; // divida registrada ANTES: quem levantar o bicho re-entra
      void this.reviveLeader();
      return;
    }
    this.send({ type: "enter-hunt", slug });
    this.send({ type: "pending-get" });
    this.owesEnter = false;
  }

  /** Lider caido pelo ultimo estado conhecido (campo primeiro, senao a lista `pokes`). */
  private leaderDown(): boolean {
    if (this.downSince != null) return true;
    const leader = this.liveTeam?.find((p) => p.leader) ?? this.liveTeam?.[0];
    return !!leader && leader.maxHp > 0 && leader.hp <= 0;
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
      const raw = m as unknown as Analyzer;
      // marco zero da hunt nova; senao, se o jogo zerou sozinho (reconexao), larga a base
      if (this.analyzerRebase) { this.analyzerBase = raw; this.analyzerRebase = false; }
      else if (this.analyzerBase && analyzerZeroed(raw, this.analyzerBase)) this.analyzerBase = null;
      this.analyzer = analyzerDelta(raw, this.analyzerBase);
      this.updatedAt = Date.now();
      this.emit("hunt");
    } else if (m.type === "field-kill") {
      if (!this.slug) return; // hunt desligada: ignora kills (o char ainda pode estar saindo do campo)
      const loot = Array.isArray(m.loot) ? (m.loot as Record<string, unknown>[]).map((l) => ({ itemId: Number(l.itemId ?? 0), name: String(l.name ?? ""), qty: Number(l.qty ?? 0) })) : [];
      this.push({ at: Date.now(), kind: "kill", species: String(m.speciesName ?? "?"), shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot });
      // nivel AO VIVO do lider (que e quem caca): alimenta o HUD e o cerebro
      this.trackLevel(Number(m.level), Boolean(m.leveledUp));
      this.emit("hunt");
    } else if (m.type === "field") {
      this.trackField(m); // vida do lider ao vivo + desmaio (a fonte rapida)
    } else if (m.type === "poke-xp") {
      // XP por pokemon: no leveling, so interessa o pokemon do plano
      const id = String(m.id ?? "");
      if (!this.leveling || id === this.leveling.pokeId) {
        this.trackLevel(Number(m.level), Boolean(m.leveledUp));
        this.trackPokeXp(id, m);
      }
    } else if (m.type === "catch-result") {
      if (m.success && this.slug) {
        const species = String(m.speciesName ?? "?"), shiny = Boolean(m.shiny), ball = String(m.ballName ?? "");
        this.push({ at: Date.now(), kind: "catch", species, shiny, xp: 0, loot: [], ball });
        if (shiny && this.userId) void logRobotEvent(this.userId, { kind: "shiny", title: `Shiny ${species} capturado!`, body: ball || null, data: { species, ball } });
      }
    } else if (m.type === "joy-healed") {
      // ack da Joy: pede a lista JA (o HP novo e que confirma, nao o ack) — ver
      // "Confirme a mutacao pelo estado que ela deixa".
      this.send({ type: "pokes-get" });
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
    } else if (m.type === "balls") {
      this.checkBallsFrame(m); // estoque ao vivo: repoe bola ANTES da fila de captura travar
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
      this.checkFainted(team);
      this.liveBox = all.filter((p) => !p.team); // box ao vivo (modal box<->time le daqui)
      this.liveTeamAt = Date.now();
      if (sig !== prev) this.emit("session");
    } catch { /* best-effort */ }
  }

  // Vida do LIDER em campo (frame `field`, ~2/s). E aqui que o desmaio aparece quase na
  // hora — o `pokes` so passa a cada 20s, e nesse buraco a hunt fica ligada rendendo zero.
  private trackField(m: Record<string, unknown>) {
    const hp = Number(m.heroHp);
    const maxHp = Number(m.heroMaxHp);
    if (Number.isFinite(maxHp) && maxHp > 0) this.heroMaxHp = maxHp;
    if (Number.isFinite(hp)) this.heroHp = Math.max(0, hp);
    // `fainted` e a palavra do servidor; hp<=0 so vale se o HP veio NESTE frame (frame
    // parcial nao pode "matar" o lider por leitura velha)
    const down = Boolean(m.fainted)
      || (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp <= 0);
    if (!down) { this.leaderIsUp(); return; }
    void this.reviveLeader(typeof m.heroName === "string" ? m.heroName : undefined);
  }

  /** Lider de pe: fecha o episodio de desmaio e, se o robo tinha saido do campo pra
   *  curar, volta pra hunt sozinho. */
  private leaderIsUp() {
    if (this.downSince == null && !this.owesEnter && !this.healPending) return;
    const wasDown = this.downSince != null;
    this.downSince = null;
    this.healNoticed = false;   // episodio fechou: o proximo desmaio avisa de novo
    this.recoverWarned = false;
    if (this.healPending && this.userId) void logRobotEvent(this.userId, {
      kind: "heal", title: "Time curado na enfermeira Joy", body: null, data: {},
    });
    this.healPending = false;
    if (this.owesEnter && this.slug && this.ws) {
      this.owesEnter = false;
      this.enterHunt(this.slug); // paga a divida: de volta ao campo, mesma hunt
      this.refreshTimers();
      if (this.userId) void logRobotEvent(this.userId, {
        kind: "heal", title: "De pe de novo — hunt retomada", body: this.slug, data: { slug: this.slug },
      });
    }
    if (wasDown) this.emit("session");
  }

  /** LIDER DESMAIADO. O jogo nao deixa cacar (nem entrar em outra hunt) assim, e a Joy
   *  nao levanta ninguem com o char EM CAMPO. Ordem, entao:
   *    1. `field-revive` — gasta um Revive da bolsa e levanta sem sair da hunt;
   *    2. sem Revive (ou o Revive nao pegou em REVIVE_GRACE_MS): `leave-hunt` + `joy-heal`,
   *       que e de graca e so funciona fora do campo;
   *    3. HP de volta -> `leaderIsUp` re-entra na hunt sozinho.
   *  Um alerta e uma contagem de morte por episodio (o cerebro decide trocar de hunt). */
  private async reviveLeader(name?: string) {
    const now = Date.now();
    if (this.downSince == null) {
      this.downSince = now;
      const who = name ?? this.liveTeam?.find((p) => p.leader)?.name ?? "Seu pokemon";
      if (!this.healNoticed) {
        this.healNoticed = true;
        if (this.userId) void logRobotEvent(this.userId, {
          kind: "heal", title: `${who} desmaiou — o robo esta levantando ele`,
          body: "Revive da bolsa se houver; senao sai do campo e cura de graca na Joy.",
          data: { name: who, slug: this.slug },
        });
        void this.countDeath();
      }
      this.emit("session");
    }
    if (!this.ws) return;

    // 1) Revive da bolsa — so faz sentido EM CAMPO (owesEnter = estamos fora dele)
    if (this.slug && !this.owesEnter && now - this.reviveSentAt >= REVIVE_COOLDOWN_MS && this.hasRevive()) {
      this.reviveSentAt = now;
      this.send({ type: "field-revive" });
      return; // quem confirma e o proximo frame `field` (fainted:false), nao o ack
    }
    // 2) sem Revive, ou ele nao pegou: Joy de graca, fora do campo. Cooldown proprio — se
    // a cura nao pegar, a proxima varredura de `pokes` tenta de novo em vez de travar.
    if (now - this.downSince >= REVIVE_GRACE_MS && now - this.healSentAt >= HEAL_COOLDOWN_MS) this.goToJoy();
  }

  /** Passa na Joy (de graca) — saindo do campo antes, que e a pre-condicao dela. Guarda a
   *  divida de entrada: `leaderIsUp` volta pra hunt quando o HP encher. */
  private goToJoy() {
    if (!this.ws) return;
    const first = !this.owesEnter;
    if (this.slug && first) this.send({ type: "leave-hunt" }); // estava em campo: sai
    if (this.slug) this.owesEnter = true;
    this.healTeam();
    this.healPending = true; // ha alguem caido: o HP que voltar vira evento de cura
    if (first && this.userId) void logRobotEvent(this.userId, {
      kind: "heal", title: "Curando na enfermeira Joy",
      body: this.slug ? `A hunt ${this.slug} volta sozinha quando o HP encher.` : null,
      data: { slug: this.slug },
    });
    this.emit("session");
  }

  // Itens de categoria "revive" do catalogo. NAO e dado estatico: item novo (ou removido)
  // entra em patch, e a sessao vive o processo inteiro — por isso o set carrega a versao
  // do catalogo que o produziu e se refaz quando ela muda.
  private hasRevive(): boolean {
    void getData().then((d) => {
      if (this.reviveIdsVersion === d.version) return;
      this.reviveIds = new Set(d.items.filter((i) => i.category === "revive").map((i) => i.id));
      this.reviveIdsVersion = d.version;
    }).catch(() => {});
    if (!this.reviveIds) return true; // ainda nao sei quais sao: tentar o frame e barato
    if (!this.inv.size) return true; // inventario ainda nao chegou nesta conexao
    for (const [id, qty] of this.inv) if (qty > 0 && this.reviveIds.has(id)) return true;
    return false;
  }

  // Desmaio visto pela lista `pokes` (20s): rede de seguranca de quem nao esta em campo —
  // o robo entre hunts, ou o `field` que parou de vir. Mesmo caminho do frame `field`.
  private checkFainted(team: ActivePoke[]) {
    const leader = team.find((p) => p.leader) ?? team[0];
    const down = !!leader && leader.maxHp > 0 && leader.hp <= 0;
    if (!down) { this.leaderIsUp(); return; }
    // so age quando HA hunt em andamento (o slug sobrevive a saida pra Joy): sem hunt,
    // quem decide curar e o usuario, pelo botao.
    if (!this.ws || !this.slug) return;
    void this.reviveLeader(leader!.name);
    // caido ha tempo demais (nem Revive nem Joy pegaram): avisa UMA vez por episodio
    if (!this.recoverWarned && this.downSince != null
        && Date.now() - this.downSince >= RECOVER_MAX_MS && this.userId) {
      this.recoverWarned = true;
      void logRobotEvent(this.userId, {
        kind: "error", title: "O pokemon nao esta levantando",
        body: "O robo saiu do campo e pediu a cura na Joy, mas o HP nao voltou. Abra o jogo e cure na mao (ou compre Revives).",
        data: { slug: this.slug },
      });
    }
  }

  /** Alvos proibidos pra ESTE perfil: onde o bicho JA desmaiou. Caduca quando ele ganha
   *  niveis de verdade (DANGER_FORGET_LEVELS) — ai a conta do motor muda de figura. */
  private avoidFor(f: FighterProfile): Avoid {
    return (targetId) => {
      const at = this.banned.get(targetId);
      return at != null && f.level < at + DANGER_FORGET_LEVELS;
    };
  }

  /** A memoria de perigo e do PAR (cacador, alvo): trocar de cacador zera a lista. */
  private resetDangerIf(f: FighterProfile) {
    if (this.fighter?.speciesId !== f.speciesId) { this.deaths.clear(); this.banned.clear(); }
  }

  /** Desmaio com o cerebro no comando: o segundo no MESMO alvo bane a hunt e busca outra.
   *  Curar e voltar pro mesmo bicho que te matou nao e plano — e o loop que trava o nivel. */
  private async countDeath() {
    if (this.mode === "manual" || !this.fighter || this.currentTargetId == null) return;
    const id = this.currentTargetId;
    const n = (this.deaths.get(id) ?? 0) + 1;
    this.deaths.set(id, n);
    if (n < DEATHS_BEFORE_FLEE || this.thinking) return;
    this.thinking = true;
    try {
      this.banned.set(id, this.fighter.level);
      this.deaths.set(id, 0);
      const data = await getBrainData();
      const dead = data.targets.find((t) => t.pokeId === id)?.name ?? "essa hunt";
      const why = `${dead} derrubou seu pokemon ${n}x no nivel ${this.fighter.level} — hunt trocada`;

      // leveling: refaz o PLANO inteiro sem o alvo banido (as faixas seguintes tambem
      // mudam; so trocar a faixa atual voltaria pra ele no proximo level-up)
      if (this.mode === "leveling" && this.leveling && !this.leveling.done) {
        const plan = await buildLevelPlan(this.fighter, this.leveling.targetLevel, true, this.avoidFor(this.fighter));
        const step = plan.length ? stepForLevel(plan, this.fighter.level) : null;
        if (step) {
          this.plan = plan;
          await this.switchHunt(step.slug, step.targetId, why);
          this.persistDesired({ leveling: this.leveling });
          this.emit("session");
          return;
        }
      }
      const pick = await pickBestHunt(this.fighter, true, this.avoidFor(this.fighter));
      if (pick && pick.target.pokeId !== id) {
        await this.switchHunt(pick.target.slug, pick.target.pokeId, why);
      } else if (this.userId) {
        // nada melhor no alcance: avisa em vez de seguir batendo cabeca calado
        void logRobotEvent(this.userId, {
          kind: "error", title: `${dead} esta derrubando seu pokemon`,
          body: "O cerebro nao achou hunt melhor no alcance deste nivel. Troque o lider por um mais resistente ou escolha a hunt na mao.",
          data: { targetId: id, level: this.fighter.level },
        });
      }
      this.emit("session");
    } catch { /* cerebro nunca derruba a sessao */ } finally { this.thinking = false; }
  }

  // fallback via lista de pokes (20s): se os frames de XP nao trouxerem level, a lista traz.
  // De quebra, RENOVA os stats do lutador: e deles que o motor tira o HP/Def reais pra
  // medir o que voce aguenta (evolucao/level-up mudam o bicho, o perfil tem que seguir).
  private trackLevelFromPokes(list: unknown[]) {
    if (this.mode === "manual" || !this.fighter) return;
    try {
      const all = normalizeActivePokes(list);
      const target = this.leveling
        ? all.find((p) => p.id === this.leveling!.pokeId)
        : (all.find((p) => p.leader) ?? null);
      if (!target) return;
      const fresh = fighterOf(target);
      if (fresh.stats) { this.fighter.stats = fresh.stats; this.fighter.statsAt = fresh.statsAt; }
      this.fighter.ivTotal = fresh.ivTotal; this.fighter.quality = fresh.quality;
      if (target.level > this.fighter.level) this.trackLevel(target.level, true);
    } catch { /* fallback e best-effort */ }
  }

  /**
   * Ritmo de XP do POKEMON — que NAO e o do treinador. O jogo paga os dois por abate,
   * em curvas independentes (tem ate boost separado pra cada: "+50% trainer XP" e
   * "+50% Pokemon XP"). Usar o XP/h do analyzer, que e do treinador, pra estimar o
   * proximo nivel do bicho dava um tempo otimista por ordens de grandeza.
   *
   * Aqui medimos o que de fato acontece: acumula o XP ganho pelo pokemon desde a
   * primeira leitura da sessao e divide pelo tempo. O frame nao documenta o nome do
   * campo, entao aceitamos os apelidos comuns — sem campo, fica sem ritmo (e a UI
   * esconde o tempo em vez de mostrar um numero de outra grandeza).
   */
  private trackPokeXp(id: string, m: Record<string, unknown>) {
    const gained = [m.xpGained, m.gained, m.amount].map((v) => Number(v ?? 0)).find((v) => v > 0) ?? 0;
    const total = [m.xp, m.exp, m.total].map((v) => Number(v ?? 0)).find((v) => v > 0) ?? 0;
    const now = Date.now();
    if (!this.pokeXp || this.pokeXp.id !== id) {
      // trocou de pokemon (summon, plano novo): o ritmo do anterior nao vale pro novo
      this.pokeXp = { id, since: now, gained: 0, lastTotal: total || null };
      return;
    }
    if (gained > 0) this.pokeXp.gained += gained;
    else if (total > 0 && this.pokeXp.lastTotal != null && total > this.pokeXp.lastTotal) {
      // sem o delta no frame, o proprio acumulado da o ganho entre duas leituras
      this.pokeXp.gained += total - this.pokeXp.lastTotal;
    }
    if (total > 0) this.pokeXp.lastTotal = total;
  }

  /** XP/h do pokemon medido nesta sessao. null enquanto nao ha amostra suficiente. */
  private pokeXpPerHour(): number | null {
    const p = this.pokeXp;
    if (!p || p.gained <= 0) return null;
    const hours = (Date.now() - p.since) / 3_600_000;
    // menos de um minuto de amostra faz o numero pular demais pra valer de estimativa
    return hours >= 1 / 60 ? p.gained / hours : null;
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
            body: `Plano ${this.leveling.startLevel} -> ${this.leveling.targetLevel} concluido`
              + (this.queue.length ? ` · proximo da fila: ${this.queue[0].name}` : ""),
            data: { level, pokeId: this.leveling.pokeId, queued: this.queue.length },
          });
          // FILA: em vez de cair direto no auto, comeca o proximo plano (summon + rota
          // nova). Sem fila (ou se nenhum da fila servir), o auto assume — o robo nunca
          // fica parado depois de bater a meta.
          if (await this.nextGoal()) { this.emit("session"); return; }
          this.mode = "auto"; this.plan = null;
          this.persistDesired({ mode: "auto", leveling: this.leveling, levelingQueue: [] });
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
        const better = await reconsiderHunt(this.fighter, this.currentTargetId, true, this.avoidFor(this.fighter));
        if (better) {
          await this.switchHunt(better.target.slug, better.target.pokeId,
            `Auto: ${better.target.huntName} rende mais no nivel ${level} (~${Math.round(better.est.xpH).toLocaleString("pt-BR")} XP/h)`);
        }
      }
      this.emit("session");
    } catch { /* cerebro nunca derruba a sessao */ } finally { this.thinking = false; }
  }

  /** Puxa o proximo plano da fila e comeca: troca o LIDER (quem caca e quem upa), monta a
   *  rota do nivel atual e entra na primeira faixa. Plano invalido (bicho saiu do time, ja
   *  passou do nivel, sem rota) e PULADO com alerta, em vez de travar a fila inteira.
   *  false = nao sobrou nada pra comecar. */
  private async nextGoal(): Promise<boolean> {
    while (this.queue.length) {
      const next = this.queue.shift()!;
      const poke = this.liveTeam?.find((p) => p.id === next.pokeId);
      const skip = (why: string) => {
        if (this.userId) void logRobotEvent(this.userId, {
          kind: "error", title: `Plano de ${next.name} pulado`, body: why,
          data: { pokeId: next.pokeId, targetLevel: next.targetLevel },
        });
      };
      if (!poke) { skip("O pokemon nao esta mais no time (guardado, vendido ou trocado)."); continue; }
      if (poke.level >= next.targetLevel) { skip(`Ja estava no nivel ${poke.level}, na meta ${next.targetLevel} ou acima.`); continue; }

      const fighter = fighterOf(poke);
      this.resetDangerIf(fighter);
      const plan = await buildLevelPlan(fighter, next.targetLevel, true, this.avoidFor(fighter)).catch(() => []);
      const step = plan.length ? stepForLevel(plan, fighter.level) : null;
      if (!step) { skip("O cerebro nao achou rota pra esse alvo."); continue; }

      // quem upa e quem caca: o proximo da fila vira o LIDER antes de entrar no campo
      if (!poke.leader) this.summonActive(next.pokeId);
      this.mode = "leveling"; this.fighter = fighter; this.plan = plan;
      this.leveling = {
        pokeId: next.pokeId, speciesId: poke.speciesId, name: next.name,
        startLevel: poke.level, targetLevel: next.targetLevel, currentLevel: poke.level, done: false,
      };
      await this.switchHunt(step.slug, step.targetId, `Fila: comecou o plano de ${next.name} ate o nivel ${next.targetLevel}`);
      this.persistDesired({ mode: "leveling", leveling: this.leveling, levelingQueue: this.queue });
      if (this.userId) void logRobotEvent(this.userId, {
        kind: "goal", title: `Proximo da fila: ${next.name} ${poke.level} -> ${next.targetLevel}`,
        body: `${plan.length} etapa${plan.length > 1 ? "s" : ""} · comeca em ${step.huntName}`
          + (this.queue.length ? ` · ainda ${this.queue.length} na fila` : ""),
        data: { pokeId: next.pokeId, targetLevel: next.targetLevel, steps: plan.length },
      });
      return true;
    }
    return false;
  }

  // troca de hunt NA MESMA conexao (enter-hunt), atualizando alvo/drops. Mantem o feed de
  // kills (a sensacao e de continuidade); o analyzer rebaseia (o do jogo nao zera sozinho).
  private async switchHunt(slug: string, targetId: number, why: string) {
    this.logSummary(); // fecha o resumo da faixa anterior antes de trocar o slug
    this.slug = slug; this.currentTargetId = targetId;
    try { this.sellIds = new Set((await getBrainData()).sellableLoot(targetId)); } catch { /* mantem a lista atual */ }
    this.rebaseAnalyzer(); this.summaryLogged = false; this.inv.clear(); this.pending = [];
    if (this.ws) { this.enterHunt(slug); this.refreshTimers(); }
    if (this.userId) void logRobotEvent(this.userId, { kind: "brain", title: `Robo trocou de hunt: ${slug}`, body: why, data: { slug, targetId } });
    this.persistDesired({ slug, sellItemIds: [...this.sellIds] });
    this.emit("hunt");
  }

  // vende os drops marcados que tem na mochila (REST) — pulando itens com cadeado
  private async sellDrops() {
    if (this.sellingDrops || this.sellIds.size === 0) return;
    this.sellingDrops = true;
    try {
      if (!(await this.syncTokens()) || !this.tokens) return;
      // cadeado do jogador: recusa 403 e derruba o lote — exclui antes (cache 5min)
      if (Date.now() - this.lockedItemsAt > 5 * 60_000) {
        const lr = await fetchLocks(this.tokens).catch(() => null);
        if (lr) {
          if (lr.changed) { this.tokens = lr.tokens; await this.onTokens?.(lr.tokens); }
          this.lockedItems = lr.locked;
          this.lockedItemsAt = Date.now();
        }
      }
      const toSell: { itemId: number; qty: number }[] = [];
      for (const id of this.sellIds) {
        if (this.lockedItems.has(id)) continue;
        const q = this.inv.get(id) ?? 0;
        if (q > 0) toSell.push({ itemId: id, qty: q });
      }
      if (!toSell.length) return;
      const w = await sellItems(this.tokens, toSell);
      if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
      if (!w.ok) {
        const why = gameErrorMsg(w.data);
        this.logOpError("sell-drops", "Venda de itens falhou", `O jogo recusou (HTTP ${w.status}${why ? `: ${why}` : ""}). O robo tenta na proxima varredura.`);
      }
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
    if (this.sellingPokes || !this.pokeCfg) return;
    this.sellingPokes = true;
    try {
      const all = normalizeActivePokes(list);
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const matches = filterSellable(all, this.pokeCfg, rarityOf).filter((p) => !this.pokeSellBlocked.has(p.id));
      if (!matches.length) return;
      if (!(await this.syncTokens()) || !this.tokens) return;
      const blockedBefore = this.pokeSellBlocked.size;
      const r = await this.sellPokesResilient(matches.map((p) => p.id));
      const newlyBlocked = this.pokeSellBlocked.size - blockedBefore;
      if (newlyBlocked > 0) {
        this.logOpError("sell-pokes-skip", "Pokemon invendaveis ignorados",
          `O jogo recusou ${newlyBlocked} pokemon (anunciado no mercado, equipe ou shiny). O robo passa a ignora-los e vende o resto normalmente.`);
      }
      if (r.soldIds.length) {
        // agrega POR ESPECIE — o card mostra o bicho (icone+nome+raridade), so quantidade
        // e valor. E totalizador. So conta o que o jogo CONFIRMOU (soldIds dos lotes ok).
        const byId = new Map(matches.map((p) => [p.id, p]));
        for (const id of r.soldIds) {
          const p = byId.get(id);
          if (!p) continue;
          const cur = this.poke.soldBySpecies[p.speciesId] ?? { speciesId: p.speciesId, name: p.name, rarity: p.rarity, count: 0, gold: 0 };
          cur.count += 1; cur.gold += p.sellValue;
          this.poke.soldBySpecies[p.speciesId] = cur;
        }
        // sem alerta por venda (o vendido aparece em "Pokemon vendidos" e em Estatisticas).
        if (this.userId) void addRobotSales(this.userId, { pokesCount: r.soldIds.length, pokesGold: r.gold });
        this.emit("hunt");
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingPokes = false; }
  }

  // Vende um lote com RESILIENCIA. O jogo recusa o lote INTEIRO (400) se UM pokemon for
  // invendavel — na equipe, shiny ou anunciado no mercado — e o frame `pokes` nao expoe
  // "anunciado no mercado", entao nao da pra filtrar antes de tentar. Bissecciona ate
  // isolar os recusados, vende o resto e poe os isolados em pokeSellBlocked (um bicho
  // ruim nao pode segurar a venda dos outros). Custo maximo: ~2 * bloqueados * log2(lote).
  private async sellPokesResilient(ids: string[]): Promise<{ soldIds: string[]; gold: number }> {
    if (!ids.length || !this.tokens) return { soldIds: [], gold: 0 };
    const w = await sellPokes(this.tokens, ids);
    if (w.changed) { this.tokens = w.tokens; await this.onTokens?.(w.tokens); }
    if (w.ok) {
      const sold = w.data?.sold ?? ids.length;
      return { soldIds: ids.slice(0, sold), gold: w.data?.goldGained ?? 0 };
    }
    if (w.status === 400) {
      if (ids.length === 1) { this.pokeSellBlocked.add(ids[0]); return { soldIds: [], gold: 0 }; }
      const mid = Math.ceil(ids.length / 2);
      const a = await this.sellPokesResilient(ids.slice(0, mid));
      const b = await this.sellPokesResilient(ids.slice(mid));
      return { soldIds: [...a.soldIds, ...b.soldIds], gold: a.gold + b.gold };
    }
    // falha nao-400 (rede/5xx/token) e transitoria: para aqui, a proxima varredura tenta
    const why = gameErrorMsg(w.data);
    this.logOpError("sell-pokes", "Venda de pokemon falhou", `O jogo recusou (HTTP ${w.status}${why ? `: ${why}` : ""}). O robo tenta na proxima varredura.`);
    return { soldIds: [], gold: 0 };
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
    if (!w.ok) { this.logOpError("autobuy", "Auto-compra falhou", `O jogo recusou a compra de ${name} (HTTP ${w.status}). O robo tenta de novo na proxima varredura.`); return gold; }
    const spent = qty * priceGold;
    if (this.buyUserId) void logRobotEvent(this.buyUserId, { kind: "item-bought", title: `Comprou ${qty} ${name}`, body: `-$${spent}`, data: { count: qty, gold: -spent } });
    return gold - spent;
  }

  // reabastece o que a automacao usa: as BOLAS (auto-catch, shiny, selecionada) e, se ligados,
  // a POCAO (auto-potion) e o REVIVE (auto-revive). Qual pocao/revive vem da escolha do usuario
  // (supply_cfg); null = "a melhor" (a mais forte que da pra comprar). Tudo abaixo do piso, ate
  // o alvo, limitado pelo dinheiro. GASTA dolares do jogo — opt-in, cada compra vira Alerta.
  private async restockSupplies() {
    if (!this.autoBuy || !this.buyUserId || this.buying) return;
    this.buying = true;
    try {
      // token mais fresco SEMPRE do banco (ver syncTokens): a copia em memoria da auto-
      // compra ficava horas stale e toda varredura morria num 401 engolido pelo catch.
      try {
        const l = await getGameLink(this.buyUserId);
        if (!l || l.status === "expired") { this.logOpError("autobuy", "Auto-compra parada", "O vinculo com o jogo expirou — reconecte a conta na secao Conta."); return; }
        this.buyTokens = l.tokens;
      } catch { /* banco fora: tenta com a copia em memoria */ }
      if (!this.buyTokens) return;

      const a = await readAuto(this.buyTokens);
      if (!a) { this.logOpError("autobuy", "Auto-compra nao rodou", "O jogo nao respondeu. O robo tenta de novo na proxima varredura."); return; }
      if ("unauth" in a) { this.logOpError("autobuy", "Auto-compra nao rodou", "O jogo recusou o token (401). Se persistir, reconecte a conta."); return; }
      if (a.changed) { this.buyTokens = a.tokens; await this.buyPersist?.(a.tokens); }
      const shopRes = await fetchShop(this.buyTokens);
      if (!shopRes) { this.logOpError("autobuy", "Auto-compra nao rodou", "A loja do jogo nao respondeu. O robo tenta de novo na proxima varredura."); return; }
      if (shopRes.changed) { this.buyTokens = shopRes.tokens; await this.buyPersist?.(shopRes.tokens); }
      let gold = shopRes.shop.gold;

      // ---- BOLAS ----
      const ballCount = new Map(a.balls.map((b) => [b.id, b.count]));
      const wantBalls = [...new Set([a.auto.autoCatchBallId, a.auto.autoCatchShinyBallId, a.auto.selectedBallId].filter((id) => id > 0))];
      this.wantedBallIds = wantBalls; // o gatilho ao vivo (frame balls) vigia exatamente estas
      for (const id of wantBalls) {
        const shopBall = shopRes.shop.balls.find((b) => b.id === id);
        if (!shopBall) continue;
        gold = await this.buyUpTo(buyBall, id, shopBall.name, shopBall.priceGold, ballCount.get(id) ?? 0, BALL_FLOOR, BALL_TARGET, gold);
      }

      // ---- POCAO / REVIVE ----
      // A pocao e do auto-potion DO JOGO (so faz sentido com ele ligado). O REVIVE virou
      // insumo do proprio robo: e ele que manda `field-revive` quando o lider cai, e sem
      // Revive na bolsa a alternativa e sair do campo e ir na Joy (hunt parada). Por isso
      // o revive se repoe sempre que a auto-compra esta ligada.
      if (!a.auto.autoPotion && !this.autoBuy) return;
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
      // Revive: repoe com a auto-compra ligada, independente do auto-revive DO JOGO —
      // quem gasta agora e o robo (`field-revive` no desmaio do lider).
      {
        const r = chooseId("revive", cfg?.reviveId ?? null);
        if (r) gold = await this.buyUpTo(buyItem, r.id, r.name, r.priceGold, invCount.get(r.id) ?? 0, REVIVE_FLOOR, REVIVE_TARGET, gold);
      }
    } catch {
      this.logOpError("autobuy", "Auto-compra nao rodou", "Erro inesperado na varredura. O robo tenta de novo na proxima.");
    } finally { this.buying = false; }
  }

  // GATILHO AO VIVO da auto-compra: o jogo manda o frame `balls` na sessao segurada sempre
  // que o estoque muda. Se uma das bolas que a automacao USA cair abaixo do piso, repoe JA
  // (com cooldown) — e o que impede a fila de captura de travar no meio da hunt, em vez de
  // esperar a varredura periodica.
  private checkBallsFrame(m: Record<string, unknown>) {
    if (!this.autoBuy || !this.wantedBallIds.length) return;
    try {
      // array direto em balls/list/items; formato {catalog, counts} o parseBalls resolve no frame cru
      const raw = (Array.isArray(m.balls) ? m.balls : Array.isArray(m.list) ? m.list : Array.isArray(m.items) ? m.items : m) as unknown;
      const balls = parseBalls(raw);
      if (!balls.length) return;
      const low = this.wantedBallIds.some((id) => {
        const b = balls.find((x) => x.id === id);
        return b != null && !b.infinite && b.count < BALL_FLOOR;
      });
      if (!low) return;
      if (Date.now() - this.lastBuyTriggerAt < BUY_TRIGGER_COOLDOWN_MS) return;
      this.lastBuyTriggerAt = Date.now();
      void this.restockSupplies();
    } catch { /* frame estranho nao derruba a sessao */ }
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
    // PERGUNTA antes de martelar. O WebSocket nao sabe dizer "voce esta banido": ele so
    // fecha, e o motor lia isso como queda de rede e reconectava pra sempre. Uma chamada
    // REST responde com codigo, e 403 encerra a tentativa em vez de repetir.
    if (await this.refusedByGame()) return;
    this.connect();
  }

  /** Uma pergunta ao REST: a conta ainda e aceita? true = recusada (ja tratada). */
  private async refusedByGame(): Promise<boolean> {
    if (!this.tokens) return false;
    try {
      const r = await gameFetch("/api/characters/me", this.tokens);
      const refusal = await refusalOf(r.res);
      if (refusal?.kind === "blocked") { await this.blockByGame(refusal); return true; }
    } catch {
      // rede/jogo fora do ar nao e recusa da conta: segue pro socket e ao backoff normal
    }
    return false;
  }

  /**
   * O jogo recusou a conta. Estado TERMINAL: desliga o desejo de rodar (senao o proximo
   * boot religa e recomeca), cancela retry, fecha o socket e grava o motivo no banco pra
   * a tela poder dizer o que houve — em vez de "nao conectou" sem explicacao.
   */
  private async blockByGame(refusal: Refusal): Promise<void> {
    this.desiredOn = false;
    this.cancelReconnect();
    this.clearTimers();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.blockedReason = refusal.message || null;
    this.setStatus("blocked", refusal.message || undefined);
    if (this.userId) {
      await markGameLinkBlocked(this.userId, refusal).catch(() => {});
      void logRobotEvent(this.userId, {
        kind: "blocked",
        title: "O jogo recusou esta conta",
        body: refusal.message || `O jogo respondeu ${refusal.status} ao conectar.`,
        data: { status: refusal.status },
      });
    }
    this.emit("session");
    this.emit("hunt");
  }

  private teardown() {
    this.clearTimers();
    this.clearContested();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.inv.clear(); this.pending = [];
    this.since = null; this.updatedAt = null;
    this.analyzerBase = null; this.analyzerRebase = false;
    this.setStatus("idle");
    this.emit("hunt");
  }
}

// singleton por processo (sobrevive entre requests no server long-lived).
// SESSION_REV: bump SEMPRE que a classe ganhar/mudar metodo — no dev, o hot-reload
// re-avalia o modulo mas a instancia antiga (prototype velho) fica presa no globalThis;
// sem o rev, chamar um metodo novo dava "is not a function" ate reiniciar o server.
const SESSION_REV = 19;
const g = globalThis as unknown as { __piwSession?: GameSession; __piwSessionRev?: number };
// ---------------------------------------------------------------------------
// REGISTRO DE SESSOES — uma instancia POR USUARIO.
//
// Era um singleton de processo: uma conta de jogo por servidor inteiro. Isso nao e um
// detalhe de implementacao, e o teto do produto — dois assinantes nao conseguiam farmar
// ao mesmo tempo, e conectar a conta B derrubava a hunt da conta A no meio. Enquanto o
// singleton foi compartilhado tambem VAZAVA: a tela de um mostrava a hunt do outro.
//
// Agora cada usuario tem a sua GameSession, guardada num Map no globalThis (sobrevive ao
// hot-reload do dev, igual o singleton antigo). A posse deixa de ser uma checagem que
// alguem pode esquecer e vira a PROPRIA estrutura: nao existe caminho pra ler a sessao
// de outro usuario, porque nao existe referencia compartilhada pra ler.
//
// A troca de CONTA DO JOGO dentro do mesmo usuario continua sendo tratada no ctx().
const store = globalThis as unknown as {
  __piwSessions?: Map<string, GameSession>;
  __piwSessionsRev?: number;
};

// Hot-reload: silencia as instancias velhas SEM persistir nada (stop() gravaria
// enabled=false e apagaria a intencao do usuario so por causa de um reload).
if (!store.__piwSessions || store.__piwSessionsRev !== SESSION_REV) {
  try {
    for (const old of store.__piwSessions?.values() ?? []) {
      const o = old as unknown as Record<string, unknown>;
      o.desiredOn = false; o.holdOpen = false;
      for (const k of ["analyzerPoll", "pokesPoll", "dropTimer", "buyTimer"]) {
        const t = o[k]; if (t) clearInterval(t as ReturnType<typeof setInterval>);
      }
      for (const k of ["reconnectTimer", "contestedSurvive"]) {
        const tm = o[k]; if (tm) clearTimeout(tm as ReturnType<typeof setTimeout>);
      }
      (o.ws as { close?: () => void } | null | undefined)?.close?.();
    }
  } catch { /* melhor um socket orfao no dev que derrubar o modulo */ }
  store.__piwSessions = new Map();
  store.__piwSessionsRev = SESSION_REV;
}

const sessions: Map<string, GameSession> = store.__piwSessions;

/** A sessao DESTE usuario, criando se ainda nao existe. Use quando vai COMANDAR. */
export function sessionFor(userId: string): GameSession {
  let s = sessions.get(userId);
  if (!s) { s = new GameSession(); sessions.set(userId, s); }
  return s;
}

/** A sessao deste usuario se ela existe. Use quando vai LER — usuario sem sessao nao
 *  precisa de uma instancia criada so pra devolver estado vazio. */
export function peekSession(userId: string): GameSession | null {
  return sessions.get(userId) ?? null;
}

/** Estado pra leitura: o real, ou o vazio de quem nao tem sessao. */
export function stateOf(userId: string): HuntState {
  return peekSession(userId)?.getState() ?? idleHuntState();
}

/** Todas as sessoes vivas (boot/diagnostico). */
export function liveSessions(): { userId: string; session: GameSession }[] {
  return [...sessions.entries()].map(([userId, session]) => ({ userId, session }));
}

/** Solta a sessao do usuario e tira do registro (Desconectar). Sem a remocao o Map so
 *  cresce: uma instancia morta por conta que ja passou pelo servidor. */
export function dropSession(userId: string): void {
  const s = sessions.get(userId);
  if (!s) return;
  s.release(userId);
  sessions.delete(userId);
}
