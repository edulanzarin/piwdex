// Motor da Pokedex: o que se pode PERGUNTAR ao catalogo.
//
// Separado da tela de proposito. A tela decide como o filtro aparece; aqui mora
// o que ele significa. Duas consequencias praticas: a mesma pergunta serve o
// grid, a tabela e (depois) a rota de hunt sem reescrever nada, e a regra fica
// num lugar so quando o jogo mudar.
//
// O desenho e "derivar UMA vez, filtrar barato": cada especie vira um `DexEntry`
// com os campos que os filtros precisam ja calculados (total de stats, melhor
// golpe, estagio evolutivo, fraquezas, nomes de loot). Recalcular "o melhor
// golpe do Alakazam" a cada tecla digitada na busca, 434 vezes, e o que faz
// filtro parecer travado.

import type { Acquisition, Creature, PokeType, Rarity } from "./types";
import { ALL_TYPES, effectiveness } from "./typing";
import { qualityTier } from "./rarity";
import { TYPE_LABEL } from "./labels";

/**
 * Tira acento pra busca.
 *
 * Traduzir os tipos criou um problema que a versao em ingles nao tinha:
 * "Psíquico" so era encontrado digitando o acento, e ninguem digita acento em
 * caixa de busca — "psiquico" devolvia ZERO com 49 especies na lista. A
 * normalizacao roda nos DOIS lados (no indice e no que o usuario digitou),
 * senao a metade sem acento continua sem casar.
 */
const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Onde a especie fica na propria linha evolutiva. */
export type Stage = "solo" | "base" | "mid" | "final";

/**
 * Uma especie, ja com tudo que filtro, ordem e card precisam.
 *
 * E FLAT de proposito: nao carrega a `Creature` inteira. A ficha completa
 * (golpes, loot com %, descricao) e outra pagina e busca o seu proprio dado —
 * mandar os 40 golpes e os 2.657 registros de loot de todas as especies pro
 * navegador so pra desenhar um grid custa ~1MB de payload por visita, e nada
 * disso aparece no card.
 */
export interface DexEntry {
  id: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
  /** ordem canonica: hp, atk, def, spAtk, spDef, speed */
  stats: [number, number, number, number, number, number];
  statTotal: number;
  /** nivel do ponto de caca da especie */
  level: number;
  /** XP por abate */
  xp: number;
  /** valor efetivo mostrado na UI: `sellValue`, caindo pra `priceNpc` quando
   *  zero (18 exclusivos, ex. Aerodactyl). */
  value: number;
  /** O `value` veio do FALLBACK, e nao do que a especie paga por abate.
   *
   *  Os dois numeros NAO sao a mesma grandeza e nao se comparam: `sellValue` e
   *  o que o jogo te paga pelo pokemon; `priceNpc` e o preco do cassino. Sem esta
   *  bandeira, um ranking de "paga mais por abate" coroa o Aerodactyl com 6,5
   *  bilhoes — que e o que ele CUSTA, e ele nem se caca (sellValue 0). Quem
   *  mostra o numero declara qual eixo esta mostrando. */
  valueFromNpc: boolean;
  /** poder do melhor golpe NATURAL (o que todo jogador tem) */
  bestNatural: number;
  /** poder do melhor golpe incluindo TM (o teto com maquina) */
  bestWithTm: number;
  hasTm: boolean;
  stage: Stage;
  /** quantos estagios tem a linha inteira */
  chainLength: number;
  acquisition: Acquisition;
  /** quantos pontos de caca tem no mapa */
  spots: number;
  dropCount: number;
  /** tipos que batem >1x nela (defesa) */
  weakTo: PokeType[];
  /** tipos que ela aguenta (<1x, inclui imunidade) */
  resists: PokeType[];
  /** nomes dos itens que ela dropa, minusculo — pro filtro "quem dropa X" */
  lootNames: string[];
  region: "base" | "orre";
  /** variante de skin fora do conjunto jogavel (Brave Blastoise e cia) */
  variant: boolean;
  /** texto ja normalizado pra busca (nome + numero + tipos) */
  haystack: string;
}

/** Especie JOGAVEL: as 48 variantes de skin fora de Orre nao sao linha propria
 *  do catalogo (apontam pra base e compartilham tudo). As de Orre apontam pra
 *  base mas tem stats proprios, entao contam. Da as 434. */
export const isPlayable = (c: Creature): boolean =>
  c.captureBase == null || c.area === "orre";

/** Monta os campos derivados de UMA especie. Roda no servidor, uma vez por
 *  versao do catalogo — nunca por tecla digitada na busca. */
export function buildEntry(
  c: Creature,
  ctx: {
    spotsOf: (c: Creature) => number;
    acquisitionOf: (c: Creature) => Acquisition;
    chainOf: (c: Creature) => { pokeId: number }[];
  },
): DexEntry {
  const stats: DexEntry["stats"] = [
    c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed,
  ];

  let bestNatural = 0;
  let bestWithTm = 0;
  let hasTm = false;
  for (const a of c.attacks) {
    if (a.power > bestWithTm) bestWithTm = a.power;
    // TM e golpe de MAQUINA: entra num pool separado porque nem todo jogador
    // tem a maquina, e incluir no padrao promete um DPS que ele nao possui.
    if (a.tm) hasTm = true;
    else if (a.power > bestNatural) bestNatural = a.power;
  }

  const chain = ctx.chainOf(c);
  const at = chain.findIndex((s) => s.pokeId === c.pokeId);
  const stage: Stage =
    chain.length <= 1 ? "solo"
    : at === 0 ? "base"
    : at === chain.length - 1 ? "final"
    : "mid";

  const weakTo: PokeType[] = [];
  const resists: PokeType[] = [];
  for (const atk of ALL_TYPES) {
    const m = effectiveness(atk, c.type1, c.type2);
    if (m > 1) weakTo.push(atk);
    else if (m < 1) resists.push(atk);
  }

  return {
    id: c.pokeId,
    name: c.name,
    type1: c.type1,
    type2: c.type2,
    rarity: c.rarity,
    stats,
    statTotal: stats.reduce((a, b) => a + b, 0),
    level: c.huntLevel,
    xp: c.experience,
    value: c.sellValue > 0 ? c.sellValue : c.priceNpc,
    valueFromNpc: c.sellValue <= 0,
    bestNatural,
    bestWithTm,
    hasTm,
    stage,
    chainLength: chain.length,
    acquisition: ctx.acquisitionOf(c),
    spots: ctx.spotsOf(c),
    dropCount: c.loot.length,
    weakTo,
    resists,
    lootNames: c.loot.map((l) => l.name.toLowerCase()),
    region: c.area === "orre" ? "orre" : "base",
    variant: !isPlayable(c),
    // inclui o tipo nos DOIS idiomas (a tela mostra "Fogo", entao "fogo" tem de
    // achar) e SEM acento, pra "psiquico" casar com "Psíquico"
    haystack: semAcento(
      `${c.name} ${c.pokeId} ${c.type1} ${c.type2 ?? ""} ${TYPE_LABEL[c.type1]} ${
        c.type2 ? TYPE_LABEL[c.type2] : ""
      } ${c.area ?? ""}`,
    ),
  };
}

// ---------------------------------------------------------------------------
// A pergunta
// ---------------------------------------------------------------------------

export interface DexQuery {
  q: string;
  types: PokeType[];
  /** "any" = qualquer um dos tipos marcados; "all" = todos ao mesmo tempo.
   *  Sao perguntas diferentes: "Fogo OU Voador" traz 60, "Fogo E Voador" traz 6. */
  typeMode: "any" | "all";
  rarities: Rarity[];
  acquisitions: Acquisition[];
  stages: Stage[];
  /** "base" = catalogo normal, "orre" = regiao de endgame */
  regions: ("base" | "orre")[];
  /** faixa fechada [min, max]; null = extremo aberto */
  level: [number | null, number | null];
  value: [number | null, number | null];
  statTotal: [number | null, number | null];
  xp: [number | null, number | null];
  /** poder do melhor golpe, no pool escolhido */
  power: [number | null, number | null];
  /** o pool que "melhor golpe" considera. Natural e o padrao porque e o que
   *  todo jogador tem — TM muda o melhor golpe em 164 das 482 especies. */
  movePool: "natural" | "tm";
  /** so quem tem alguma TM */
  onlyTm: boolean;
  /** so quem tem ponto de caca no mapa */
  onlySpots: boolean;
  /** especies FRACAS a estes tipos (util pra montar time) */
  weakTo: PokeType[];
  /** especies que RESISTEM a estes tipos */
  resistTo: PokeType[];
  /** nome exato do item — o indice reverso, "quem dropa isso" */
  drops: string | null;
  /** DESLIGADO por decisao de produto — a dex mostra o catalogo inteiro (482),
   *  variantes de skin incluidas, e cada uma se identifica pelo selo no card em
   *  vez de sumir atras de uma chave. Esconder metade do catalogo por padrao
   *  fazia a busca por "Brave Blastoise" devolver nada sem explicar por que.
   *  O campo fica no tipo pro filtro poder voltar sem migrar URL salva. */
  includeVariants: boolean;
}

export const EMPTY_QUERY: DexQuery = {
  q: "",
  types: [],
  typeMode: "any",
  rarities: [],
  acquisitions: [],
  stages: [],
  regions: [],
  level: [null, null],
  value: [null, null],
  statTotal: [null, null],
  xp: [null, null],
  power: [null, null],
  movePool: "natural",
  onlyTm: false,
  onlySpots: false,
  weakTo: [],
  resistTo: [],
  drops: null,
  includeVariants: true,
};

/** Quantos filtros estao ligados — o numero que o botao "limpar" mostra. Sem
 *  isso um filtro esquecido numa gaveta fechada parece lista quebrada. */
export function activeCount(q: DexQuery): number {
  let n = 0;
  if (q.q.trim()) n++;
  if (q.types.length) n++;
  if (q.rarities.length) n++;
  if (q.acquisitions.length) n++;
  if (q.stages.length) n++;
  if (q.regions.length) n++;
  if (q.level[0] != null || q.level[1] != null) n++;
  if (q.value[0] != null || q.value[1] != null) n++;
  if (q.statTotal[0] != null || q.statTotal[1] != null) n++;
  if (q.xp[0] != null || q.xp[1] != null) n++;
  if (q.power[0] != null || q.power[1] != null) n++;
  if (q.onlyTm) n++;
  if (q.onlySpots) n++;
  if (q.weakTo.length) n++;
  if (q.resistTo.length) n++;
  if (q.drops) n++;
  return n;
}

const inRange = (v: number, [lo, hi]: [number | null, number | null]): boolean =>
  (lo == null || v >= lo) && (hi == null || v <= hi);

export function matches(e: DexEntry, q: DexQuery): boolean {
  if (q.q.trim()) {
    // o que o usuario digitou passa pela MESMA normalizacao do indice
    if (!e.haystack.includes(semAcento(q.q.trim()))) return false;
  }

  if (q.types.length) {
    const mine = e.type2 ? [e.type1, e.type2] : [e.type1];
    // "Fogo OU Voador" traz 60; "Fogo E Voador" traz 6. Sao perguntas
    // diferentes e as duas sao legitimas — por isso o modo e do usuario.
    const ok = q.typeMode === "all"
      ? q.types.every((t) => mine.includes(t))
      : q.types.some((t) => mine.includes(t));
    if (!ok) return false;
  }

  if (q.rarities.length && !q.rarities.includes(e.rarity)) return false;
  if (q.acquisitions.length && !q.acquisitions.includes(e.acquisition)) return false;
  if (q.stages.length && !q.stages.includes(e.stage)) return false;
  if (q.regions.length && !q.regions.includes(e.region)) return false;

  if (!inRange(e.level, q.level)) return false;
  if (!inRange(e.value, q.value)) return false;
  if (!inRange(e.statTotal, q.statTotal)) return false;
  if (!inRange(e.xp, q.xp)) return false;
  if (!inRange(q.movePool === "tm" ? e.bestWithTm : e.bestNatural, q.power)) return false;

  if (q.onlyTm && !e.hasTm) return false;
  if (q.onlySpots && e.spots === 0) return false;

  // Fraqueza/resistencia sao filtros TATICOS: "me mostre quem apanha de Fogo"
  // e a pergunta de quem monta time, e o catalogo nunca respondeu isso.
  // Marcar dois tipos pede AMBOS — quem procura cobertura quer o que apanha
  // dos dois, nao a uniao (que devolveria meio catalogo).
  if (q.weakTo.length && !q.weakTo.every((t) => e.weakTo.includes(t))) return false;
  if (q.resistTo.length && !q.resistTo.every((t) => e.resists.includes(t))) return false;

  if (q.drops && !e.lootNames.includes(q.drops.toLowerCase())) return false;

  return true;
}

// ---------------------------------------------------------------------------
// A ordem
// ---------------------------------------------------------------------------

export type SortKey =
  | "dex" | "name" | "level" | "value" | "xp" | "statTotal"
  | "hp" | "atk" | "def" | "spAtk" | "spDef" | "speed"
  | "power" | "xpPerLevel" | "spots";

export const SORT_LABEL: Record<SortKey, string> = {
  dex: "Número da dex",
  name: "Nome",
  level: "Nível de caça",
  value: "Valor de venda",
  xp: "XP por abate",
  xpPerLevel: "XP por nível",
  statTotal: "Total de stats",
  power: "Melhor golpe",
  spots: "Locais de caça",
  hp: "Vida",
  atk: "Ataque",
  def: "Defesa",
  spAtk: "Ataque especial",
  spDef: "Defesa especial",
  speed: "Velocidade",
};

function sortValue(e: DexEntry, key: SortKey, pool: DexQuery["movePool"]): number | string {
  switch (key) {
    case "dex": return e.id;
    case "name": return e.name.toLowerCase();
    case "level": return e.level;
    case "value": return e.value;
    case "xp": return e.xp;
    case "statTotal": return e.statTotal;
    case "hp": return e.stats[0];
    case "atk": return e.stats[1];
    case "def": return e.stats[2];
    case "spAtk": return e.stats[3];
    case "spDef": return e.stats[4];
    case "speed": return e.stats[5];
    case "power": return pool === "tm" ? e.bestWithTm : e.bestNatural;
    case "spots": return e.spots;
    // Rendimento, nao volume bruto: um pokemon de 300 XP no nivel 10 rende mais
    // que um de 900 no nivel 90 — ordenar pelo XP cru esconde exatamente isso.
    case "xpPerLevel": return e.level > 0 ? e.xp / e.level : 0;
  }
}

export function sortEntries(
  list: DexEntry[],
  key: SortKey,
  dir: "asc" | "desc",
  pool: DexQuery["movePool"] = "natural",
): DexEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const va = sortValue(a, key, pool);
    const vb = sortValue(b, key, pool);
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * sign;
    }
    // Empate desempata pelo numero da dex — senao a ordem muda entre renders e
    // o grid pisca linhas de lugar sem nada ter mudado.
    if (va === vb) return a.id - b.id;
    return (va - vb) * sign;
  });
}

// ---------------------------------------------------------------------------
// Extremos do catalogo — as reguas dos controles de faixa
// ---------------------------------------------------------------------------

export interface DexBounds {
  level: [number, number];
  value: [number, number];
  statTotal: [number, number];
  xp: [number, number];
  power: [number, number];
  /** maior stat individual do catalogo (informativo) */
  maxStat: number;
  /**
   * Teto das barras de stat. E um PERCENTIL (p98), nao o maximo.
   *
   * Medido no catalogo: mediana 65, p98 130, maximo 255 — e so 0,7% dos stats
   * passam de 150. Com o maximo como teto, 99,3% das barras vivem no primeiro
   * terco da altura e a "espinha" do card vira uma faixa chapada que nao
   * distingue um muro de uma flecha, que era o unico motivo dela existir.
   *
   * O teto e do CATALOGO (nao da pagina filtrada) pra o mesmo pokemon ter a mesma
   * barra em qualquer tela. Quem passa do teto satura em 100% e precisa ser
   * MARCADO pela UI — barra cheia sem marca faz 140 e 255 parecerem iguais.
   */
  statCeiling: number;
}

/** As chaves de DexBounds que sao faixa [min, max]. */
type RangeKey = "level" | "value" | "statTotal" | "xp" | "power";

export function computeBounds(entries: DexEntry[]): DexBounds {
  const b: DexBounds = {
    level: [Infinity, -Infinity],
    value: [Infinity, -Infinity],
    statTotal: [Infinity, -Infinity],
    xp: [Infinity, -Infinity],
    power: [Infinity, -Infinity],
    maxStat: 0,
    statCeiling: 1,
  };
  const allStats: number[] = [];
  for (const e of entries) {
    // So as chaves de FAIXA — `maxStat`/`statCeiling` sao numeros soltos.
    const pairs: [RangeKey, number][] = [
      ["level", e.level],
      ["value", e.value],
      ["statTotal", e.statTotal],
      ["xp", e.xp],
      ["power", e.bestWithTm],
    ];
    for (const [k, v] of pairs) {
      if (v < b[k][0]) b[k][0] = v;
      if (v > b[k][1]) b[k][1] = v;
    }
    for (const st of e.stats) {
      if (st > b.maxStat) b.maxStat = st;
      allStats.push(st);
    }
  }
  // Catalogo vazio (fonte fora do ar) nao pode devolver Infinity pro slider.
  for (const k of ["level", "value", "statTotal", "xp", "power"] as const) {
    if (!Number.isFinite(b[k][0])) b[k] = [0, 0];
  }
  if (b.maxStat === 0) b.maxStat = 1;

  // p98 arredondado pra dezena — regua redonda se le melhor que "131".
  allStats.sort((x, y) => x - y);
  const p98 = allStats.length ? allStats[Math.floor(allStats.length * 0.98)] : 0;
  b.statCeiling = Math.max(10, Math.ceil(p98 / 10) * 10);

  return b;
}

/** Contagem por tipo no conjunto atual — o numero que aparece no menu de filtro.
 *  Filtro que mostra "FAIRY 12" evita o clique que devolve lista vazia. */
export function countByType(entries: DexEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    for (const t of e.type2 ? [e.type1, e.type2] : [e.type1]) {
      out[t] = (out[t] ?? 0) + 1;
    }
  }
  return out;
}

export function countBy<K extends string>(
  entries: DexEntry[],
  pick: (e: DexEntry) => K | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const k = pick(e);
    if (k != null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Papel de combate lido dos stats — o "pra que serve" que o catalogo nao diz.
 *  Regra: um stat vira papel quando passa 15% da media dos seis. */
export function rolesOf(e: DexEntry): string[] {
  const cut = (e.statTotal / 6) * 1.15;
  const [hp, atk, def, spAtk, spDef, speed] = e.stats;
  const roles: string[] = [];
  if (atk >= cut && atk >= spAtk) roles.push("FISICO");
  // "SP.ATK", nao "Especial": a aquisicao ja usa a palavra Especial pra
  // "vem de loja/cassino/ovo". Mesma palavra com dois sentidos no mesmo card
  // e o tipo de colisao que faz o leitor desconfiar do resto.
  if (spAtk >= cut && spAtk > atk) roles.push("SP.ATK");
  if (def >= cut || spDef >= cut) roles.push("TANQUE");
  if (hp >= cut) roles.push("VIDA");
  if (speed >= cut) roles.push("VELOZ");
  return roles;
}

/** Reexporta pra a tela nao precisar conhecer rarity.ts direto. */
export { qualityTier };
