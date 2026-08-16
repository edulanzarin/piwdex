import { type Tokens } from "./game-auth";

// Pokemons individuais ATIVOS via WebSocket. O jogo nao expoe isso na REST — o time
// e a colecao (com IV/quality/power por individuo) so chegam pelo WS, que fica num
// SHARD especifico por conta: wss://.../ws<N>?token=<JWT>. Conectar no shard errado
// fecha com code 4003 "wrong-shard". O shard e descoberto por sondagem e cacheado.
//
// Server-only (usa o WebSocket global do Node). Importar so de route handlers.

const GAME = process.env.GAME_HOST || "https://poke.idleworld.online";
const WS_BASE = GAME.replace(/^http/, "ws");
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
