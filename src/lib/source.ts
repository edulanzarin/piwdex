// Fonte de dados do catalogo. O jogo muda por patch de balanceamento e o site tem que
// contar a verdade do MOMENTO — no patch de 20/08/2026 o Ledian saiu de 493 pra 38 de
// ouro por abate (13x), e quem lesse um numero de uma hora atras trocaria de cacada com
// base em ficcao.
//
// A versao anterior revalidava de HORA em HORA e, em qualquer falha, caia CALADA no
// snapshot versionado — que podia estar meses atrasado sem nada na tela dizer isso.
//
// O desenho agora se apoia em tres coisas que a fonte entrega e ninguem estava usando:
//
//   1. `ETag` / `Last-Modified` no creatures.json. Perguntar "mudou?" custa um HEAD de
//      ~30ms e ZERO byte. Entao a checagem de frescor pode ser quase por request, e o
//      download de 1MB so acontece quando o jogo realmente mexeu no catalogo.
//   2. `Last-Modified` e a data do PATCH. E a unica data honesta pra mostrar na tela —
//      a antiga vinha do snapshot e mentia mesmo com dado ao vivo.
//   3. A CDN do jogo guarda o arquivo por 4h (`max-age=14400`). Num patch recente a
//      borda pode responder copia velha, e ai o unico jeito de furar e o cache-buster —
//      caro pro jogo, entao so no "atualizar agora" pedido pelo usuario.
//
// Cair no snapshot continua existindo (o site nao pode quebrar), mas agora e um estado
// VISIVEL: `live: false` + `error` sobem pra UI.

import snapshot from "@/data/piwdex.json";
import type { Attack, Creature, Hunt, Item, Snapshot } from "./types";

const HOST = "https://poke.idleworld.online";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Janela em que confiamos no catalogo sem reperguntar. Curta de proposito: o custo de
 *  perguntar e um HEAD, e o custo de errar e recomendar a cacada errada. Nao e cache de
 *  performance — e uma trava contra rajada de request virar rajada de HEAD no jogo. */
const FRESH_MS = 10_000;

/** Teto de espera da fonte. Passou disso, serve o que tem e nao trava a pagina. */
const TIMEOUT_MS = 12_000;

const SOURCES = {
  creatures: `${HOST}/game/creatures.json`,
  items: `${HOST}/game/items.json`,
  mapMarkers: `${HOST}/api/game/map-markers`,
};

export interface SourceData {
  creatures: Creature[];
  items: Item[];
  hunts: Hunt[];
  /** Quando o JOGO publicou este catalogo (Last-Modified da fonte). Do snapshot, a data
   *  em que ele foi gerado. E a data que a tela mostra. */
  generatedAt: string;
  live: boolean;
  /** Identidade do catalogo (ETag). Muda exatamente quando o jogo muda — e a chave que
   *  invalida toda derivacao memoizada em cima disto. */
  version: string;
  /** Epoch ms da ultima vez que perguntamos "mudou?" a fonte. */
  checkedAt: number;
  /** Por que estamos no snapshot. null = dado do jogo. */
  error: string | null;
}

const headers = { "User-Agent": UA, Accept: "application/json" };

async function get(url: string, bust: boolean): Promise<Response> {
  const target = bust ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}` : url;
  return fetch(target, {
    headers: bust ? { ...headers, "Cache-Control": "no-cache" } : headers,
    cache: "no-store", // o frescor e gerido aqui, nao pelo cache do framework
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function getJson(url: string, bust: boolean): Promise<unknown> {
  const res = await get(url, bust);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

/** Identidade do catalogo agora, sem baixar o corpo. null = a fonte nao respondeu. */
async function probeVersion(): Promise<{ version: string; modified: string | null } | null> {
  try {
    const res = await fetch(SOURCES.creatures, {
      method: "HEAD",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const etag = res.headers.get("etag");
    const modified = res.headers.get("last-modified");
    const version = etag ?? modified;
    return version ? { version, modified } : null;
  } catch {
    return null;
  }
}

const asNum = (v: unknown): number => (typeof v === "number" ? v : 0);

// Normalizacao leve: a fonte omite campos opcionais (type2, evolucao) e, em casos
// raros, campos numericos/arrays. Preenche defaults pra o app confiar no shape.
function normalizeCreatures(src: unknown[]): Creature[] {
  return src.map((raw) => {
    const c = raw as Record<string, unknown>;
    return {
      pokeId: c.pokeId as number,
      name: c.name as string,
      looktype: asNum(c.looktype),
      description: (c.description as string) ?? "",
      type1: c.type1 as Creature["type1"],
      type2: (c.type2 as Creature["type2"]) ?? null,
      rarity: c.rarity as Creature["rarity"],
      baseHp: asNum(c.baseHp),
      baseAtk: asNum(c.baseAtk),
      baseDef: asNum(c.baseDef),
      baseSpAtk: asNum(c.baseSpAtk),
      baseSpDef: asNum(c.baseSpDef),
      baseSpeed: asNum(c.baseSpeed),
      huntLevel: asNum(c.huntLevel),
      evolvesToId: (c.evolvesToId as number | null) ?? null,
      evolveLevel: (c.evolveLevel as number | null) ?? null,
      priceNpc: asNum(c.priceNpc),
      sellValue: asNum(c.sellValue),
      experience: asNum(c.experience),
      loot: Array.isArray(c.loot) ? (c.loot as Creature["loot"]) : [],
      attacks: normalizeAttacks(c.attacks),
      area: (c.area as string | null) ?? null,
      captureBase: (c.captureBase as number | null) ?? null,
    };
  });
}

// `tm` vem da fonte como o TIPO da maquina ("PSYCHIC") e some no golpe natural. Vira
// campo explicito aqui pra o motor poder separar os dois pools — ver Attack em types.ts.
function normalizeAttacks(src: unknown): Attack[] {
  if (!Array.isArray(src)) return [];
  return src.map((raw) => {
    const a = raw as Record<string, unknown>;
    return {
      name: a.name as string,
      type: a.type as Attack["type"],
      category: a.category as Attack["category"],
      power: asNum(a.power),
      cooldownMs: asNum(a.cooldownMs),
      learnLevel: asNum(a.learnLevel),
      tm: (a.tm as Attack["tm"]) ?? null,
    };
  });
}

function fromSnapshot(error: string): SourceData {
  const s = snapshot as unknown as Snapshot;
  return {
    creatures: s.creatures,
    items: s.items,
    hunts: s.hunts,
    generatedAt: s.generatedAt,
    live: false,
    version: `snapshot:${s.generatedAt}`,
    checkedAt: Date.now(),
    error,
  };
}

// Catalogo em memoria do processo. Sobrevive entre requests de proposito: o que expira
// nao e o DADO, e a confianca de que ele ainda e o corrente — e isso se renova com um
// HEAD. Reconstruir tudo a cada request so gastaria banda do jogo pelo mesmo resultado.
let held: SourceData | null = null;
// Uma atualizacao por vez: sem isto, dez requests simultaneos viram dez downloads de 1MB.
let inFlight: Promise<SourceData> | null = null;

async function download(bust: boolean): Promise<SourceData> {
  const probe = await probeVersion();
  const [cRaw, iRaw, mRaw] = await Promise.all([
    getJson(SOURCES.creatures, bust),
    getJson(SOURCES.items, bust),
    getJson(SOURCES.mapMarkers, bust),
  ]);
  const creaturesSrc = (cRaw as { creatures?: unknown[] }).creatures ?? (cRaw as unknown[]);
  const items = (iRaw as { items?: Item[] }).items ?? (iRaw as Item[]);
  const hunts = (mRaw as { hunts?: Hunt[] }).hunts ?? (mRaw as Hunt[]);

  if (!Array.isArray(creaturesSrc) || !creaturesSrc.length) throw new Error("creatures vazio");
  if (!Array.isArray(items) || !items.length) throw new Error("items vazio");
  if (!Array.isArray(hunts) || !hunts.length) throw new Error("hunts vazio");

  const now = Date.now();
  return {
    creatures: normalizeCreatures(creaturesSrc),
    items,
    hunts,
    // a data do PATCH, nao a do nosso snapshot
    generatedAt: probe?.modified ?? new Date(now).toISOString(),
    live: true,
    version: probe?.version ?? `live:${now}`,
    checkedAt: now,
    error: null,
  };
}

async function refresh(force: boolean): Promise<SourceData> {
  // Ja temos catalogo: pergunta ao jogo se ele mudou antes de baixar 1MB de novo.
  if (held && !force) {
    const probe = await probeVersion();
    if (probe && probe.version === held.version) {
      held = { ...held, checkedAt: Date.now() };
      return held;
    }
  }
  try {
    held = await download(force);
    return held;
  } catch (e) {
    const why = e instanceof Error ? e.message : "fonte indisponivel";
    // Dado velho do JOGO ainda e melhor que o snapshot do build — mas para de se dizer
    // ao vivo, pra a tela poder avisar que a fonte caiu.
    if (held?.live) {
      held = { ...held, live: false, checkedAt: Date.now(), error: why };
      return held;
    }
    return fromSnapshot(why);
  }
}

/** Catalogo corrente. `force` refaz o download furando a CDN do jogo (acao do usuario,
 *  nao caminho normal — ver o comentario do cabecalho). */
export async function fetchSource(force = false): Promise<SourceData> {
  const now = Date.now();
  if (!force && held && now - held.checkedAt < FRESH_MS) return held;
  if (!force && inFlight) return inFlight; // rajada de requests -> uma atualizacao so
  const run = refresh(force).finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}
