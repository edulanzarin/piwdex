import { GAME_HOST } from "./host";
import type { Tokens } from "./auth";

/**
 * Conexoes AVULSAS ao WebSocket do jogo — abre, faz uma coisa, fecha.
 *
 * O WebSocket **e** a sessao de jogo: conectar chuta a aba aberta do jogador
 * ("conta em uso"), e a conexao mais nova ganha. Por isso tudo aqui e one-shot e
 * so pode ser usado quando NAO ha sessao de hunt viva — com a cacada rodando, o
 * mesmo comando tem que sair pelo socket que ja esta aberto, senao o robo derruba
 * a si mesmo.
 *
 * ## O shard
 *
 * A URL e `wss://.../ws<N>?token=<JWT>`, e o N e POR CONTA. Nenhum campo da API
 * revela qual e o seu: conectar no errado fecha com code 4003 "wrong-shard".
 * Descobre-se sondando os 64 EM PARALELO e resolvendo no primeiro que responder
 * — ~300ms contra os ~20s de uma varredura sequencial. Depois disso o numero e
 * cacheado no vinculo, e a sondagem so volta a acontecer se ele mudar.
 *
 * Server-only: usa o WebSocket global do Node.
 */

const WS_BASE = GAME_HOST.replace(/^http/, "ws");
const SHARDS = 64;

export interface ResultadoPokes {
  pokes: Record<string, unknown>[];
  shard: number;
}

/** Abre UM shard e resolve com a lista de `pokes` (ou null se fechar/expirar). */
function abrirShard(shard: number, token: string, timeoutMs: number): Promise<Record<string, unknown>[] | null> {
  return new Promise((resolve) => {
    let fechado = false;
    let ws: WebSocket;
    const fim = (v: Record<string, unknown>[] | null) => {
      if (fechado) return;
      fechado = true;
      try { ws.close(); } catch { /* ja fechado */ }
      resolve(v);
    };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(token)}`);
    } catch {
      resolve(null);
      return;
    }
    const to = setTimeout(() => fim(null), timeoutMs);
    ws.addEventListener("message", (ev: MessageEvent) => {
      try {
        const j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as { type?: string; list?: unknown };
        if (j?.type === "pokes" && Array.isArray(j.list)) {
          clearTimeout(to);
          fim(j.list as Record<string, unknown>[]);
        }
      } catch { /* frame nao-json */ }
    });
    ws.addEventListener("close", () => { clearTimeout(to); fim(null); }); // wrong-shard fecha rapido
    ws.addEventListener("error", () => { clearTimeout(to); fim(null); });
  });
}

/** Varre os 64 em paralelo e resolve no primeiro que mandar `pokes`. */
function varrerShards(token: string, timeoutMs: number): Promise<ResultadoPokes | null> {
  return new Promise((resolve) => {
    const sockets: WebSocket[] = [];
    let fechado = false;
    const fim = (r: ResultadoPokes | null) => {
      if (fechado) return;
      fechado = true;
      // Fechar TODOS: os 63 restantes sao sessoes abertas na conta do jogador.
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
          if (j?.type === "pokes" && Array.isArray(j.list)) {
            fim({ pokes: j.list as Record<string, unknown>[], shard: n });
          }
        } catch { /* noop */ }
      });
      ws.addEventListener("error", () => { /* shard que recusa e o esperado: 63 deles */ });
    }
    setTimeout(() => fim(null), timeoutMs);
  });
}

/**
 * Le os pokemons da conta e, de brinde, descobre o shard.
 *
 * Tenta o shard cacheado primeiro (1 conexao). So varre quando ele falha — o que
 * acontece na primeira conexao e quando o jogo remaneja a conta.
 */
export async function lerPokes(tokens: Tokens, shardConhecido?: number | null): Promise<ResultadoPokes | null> {
  if (shardConhecido) {
    const lista = await abrirShard(shardConhecido, tokens.access, 6000);
    if (lista) return { pokes: lista, shard: shardConhecido };
  }
  return varrerShards(tokens.access, 7000);
}

/**
 * Manda um comando e espera o EFEITO — nunca o ack.
 *
 * Essa e a licao mais cara do v1 neste arquivo: o `poke-summon` respondia com um
 * echo que nem sempre chegava, e esperar por ele dava 502 numa acao que tinha
 * funcionado. Confirmar relendo o estado (`pokes-get`) e testando o que se
 * queria mudar sempre funciona, e ainda devolve a lista fresca de brinde.
 */
function comandarEConferir(
  tokens: Tokens,
  shard: number,
  comando: Record<string, unknown>,
  confirma: (lista: Record<string, unknown>[]) => boolean,
  timeoutMs = 9000,
): Promise<Record<string, unknown>[] | null> {
  return new Promise((resolve) => {
    let fechado = false;
    let enviado = false;
    let ws: WebSocket;
    const fim = (v: Record<string, unknown>[] | null) => {
      if (fechado) return;
      fechado = true;
      try { ws.close(); } catch { /* noop */ }
      resolve(v);
    };
    try {
      ws = new WebSocket(`${WS_BASE}/ws${shard}?token=${encodeURIComponent(tokens.access)}`);
    } catch {
      resolve(null);
      return;
    }
    const to = setTimeout(() => fim(null), timeoutMs);
    ws.addEventListener("open", () => {
      if (enviado) return;
      enviado = true;
      try { ws.send(JSON.stringify(comando)); } catch { /* noop */ }
      // Um beat depois, pede a lista: e ela que confirma.
      setTimeout(() => { try { ws.send(JSON.stringify({ type: "pokes-get" })); } catch { /* noop */ } }, 500);
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (!enviado) return; // ignora o snapshot que chega antes do comando
      let j: { type?: string; list?: unknown };
      try { j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as typeof j; } catch { return; }
      if (j?.type === "pokes" && Array.isArray(j.list)) {
        const lista = j.list as Record<string, unknown>[];
        if (confirma(lista)) { clearTimeout(to); fim(lista); }
      }
    });
    ws.addEventListener("close", () => { clearTimeout(to); fim(null); });
    ws.addEventListener("error", () => { clearTimeout(to); fim(null); });
  });
}

/** Troca o pokemon ATIVO/LIDER (o que caca). Muta a conta. */
export function invocarLider(tokens: Tokens, shard: number, pokeId: string) {
  return comandarEConferir(
    tokens, shard,
    { type: "poke-summon", pokeId },
    (l) => { const p = l.find((x) => String(x?.id) === pokeId); return !!p && Boolean(p.leader); },
  );
}

/**
 * A enfermeira Joy: cura o TIME, de graca. O BOX nao — pokemon guardado segue
 * desmaiado depois do `joy-healed`.
 *
 * Confirma pelo estado (ninguem no time com 0 HP) e nao pelo ack: `joy-healed`
 * sozinho nao prova nada. E ela so funciona NA CIDADE — com o char em campo a
 * cura nao levanta o lider desmaiado, que foi o que fez o robo do v1 "curar" em
 * loop com o pokemon caido no chao. Quem chama tem que mandar `leave-hunt` antes.
 */
export function curarTime(tokens: Tokens, shard: number) {
  return comandarEConferir(
    tokens, shard,
    { type: "joy-heal" },
    (l) => {
      const time = l.filter((p) => Boolean(p?.team));
      return time.length > 0 && time.every((p) => Number(p?.hp ?? 0) > 0);
    },
  );
}

/** Move um poke entre o BOX e o TIME. */
export function moverPoke(tokens: Tokens, shard: number, pokeId: string, dir: "store" | "withdraw") {
  const querNoTime = dir === "withdraw";
  return comandarEConferir(
    tokens, shard,
    { type: dir === "store" ? "poke-store" : "poke-withdraw", pokeId },
    (l) => { const p = l.find((x) => String(x?.id) === pokeId); return !!p && Boolean(p.team) === querNoTime; },
  );
}
