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

/** Fonte caiu: repergunta no maximo uma vez por minuto. Sem isso, cada visita paga o
 *  timeout inteiro de novo — com a fonte fora do ar a pagina levava ate 24s por visita. */
const ESPERA_APOS_FALHA_MS = 60_000;

/** A sonda (HEAD) parou de responder mas o catalogo em memoria continua bom: espaca a
 *  pergunta em vez de baixar 1,6 MB no escuro. */
const SONDA_CEGA_MS = 5 * 60_000;

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

/**
 * Identidade do catalogo agora, sem baixar o corpo.
 *
 * O retorno tem TRES estados, e nao dois, porque "nao sei" nao e "mudou". Antes um
 * `catch {}` devolvia null pra qualquer erro (DNS, TLS, timeout, 405) e o chamador
 * tratava null como versao diferente — ou seja, baixava tudo. Se a CDN do jogo
 * passasse a recusar HEAD (405/403 e comportamento comum e fora do nosso controle),
 * o mecanismo de ETag inteiro deixava de existir SEM UMA LINHA DE LOG: o site
 * passaria a baixar ~1,6 MB a cada janela de 10s, indefinidamente, contra o
 * servidor do jogo, e o unico sintoma apareceria na conta de banda deles.
 */
type Sonda =
  | { ok: true; version: string; modified: string | null }
  | { ok: false; why: string };

/** Estado da ultima sonda cega, pra o aviso sair UMA vez por transicao e nao a cada
 *  request — log que repete a cada 10s vira ruido e ninguem le. */
let sondaCega = false;

async function sondarVersao(): Promise<Sonda> {
  try {
    const res = await fetch(SOURCES.creatures, {
      method: "HEAD",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, why: `HEAD -> ${res.status}` };
    const etag = res.headers.get("etag");
    const modified = res.headers.get("last-modified");
    const version = etag ?? modified;
    if (!version) return { ok: false, why: "sem ETag nem Last-Modified" };
    if (sondaCega) {
      console.warn("[piwdex] sonda de versao voltou a funcionar");
      sondaCega = false;
    }
    return { ok: true, version, modified };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : "HEAD falhou" };
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

/** O catalogo do build, com o motivo de termos caido nele. Exportado porque a
 *  degradacao nao e so de REDE: se a derivacao quebrar em cima de um registro novo do
 *  jogo, o `data.ts` tambem precisa de um chao pra pisar. */
export function fromSnapshot(error: string): SourceData {
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
/** Epoch ms antes do qual nao vale a pena reperguntar a fonte. Ver `fetchSource`. */
let reperguntarEm = 0;

async function download(bust: boolean): Promise<SourceData> {
  const sonda = await sondarVersao();
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

  // ---- piso de plausibilidade ----
  // "Array nao vazio" aceita um arquivo de 3 especies do mesmo jeito que aceita 482.
  // Toda a maquinaria de fallback cobria "a fonte nao respondeu"; nada cobria "a fonte
  // respondeu LIXO". Um creatures.json publicado pela metade passava, o `version` novo
  // invalidava toda derivacao memoizada, e o site servia uma dex de 3 especies com o
  // selo AO VIVO e a data do patch — sem nada acionar o snapshot.
  //
  // A regua e o snapshot versionado: patch legitimo nunca corta metade do catalogo,
  // arquivo truncado sempre corta. O `throw` cai no caminho de degradacao que ja
  // existe, entao o custo e uma comparacao por endpoint.
  const base = snapshot as unknown as Snapshot;
  const piso = (nome: string, veio: number, tinha: number) => {
    if (veio < tinha * 0.5) throw new Error(`${nome} implausivel: ${veio} contra ${tinha} do snapshot`);
  };
  piso("creatures", creaturesSrc.length, base.creatures.length);
  piso("items", items.length, base.items.length);
  piso("hunts", hunts.length, base.hunts.length);

  const now = Date.now();
  return {
    creatures: normalizeCreatures(creaturesSrc),
    items,
    hunts,
    // a data do PATCH, nao a do nosso snapshot
    generatedAt: (sonda.ok ? sonda.modified : null) ?? new Date(now).toISOString(),
    live: true,
    // Sem ETag o `version` cai num carimbo de tempo, que muda a cada download e
    // invalida toda derivacao memoizada — e o preco de nao ter identidade de catalogo.
    version: sonda.ok ? sonda.version : `live:${now}`,
    checkedAt: now,
    error: null,
  };
}

const eSnapshot = (d: SourceData): boolean => d.version.startsWith("snapshot:");

async function refresh(force: boolean): Promise<SourceData> {
  // Ja temos catalogo do jogo: pergunta se ele mudou antes de baixar 1MB de novo.
  if (held && !force && !eSnapshot(held)) {
    const sonda = await sondarVersao();

    if (sonda.ok && sonda.version === held.version) {
      // Sonda que responde e PROVA de que a fonte esta viva. Antes esta linha era
      // `{ ...held, checkedAt }`, preservando `live` e `error` do objeto anterior — e
      // como so um patch do jogo muda o ETag, um 502 transitorio deixava o site
      // anunciando "SNAPSHOT / fonte caiu" por horas com a fonte perfeitamente de pe.
      // `live` reflete a ULTIMA CONFERENCIA, nao o ultimo download.
      held = { ...held, live: true, error: null, checkedAt: Date.now() };
      reperguntarEm = Date.now() + FRESH_MS;
      return held;
    }

    if (!sonda.ok) {
      // Nao saber se mudou NAO e motivo pra baixar 1,6 MB. Segura o que tem e espaca
      // a proxima pergunta — se a CDN parou de aceitar HEAD, isso e degradacao de
      // desempenho, nao de correcao, e nao pode virar rajada contra o jogo.
      if (!sondaCega) {
        console.warn(`[piwdex] sonda de versao indisponivel (${sonda.why}) — segurando o catalogo em memoria`);
        sondaCega = true;
      }
      held = { ...held, checkedAt: Date.now() };
      reperguntarEm = Date.now() + SONDA_CEGA_MS;
      return held;
    }
    // sonda.ok e versao diferente: o jogo mexeu no catalogo. Cai no download.
  }

  try {
    held = await download(force);
    reperguntarEm = Date.now() + FRESH_MS;
    return held;
  } catch (e) {
    const why = e instanceof Error ? e.message : "fonte indisponivel";

    // Dado do JOGO em memoria ganha do snapshot do build SEMPRE — inclusive na segunda
    // falha seguida. A condicao antiga era `if (held?.live)`, entao na segunda falha
    // `held.live` ja era false e a funcao devolvia o snapshot, DESCARTANDO o catalogo
    // do jogo que ainda estava ali: o site caia de "dado de um minuto atras" pro
    // arquivo do build. Quem decide e a procedencia do dado, nao o selo.
    held = held && !eSnapshot(held)
      ? { ...held, live: false, checkedAt: Date.now(), error: why }
      : { ...fromSnapshot(why), checkedAt: Date.now() };

    // A falha tambem precisa ser GRAVADA em `held`. Antes o ramo do snapshot nao
    // reescrevia nada, entao `checkedAt` congelava e a trava de frescor nunca mais
    // engatava: toda request seguinte reentrava aqui e pagava o timeout inteiro de
    // novo. Com a fonte fora do ar, isso e a pagina inteira travando por 24s por
    // visita. Fonte caida se repergunta uma vez por minuto, nao uma vez por request.
    reperguntarEm = Date.now() + ESPERA_APOS_FALHA_MS;
    return held;
  }
}

/** Catalogo corrente. `force` refaz o download furando a CDN do jogo (acao do usuario,
 *  nao caminho normal — ver o comentario do cabecalho). */
export async function fetchSource(force = false): Promise<SourceData> {
  // A cadencia vive numa variavel so (`reperguntarEm`) em vez de sair de
  // `checkedAt + FRESH_MS`: sao TRES ritmos diferentes — 10s no caminho normal, 5min
  // quando a sonda cegou, 1min quando a fonte caiu — e derivar os tres de um campo de
  // dado misturava "quando perguntei" com "quando vale perguntar de novo".
  if (!force && held && Date.now() < reperguntarEm) return held;
  if (!force && inFlight) return inFlight; // rajada de requests -> uma atualizacao so
  const run = refresh(force).finally(() => {
    if (inFlight === run) inFlight = null;
  });
  inFlight = run;
  return run;
}
