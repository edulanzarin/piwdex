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
import { sellItems, sellPokes, fetchShop, buyBall } from "./game-shop";
import { readAuto } from "./game-auto";
import { getData } from "./data";
import { normalizeActivePokes } from "./game-account";
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

// venda de pokemon agregada POR ESPECIE (o card mostra o bicho: icone+nome+raridade+qtd+valor):
// mesmo capturando o mesmo varias vezes na hunt, so soma a quantidade e o valor. Reseta ao
// trocar de hunt.
export interface SpeciesSold { speciesId: number; name: string; rarity: Rarity; count: number; gold: number }

export interface PokeSellSub { on: boolean; soldBySpecies: Record<number, SpeciesSold> }

// visao "hunt" (GET /api/vip/hunt) — o que a aba Hunt e os Itens vendidos leem
export interface HuntState {
  status: SessStatus; error?: string;
  slug: string | null; since: number | null; updatedAt: number | null;
  analyzer: Analyzer | null; recentKills: KillLog[]; soldItems: SoldItem[]; autoSellCount: number;
  pokeSellOn: boolean;
}
// visao "auto-sell" (GET /api/vip/autosell) — a aba Pokemon vendidos: status + o vendido
// agregado por especie (cards da hunt atual).
export interface AutoSellView { status: SessStatus; error?: string; soldBySpecies: SpeciesSold[] }

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
  private poke: PokeSellSub = { on: false, soldBySpecies: {} };
  private recordedIds = new Set<string>(); // ids ja gravados no acervo (evita rescrever no banco)
  private gen = 0; // geracao do socket: invalida os handlers de um socket antigo no reconnect
  private baselineIds: Set<string> | null = null; // ids que voce JA tinha ao ligar (colecao antiga)
  // auto-compra de consumiveis (roda no proprio timer, REST — independe do WS de hunt/venda)
  private autoBuy = false;
  private buyTimer: ReturnType<typeof setInterval> | null = null;
  private buyTokens: Tokens | null = null;
  private buyUserId: string | null = null;
  private buyPersist: ((t: Tokens) => Promise<void>) | null = null;

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
      soldBySpecies: Object.values(this.poke.soldBySpecies),
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
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {}; this.summaryLogged = false;
    this.applyOrConnect(true);
  }

  stopHunt() {
    this.logSummary();
    this.slug = null; this.sellIds.clear(); this.inv.clear();
    this.analyzer = null; this.recentKills = []; this.soldItems = []; this.poke.soldBySpecies = {};
    // a venda de pokemon roda ATRELADA a hunt (o toggle 24/7 standalone saiu): parar a hunt
    // para a venda tambem. Sem jobs, encerra a sessao.
    this.pokeCfg = null; this.poke.on = false;
    this.teardown();
  }

  // liga/atualiza o job de VENDA DE POKEMON (cfg null = desliga). NAO zera o vendido por
  // raridade (isso so zera ao trocar de hunt) — ligar/desligar preserva a contagem da hunt.
  setPokeSell(userId: string, tokens: Tokens, shard: number, cfg: PokeSellConfig, onTokens: (t: Tokens) => Promise<void>) {
    this.ctx(userId, tokens, shard, onTokens);
    this.pokeCfg = cfg;
    this.poke.on = true;
    this.baselineIds = null; // refaz a base: a conta atual nao entra no acervo, so novas capturas
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

  // Reaplica a automacao no campo VIVO sem reconectar: reenvia enter-hunt na MESMA conexao
  // pro jogo reler a autohelper (bola do auto-catch, bola shiny, pocao, bola selecionada).
  // O jogo cacheia essa config ao entrar no campo — por isso trocar a bola "nao pegava" ate
  // reconectar. Chamado pela rota /api/vip/auto quando a config muda com a hunt ligada.
  // Retorna true se havia hunt viva pra reaplicar. NAO derruba a sessao (mesma conexao).
  refreshHunt(): boolean {
    if (this.ws && this.slug) { this.send({ type: "enter-hunt", slug: this.slug }); return true; }
    return false;
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

  private connect() {
    if (!this.tokens) return;
    this.status = "connecting"; this.error = undefined; this.since = Date.now(); this.updatedAt = null;
    const url = `${WS_BASE}/ws${this.shard}?token=${encodeURIComponent(this.tokens.access)}&cmid=${crypto.randomBytes(16).toString("hex")}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, { headers: { Origin: "https://poke.idleworld.online", "User-Agent": UA } } as unknown as string[]);
    } catch (e) { this.status = "error"; this.error = String(e); return; }
    this.ws = ws;
    const myGen = ++this.gen; // handlers so valem enquanto este for o socket atual

    ws.addEventListener("open", () => {
      this.status = "running";
      if (this.slug) this.send({ type: "enter-hunt", slug: this.slug });
      this.refreshTimers();
    });
    ws.addEventListener("message", (ev: MessageEvent) => { if (myGen === this.gen) this.onMessage(ev); });
    ws.addEventListener("close", (ev: unknown) => { if (myGen === this.gen) this.onGone("kicked", (ev as { code?: number } | undefined)?.code); });
    ws.addEventListener("error", () => { if (myGen === this.gen) this.onGone("error"); });
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
      if (!this.slug) return; // hunt desligada: ignora kills (o char ainda pode estar saindo do campo)
      const loot = Array.isArray(m.loot) ? (m.loot as Record<string, unknown>[]).map((l) => ({ itemId: Number(l.itemId ?? 0), name: String(l.name ?? ""), qty: Number(l.qty ?? 0) })) : [];
      this.push({ at: Date.now(), kind: "kill", species: String(m.speciesName ?? "?"), shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot });
    } else if (m.type === "catch-result") {
      if (m.success && this.slug) {
        const species = String(m.speciesName ?? "?"), shiny = Boolean(m.shiny), ball = String(m.ballName ?? "");
        this.push({ at: Date.now(), kind: "catch", species, shiny, xp: 0, loot: [], ball });
        if (shiny && this.userId) void logRobotEvent(this.userId, { kind: "shiny", title: `Shiny ${species} capturado!`, body: ball || null, data: { species, ball } });
      }
    } else if (m.type === "inventory") {
      const items = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
      this.inv.clear();
      for (const it of items) this.inv.set(Number(it.itemId ?? 0), Number(it.quantity ?? it.qty ?? 0));
    } else if (m.type === "pokes" && Array.isArray(m.list)) {
      void this.updateTeamSnapshot(m.list); // Conta reflete o time ao vivo (lider incluso)
      void this.recordKept(m.list);   // acervo de capturados (real-time)
      void this.sellPokesSweep(m.list); // venda (assim que coleta)
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
        // sem alerta por venda (poluia o feed): o vendido ja aparece em "Itens vendidos" e
        // no totalizador de Estatisticas. So acumula o totalizador cumulativo.
        if (this.userId && qtyTotal > 0) void addRobotSales(this.userId, { itemsCount: qtyTotal, itemsGold: goldTotal });
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
        }
      }
    } catch { /* proxima varredura tenta */ } finally { this.sellingPokes = false; }
  }

  // grava no acervo (captured_pokes) os pokemon MANTIDOS — os que NAO batem as travas de
  // venda (bons demais, raridade nao marcada, shiny, time/lider/starter). Roda a cada lista
  // de pokes (real-time, sem throttle), so gravando ids novos (dedupe em memoria).
  private async recordKept(list: unknown[]) {
    if (!this.userId || !this.pokeCfg) return;
    try {
      const all = normalizeActivePokes(list);
      // A 1a lista NAO-VAZIA vira LINHA DE BASE (a colecao que voce JA tinha): nao entra no
      // acervo. So depois o robo grava o que capturar. Guard contra lista vazia/parcial: se
      // a base ficasse vazia, tudo viraria "novo" e a conta inteira entraria (bug do "voltou").
      if (this.baselineIds === null) {
        if (all.length) this.baselineIds = new Set(all.map((p) => p.id));
        return;
      }
      const data = await getData();
      const rarityOf = (sid: number): Rarity => data.getCreature(sid)?.rarity ?? "COMMON";
      const sellIds = new Set(filterSellable(all, this.pokeCfg, rarityOf).map((p) => p.id));
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
    if (this.buyTimer) { clearInterval(this.buyTimer); this.buyTimer = null; }
    if (on) {
      void this.restockBalls();
      this.buyTimer = setInterval(() => void this.restockBalls(), BUY_EVERY_MS);
    }
  }
  getAutoBuyOn() { return this.autoBuy; }

  // reabastece SO as bolas que a automacao usa (auto-catch, shiny, selecionada) quando abaixo
  // do piso, ate o alvo, limitado pelo dinheiro. GASTA dolares do jogo — por isso e opt-in e
  // loga cada compra. "Calcula sozinho" = decide a quantidade pelo que falta pro alvo.
  private async restockBalls() {
    if (!this.autoBuy || !this.buyTokens || !this.buyUserId) return;
    try {
      const a = await readAuto(this.buyTokens);
      if (!a || "unauth" in a) return;
      if (a.changed) { this.buyTokens = a.tokens; await this.buyPersist?.(a.tokens); }
      const shopRes = await fetchShop(this.buyTokens);
      if (!shopRes) return;
      if (shopRes.changed) { this.buyTokens = shopRes.tokens; await this.buyPersist?.(shopRes.tokens); }
      let gold = shopRes.shop.gold;
      const countById = new Map(a.balls.map((b) => [b.id, b.count]));
      const wantIds = [...new Set([a.auto.autoCatchBallId, a.auto.autoCatchShinyBallId, a.auto.selectedBallId].filter((id) => id > 0))];
      for (const id of wantIds) {
        const have = countById.get(id) ?? 0;
        if (have >= BALL_FLOOR) continue;
        const shopBall = shopRes.shop.balls.find((b) => b.id === id);
        if (!shopBall || shopBall.priceGold <= 0) continue;
        const qty = Math.min(BALL_TARGET - have, Math.floor(gold / shopBall.priceGold));
        if (qty <= 0) continue;
        const w = await buyBall(this.buyTokens, id, qty);
        if (w.changed) { this.buyTokens = w.tokens; await this.buyPersist?.(w.tokens); }
        if (w.ok) {
          gold -= qty * shopBall.priceGold;
          const spent = qty * shopBall.priceGold;
          void logRobotEvent(this.buyUserId, { kind: "item-bought", title: `Comprou ${qty} ${shopBall.name}`, body: `-$${spent}`, data: { count: qty, gold: -spent } });
        }
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
