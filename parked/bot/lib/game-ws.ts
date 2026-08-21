import { type Tokens } from "./game-auth";
import { GAME_HOST } from "./game-host";

// Pokemons individuais ATIVOS via WebSocket. O jogo nao expoe isso na REST — o time
// e a colecao (com IV/quality/power por individuo) so chegam pelo WS, que fica num
// SHARD especifico por conta: wss://.../ws<N>?token=<JWT>. Conectar no shard errado
// fecha com code 4003 "wrong-shard". O shard e descoberto por sondagem e cacheado.
//
// Server-only (usa o WebSocket global do Node). Importar so de route handlers.

const WS_BASE = GAME_HOST.replace(/^http/, "ws");
const SHARDS = 64; // faixa varrida na descoberta (ws1..ws64)

export interface PokesResult {
  pokes: Record<string, unknown>[];
  shard: number;
}

// Abre UM shard e resolve com a lista de "pokes" (ou null se fechar/expirar/errar).
function connectShard(shard: number, token: string, timeoutMs: number): Promise<Record<string, unknown>[] | null> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket;
    const done = (v: Record<string, unknown>[] | null) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* noop */ }
      resolve(v);
    };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(token)}`);
    } catch {
      resolve(null);
      return;
    }
    const to = setTimeout(() => done(null), timeoutMs);
    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as { type?: string; list?: unknown };
        if (j?.type === "pokes" && Array.isArray(j.list)) {
          clearTimeout(to);
          done(j.list as Record<string, unknown>[]);
        }
      } catch { /* frame nao-json */ }
    });
    ws.addEventListener("close", () => { clearTimeout(to); done(null); }); // wrong-shard fecha rapido
    ws.addEventListener("error", () => { clearTimeout(to); done(null); });
  });
}

// Varre todos os shards em paralelo e resolve no primeiro que mandar "pokes".
function scanShards(token: string, timeoutMs: number): Promise<PokesResult | null> {
  return new Promise((resolve) => {
    const sockets: WebSocket[] = [];
    let settled = false;
    const done = (r: PokesResult | null) => {
      if (settled) return;
      settled = true;
      sockets.forEach((w) => { try { w.close(); } catch { /* noop */ } });
      resolve(r);
    };
    for (let n = 1; n <= SHARDS; n++) {
      let ws: WebSocket;
      try { ws = new WebSocket(`${WS_BASE}/ws${n}?token=${encodeURIComponent(token)}`); } catch { continue; }
      sockets.push(ws);
      ws.addEventListener("message", (ev: MessageEvent) => {
        try {
          const j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as { type?: string; list?: unknown };
          if (j?.type === "pokes" && Array.isArray(j.list)) done({ pokes: j.list as Record<string, unknown>[], shard: n });
        } catch { /* noop */ }
      });
      ws.addEventListener("error", () => { /* ignora shards que recusam */ });
    }
    setTimeout(() => done(null), timeoutMs);
  });
}

/** Busca os pokemons ativos. Tenta o shard cacheado (1 conexao); se falhar, varre.
 *  Retorna a lista crua + o shard usado (o caller cacheia se mudou). */
export async function fetchActivePokes(tokens: Tokens, knownShard?: number | null): Promise<PokesResult | null> {
  const token = tokens.access;
  if (knownShard) {
    const list = await connectShard(knownShard, token, 6000);
    if (list) return { pokes: list, shard: knownShard };
  }
  return scanShards(token, 7000);
}

// Troca o pokemon ATIVO/LIDER via poke-summon numa conexao ONE-SHOT (abre, manda, confirma,
// fecha). So usar quando NAO ha sessao de hunt viva — com hunt rodando, o single-session
// derrubaria a caca, entao o caller manda pelo socket vivo (gameSession.summonActive).
//
// Confirma pelo EFEITO, nao pelo echo (que nem sempre chega): apos o summon, pede `pokes-get`
// e resolve quando a lista volta com o alvo `leader:true`. Devolve a LISTA lida (o caller usa
// pra atualizar o snapshot do time na Conta) ou null se nao confirmou na janela.
export function summonPoke(tokens: Tokens, shard: number, pokeId: string, timeoutMs = 9000): Promise<Record<string, unknown>[] | null> {
  const token = tokens.access;
  return new Promise((resolve) => {
    let settled = false, sent = false;
    let ws: WebSocket;
    const done = (v: Record<string, unknown>[] | null) => { if (settled) return; settled = true; try { ws.close(); } catch { /* noop */ } resolve(v); };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(token)}`);
    } catch { resolve(null); return; }
    const to = setTimeout(() => done(null), timeoutMs);
    const summon = () => {
      if (sent) return; sent = true;
      try { ws.send(JSON.stringify({ type: "poke-summon", pokeId })); } catch { /* noop */ }
      // um beat depois, pede a lista pra confirmar que o lider virou o alvo
      setTimeout(() => { try { ws.send(JSON.stringify({ type: "pokes-get" })); } catch { /* noop */ } }, 500);
    };
    ws.addEventListener("open", () => summon());
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (!sent) return; // ignora o snapshot inicial (antes do summon)
      let j: { type?: string; list?: unknown };
      try { j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as typeof j; } catch { return; }
      if (j?.type === "pokes" && Array.isArray(j.list)) {
        const list = j.list as Record<string, unknown>[];
        const hit = list.find((p) => String(p?.id) === pokeId);
        if (hit && Boolean(hit.leader)) { clearTimeout(to); done(list); }
      }
    });
    ws.addEventListener("close", () => { clearTimeout(to); done(null); });
    ws.addEventListener("error", () => { clearTimeout(to); done(null); });
  });
}

// Move um poke BOX <-> TIME numa conexao ONE-SHOT (poke-withdraw tira do box pro time,
// poke-store guarda no box — frames confirmados por HAR ago/2026; o jogo responde com
// `pokes` atualizado). Mesmo desenho do summonPoke: so usar SEM sessao viva; confirma
// pelo EFEITO (flag `team` do alvo na lista que volta) e devolve a lista lida, ou null.
// Cura o time na enfermeira Joy sem sessao viva: abre, manda `joy-heal`, pede a lista e
// espera o TIME voltar sem ninguem em 0 HP (confirmacao por estado — o ack `joy-healed`
// sozinho nao prova nada). Cura so o time; pokemon no box segue desmaiado. MUTA a conta.
export function healTeamOneShot(tokens: Tokens, shard: number, timeoutMs = 9000): Promise<Record<string, unknown>[] | null> {
  const token = tokens.access;
  return new Promise((resolve) => {
    let settled = false, sent = false;
    let ws: WebSocket;
    const done = (v: Record<string, unknown>[] | null) => { if (settled) return; settled = true; try { ws.close(); } catch { /* noop */ } resolve(v); };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(token)}`);
    } catch { resolve(null); return; }
    const to = setTimeout(() => done(null), timeoutMs);
    ws.addEventListener("open", () => {
      if (sent) return; sent = true;
      try { ws.send(JSON.stringify({ type: "joy-heal" })); } catch { /* noop */ }
      setTimeout(() => { try { ws.send(JSON.stringify({ type: "pokes-get" })); } catch { /* noop */ } }, 500);
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (!sent) return;
      let j: { type?: string; list?: unknown };
      try { j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as typeof j; } catch { return; }
      if (j?.type === "pokes" && Array.isArray(j.list)) {
        const list = j.list as Record<string, unknown>[];
        const team = list.filter((p) => Boolean(p?.team));
        const healed = team.length > 0 && team.every((p) => Number(p?.hp ?? 0) > 0);
        if (healed) { clearTimeout(to); done(list); }
      }
    });
    ws.addEventListener("close", () => { clearTimeout(to); done(null); });
    ws.addEventListener("error", () => { clearTimeout(to); done(null); });
  });
}

export function movePokeOneShot(tokens: Tokens, shard: number, pokeId: string, dir: "store" | "withdraw", timeoutMs = 9000): Promise<Record<string, unknown>[] | null> {
  const token = tokens.access;
  const wantTeam = dir === "withdraw"; // withdraw = entrou no time; store = saiu
  return new Promise((resolve) => {
    let settled = false, sent = false;
    let ws: WebSocket;
    const done = (v: Record<string, unknown>[] | null) => { if (settled) return; settled = true; try { ws.close(); } catch { /* noop */ } resolve(v); };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(token)}`);
    } catch { resolve(null); return; }
    const to = setTimeout(() => done(null), timeoutMs);
    ws.addEventListener("open", () => {
      if (sent) return; sent = true;
      try { ws.send(JSON.stringify({ type: dir === "store" ? "poke-store" : "poke-withdraw", pokeId })); } catch { /* noop */ }
      setTimeout(() => { try { ws.send(JSON.stringify({ type: "pokes-get" })); } catch { /* noop */ } }, 500);
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (!sent) return;
      let j: { type?: string; list?: unknown };
      try { j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as typeof j; } catch { return; }
      if (j?.type === "pokes" && Array.isArray(j.list)) {
        const list = j.list as Record<string, unknown>[];
        const hit = list.find((p) => String(p?.id) === pokeId);
        if (hit && Boolean(hit.team) === wantTeam) { clearTimeout(to); done(list); }
      }
    });
    ws.addEventListener("close", () => { clearTimeout(to); done(null); });
    ws.addEventListener("error", () => { clearTimeout(to); done(null); });
  });
}
