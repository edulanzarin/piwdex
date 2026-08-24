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

/**
 * Por que a varredura nao achou o shard.
 *
 * Ela abre 64 sockets e espera um frame `pokes`. Quando nenhum vem, `null` era a
 * resposta — e `null` juntava duas coisas que pedem atos OPOSTOS: "o jogo
 * remanejou a conta, tente de novo" e "o seu token morreu, reconecte". A tela
 * dizia "tente de novo em instantes" pro segundo caso, e tentar de novo nao
 * resolve token vencido nunca.
 *
 * O codigo com que cada socket FECHA e a informacao que separa os dois, e ela
 * estava sendo jogada fora. `4003` e o esperado (63 shards recusam assim); `4001`
 * vindo de TODOS significa credencial, e `4004` e recusa de conta.
 */
export type MotivoSemShard = "vencido" | "bloqueado" | "nenhum";

export interface FalhaShard {
  motivo: MotivoSemShard;
  /** o codigo cru do jogo, pra tela poder mostrar o que ninguem traduziu */
  codigo: number | null;
  frase: string | null;
}

export type BuscaShard = { ok: true; dado: ResultadoPokes } | { ok: false; falha: FalhaShard };

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
/**
 * Quantos shards sondar POR VEZ.
 *
 * Era 64 — todos de uma vez. A sondagem paralela e rapida por isso, e foi
 * exatamente isso que quebrou: o jogo conta CONEXOES por endereco, e uma
 * varredura sozinha abria 64 de um IP so. No boot, com varias contas sem shard
 * cacheado, davam centenas ao mesmo tempo.
 *
 * O sintoma era `4006 ip-limit` disparando sem padrao — as vezes com duas contas
 * ligadas, as vezes com cinco. O que variava nao era o numero de contas: era ter
 * ou nao uma varredura no ar naquele instante. Passamos meses achando que o
 * limite era do jogo, e ele era nosso.
 *
 * Seis por lote mantem a descoberta em ~2s no pior caso e cabe em qualquer
 * orcamento de conexao.
 */
const LOTE = 6;

/**
 * Uma varredura POR PROCESSO, de cada vez.
 *
 * Sem isto, seis contas religando no boot varrem juntas e o lote de 6 vira 36 —
 * o problema de volta com outro numero. A fila serializa: cada conta espera a
 * anterior, e o custo disso e segundos, contra um `ip-limit` que custa a sessao.
 */
const globalVarredura = globalThis as unknown as { _piwVarrendo?: Promise<unknown> };

async function naFila<T>(f: () => Promise<T>): Promise<T> {
  const anterior = globalVarredura._piwVarrendo ?? Promise.resolve();
  const minha = anterior.catch(() => {}).then(f);
  globalVarredura._piwVarrendo = minha.catch(() => {});
  return minha;
}

/**
 * Os shards que ja responderam neste processo.
 *
 * Contas do mesmo jogador costumam cair perto, e tentar o que ja funcionou custa
 * um lote em vez de onze. Nao e cache de verdade — e uma ordem de tentativa.
 */
const globalVistos = globalThis as unknown as { _piwShardsVistos?: number[] };

function lembrarShard(n: number): void {
  const l = globalVistos._piwShardsVistos ?? [];
  globalVistos._piwShardsVistos = [n, ...l.filter((x) => x !== n)].slice(0, 8);
}

/** A ordem em que vale sondar: o que ja respondeu primeiro, o resto depois. */
function ordemDeSondagem(): number[] {
  const vistos = globalVistos._piwShardsVistos ?? [];
  const resto: number[] = [];
  for (let n = 1; n <= SHARDS; n++) if (!vistos.includes(n)) resto.push(n);
  return [...vistos, ...resto];
}

/** Sonda UM lote e resolve no primeiro que mandar `pokes`. */
function sondarLote(
  numeros: number[],
  token: string,
  timeoutMs: number,
  codigos: Map<number, number>,
): Promise<ResultadoPokes | null> {
  return new Promise((resolve) => {
    const sockets: WebSocket[] = [];
    let fechado = false;
    const fim = (r: ResultadoPokes | null) => {
      if (fechado) return;
      fechado = true;
      clearTimeout(to);
      // Fechar TODOS: os que sobram sao sessoes abertas na conta do jogador.
      sockets.forEach((w) => { try { w.close(); } catch { /* noop */ } });
      resolve(r);
    };
    const to = setTimeout(() => fim(null), timeoutMs);

    for (const n of numeros) {
      let ws: WebSocket;
      try { ws = new WebSocket(`${WS_BASE}/ws${n}?token=${encodeURIComponent(token)}`); } catch { continue; }
      sockets.push(ws);
      ws.addEventListener("message", (ev: MessageEvent) => {
        try {
          const j = JSON.parse(typeof ev.data === "string" ? ev.data : "") as { type?: string; list?: unknown };
          if (j?.type === "pokes" && Array.isArray(j.list)) {
            lembrarShard(n);
            fim({ pokes: j.list as Record<string, unknown>[], shard: n });
          }
        } catch { /* noop */ }
      });
      ws.addEventListener("close", (ev: CloseEvent) => {
        codigos.set(ev.code, (codigos.get(ev.code) ?? 0) + 1);
      });
      ws.addEventListener("error", () => { /* shard que recusa e o esperado */ });
    }
  });
}

function varrerShards(token: string, timeoutMs: number): Promise<BuscaShard> {
  return naFila(async () => {
    const codigos = new Map<number, number>();
    const ordem = ordemDeSondagem();
    // O orcamento total e o mesmo de antes; o que muda e nao gastar tudo de uma
    // vez. Por lote, o suficiente pro jogo responder o snapshot.
    const porLote = Math.max(1200, Math.floor(timeoutMs / Math.ceil(SHARDS / LOTE)));

    for (let i = 0; i < ordem.length; i += LOTE) {
      const achado = await sondarLote(ordem.slice(i, i + LOTE), token, porLote, codigos);
      if (achado) return { ok: true, dado: achado } as BuscaShard;
      // 4001/4004 em massa nao melhoram no proximo lote: e credencial, e nao
      // shard. Continuar varreria 64 sockets pra colecionar o mesmo nao.
      if (codigos.has(4001) || codigos.has(4004)) break;
    }

    const motivo: MotivoSemShard = codigos.has(4004)
      ? "bloqueado"
      : codigos.has(4001)
        ? "vencido"
        : "nenhum";
    return {
      ok: false,
      falha: { motivo, codigo: codigos.has(4004) ? 4004 : codigos.has(4001) ? 4001 : null, frase: null },
    } as BuscaShard;
  });
}

/**
 * Le os pokemons da conta e, de brinde, descobre o shard.
 *
 * Tenta o shard cacheado primeiro (1 conexao). So varre quando ele falha — o que
 * acontece na primeira conexao e quando o jogo remaneja a conta.
 */
export async function lerPokes(tokens: Tokens, shardConhecido?: number | null): Promise<ResultadoPokes | null> {
  const r = await buscarPokes(tokens, shardConhecido);
  return r.ok ? r.dado : null;
}

/** A mesma busca, com o MOTIVO quando falha. Quem precisa dizer ao usuario o que
 *  fazer a seguir chama esta; quem so quer a lista chama `lerPokes`. */
export async function buscarPokes(
  tokens: Tokens,
  shardConhecido?: number | null,
): Promise<BuscaShard> {
  if (shardConhecido) {
    const lista = await abrirShard(shardConhecido, tokens.access, 6000);
    if (lista) return { ok: true, dado: { pokes: lista, shard: shardConhecido } };
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
