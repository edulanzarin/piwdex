// Motor dos Itens: o que se pode PERGUNTAR sobre um item.
//
// Espelha o desenho de `dex.ts` — derivar UMA vez no servidor, filtrar barato
// no cliente — mas a pergunta central e OUTRA. Na dex se pergunta "quem e este
// pokemon"; aqui se pergunta **"de onde vem este item"**, e essa e a pergunta
// que nem o jogo nem o piwtools respondem: o catalogo so sabe dizer "o
// Bulbasaur dropa Bulb", nunca o contrario.
//
// O indice reverso ja existe em `data.ts` (`dropSourcesOf`). O que este arquivo
// acrescenta e o JUIZO em cima dele:
//
//   - fonte com maior chance nao e a mesma coisa que MELHOR fonte. 54 itens
//     caem de alguem que nao tem ponto no mapa (so evolui, so vem de loja) —
//     "dropa" e "da pra farmar" sao coisas diferentes e a tela tem de separar.
//   - o numero que decide se vale parar pra pegar nao e a chance crua, e quanto
//     de ouro o item soma POR ABATE na melhor fonte farmavel.

import type { Creature, Item } from "./types";

/** Tira acento pra busca — mesma normalizacao dos dois lados (indice e digitado).
 *  Sem isso "pedra psiquica" nao acha "Pedra Psíquica" e a lista volta vazia com
 *  o item bem ali. */
const semAcento = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Categoria do item, como a fonte declara. Categoria desconhecida cai em
 *  `misc` — patch novo do jogo nao pode quebrar o filtro. */
export type ItemCategory =
  | "loot" | "stone" | "heal" | "revive" | "clan" | "tm" | "card" | "misc";

export const ALL_CATEGORIES: ItemCategory[] = [
  "loot", "stone", "heal", "revive", "clan", "tm", "card", "misc",
];

const CATEGORY_SET = new Set<string>(ALL_CATEGORIES);

/**
 * De onde o item vem (derivado, nao vem do jogo) — o irmao de `Acquisition`
 * das especies:
 *   drop    = alguma especie do catalogo dropa
 *   shop    = nao cai de ninguem, mas se compra com ouro
 *   special = nao cai nem se compra -> altar, cla, evento, shiny
 */
export type ItemOrigin = "drop" | "shop" | "special";

/** Uma fonte do item, resumida pro card e pra a lista. A tabela completa da
 *  ficha nao passa por aqui — ela sai do indice no servidor. */
export interface ItemSourceBrief {
  id: number;
  name: string;
  /** ja em porcentagem real (a fonte guarda 0..100000) */
  chancePct: number;
  minCount: number;
  maxCount: number;
  /** nivel de caca da especie */
  level: number;
}

/**
 * Um item, ja com tudo que filtro, ordem e card precisam.
 *
 * FLAT como o `DexEntry`, e pelo mesmo motivo: as 2.657 linhas do indice
 * reverso nao cabem no payload de um grid. O que vai pro navegador e o
 * VEREDITO (quantas fontes, a melhor delas, o nivel minimo), nao a tabela.
 */
export interface ItemEntry {
  id: number;
  name: string;
  icon: string;
  category: ItemCategory;
  rare: boolean;
  /** o que o Mark paga por unidade */
  npcPrice: number;
  /** preco em ouro na loja; 0 = nao se compra */
  goldPrice: number;
  /** cura em pontos de vida; 0 = nao cura */
  healAmount: number;
  /** fracao de vida devolvida ao reviver (0.5 = metade); 0 = nao revive */
  revivePct: number;
  description: string;

  origin: ItemOrigin;
  /** quantas especies dropam */
  sources: number;
  /** quantas dessas tem ponto de caca no mapa */
  farmSources: number;
  /** fonte de maior chance, farmavel ou nao */
  best: ItemSourceBrief | null;
  /** fonte de maior chance ENTRE AS FARMAVEIS — a que se pode de fato cacar */
  bestFarm: ItemSourceBrief | null;
  /** menor nivel de caca entre as fontes farmaveis; null = nao da pra farmar */
  minFarmLevel: number | null;
  /**
   * Ouro que o item soma a UM abate na melhor fonte farmavel:
   * `chance x quantidade media x preco de NPC`.
   *
   * E o numero que responde "vale parar pra pegar?". Um item de 1.344 de venda
   * que cai 94% das vezes rende mais por abate que um de 50.000 que cai 0,4% —
   * e a chance crua sozinha nao mostra isso.
   */
  goldPerKill: number;
  /** pokeIds que dropam — sustenta o filtro "o que o Bulbasaur dropa" */
  sourceIds: number[];
  /** nome + categoria + descricao, normalizado pra busca */
  haystack: string;
}

const asCategory = (raw: string): ItemCategory =>
  CATEGORY_SET.has(raw) ? (raw as ItemCategory) : "misc";

/** Quantidade media por drop — a ponte entre "cai 1-3" e um numero que se soma. */
const avgCount = (s: ItemSourceBrief): number => (s.minCount + s.maxCount) / 2;

/** Quantos abates, na media, pra sair UMA unidade nessa fonte. */
export const killsPerUnit = (s: ItemSourceBrief): number =>
  s.chancePct > 0 ? 100 / (s.chancePct * avgCount(s)) : Infinity;

/**
 * Monta os campos derivados de UM item. Roda no servidor, uma vez por versao do
 * catalogo.
 *
 * `sourcesOf` entrega o indice reverso ja pronto (`data.ts`), e `spotsOf` diz
 * se a especie tem ponto no mapa — a diferenca entre "dropa" e "da pra farmar".
 */
export function buildItemEntry(
  item: Item,
  ctx: {
    sourcesOf: (name: string) => { creature: Creature; chancePct: number; minCount: number; maxCount: number }[];
    spotsOf: (c: Creature) => number;
  },
): ItemEntry {
  const raw = ctx.sourcesOf(item.name);

  const all: ItemSourceBrief[] = [];
  const farm: ItemSourceBrief[] = [];
  for (const s of raw) {
    const brief: ItemSourceBrief = {
      id: s.creature.pokeId,
      name: s.creature.name,
      chancePct: s.chancePct,
      minCount: s.minCount,
      maxCount: s.maxCount,
      level: s.creature.huntLevel,
    };
    all.push(brief);
    if (ctx.spotsOf(s.creature) > 0) farm.push(brief);
  }

  const pickBest = (list: ItemSourceBrief[]): ItemSourceBrief | null =>
    list.reduce<ItemSourceBrief | null>(
      (best, s) => (best == null || s.chancePct > best.chancePct ? s : best),
      null,
    );

  const best = pickBest(all);
  const bestFarm = pickBest(farm);
  const goldPrice = item.priceGold ?? 0;

  // Mesma escada do `acquisitionOf` das especies: cai de alguem -> vem da loja
  // -> nao vem de nenhum dos dois, entao e exclusivo (altar, cla, evento).
  const origin: ItemOrigin =
    all.length > 0 ? "drop" : goldPrice > 0 ? "shop" : "special";

  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    category: asCategory(item.category),
    rare: Boolean(item.rare),
    npcPrice: item.npcPrice ?? 0,
    goldPrice,
    healAmount: item.healAmount ?? 0,
    revivePct: item.revivePct ?? 0,
    description: item.description ?? "",
    origin,
    sources: all.length,
    farmSources: farm.length,
    best,
    bestFarm,
    minFarmLevel: farm.length ? Math.min(...farm.map((s) => s.level)) : null,
    goldPerKill: bestFarm
      ? (bestFarm.chancePct / 100) * avgCount(bestFarm) * (item.npcPrice ?? 0)
      : 0,
    sourceIds: all.map((s) => s.id),
    // a descricao entra na busca de proposito: e o unico texto que diz PRA QUE
    // serve o item ("estimula os instintos durante o breeding"), e sem ela
    // procurar "breeding" no catalogo de itens devolve zero.
    haystack: semAcento(`${item.name} ${item.category} ${item.description ?? ""}`),
  };
}

// ---------------------------------------------------------------------------
// A pergunta
// ---------------------------------------------------------------------------

export interface ItemQuery {
  q: string;
  categories: ItemCategory[];
  origins: ItemOrigin[];
  /** so os marcados como raros pelo jogo */
  onlyRare: boolean;
  /** so o que tem alguma fonte com ponto no mapa */
  onlyFarmable: boolean;
  /** faixa fechada [min, max]; null = extremo aberto */
  price: [number | null, number | null];
  /** chance (%) na melhor fonte */
  chance: [number | null, number | null];
  /** nivel de caca da fonte farmavel mais baixa — "o que da pra farmar no meu nivel" */
  farmLevel: [number | null, number | null];
  sources: [number | null, number | null];
  /** pokeId — o indice reverso ao contrario: "o que ESTA especie dropa" */
  droppedBy: number | null;
}

export const EMPTY_ITEM_QUERY: ItemQuery = {
  q: "",
  categories: [],
  origins: [],
  onlyRare: false,
  onlyFarmable: false,
  price: [null, null],
  chance: [null, null],
  farmLevel: [null, null],
  sources: [null, null],
  droppedBy: null,
};

export function activeCount(q: ItemQuery): number {
  let n = 0;
  if (q.q.trim()) n++;
  if (q.categories.length) n++;
  if (q.origins.length) n++;
  if (q.onlyRare) n++;
  if (q.onlyFarmable) n++;
  if (q.price[0] != null || q.price[1] != null) n++;
  if (q.chance[0] != null || q.chance[1] != null) n++;
  if (q.farmLevel[0] != null || q.farmLevel[1] != null) n++;
  if (q.sources[0] != null || q.sources[1] != null) n++;
  if (q.droppedBy != null) n++;
  return n;
}

const inRange = (v: number, [lo, hi]: [number | null, number | null]): boolean =>
  (lo == null || v >= lo) && (hi == null || v <= hi);

export function matches(e: ItemEntry, q: ItemQuery): boolean {
  if (q.q.trim() && !e.haystack.includes(semAcento(q.q.trim()))) return false;
  if (q.categories.length && !q.categories.includes(e.category)) return false;
  if (q.origins.length && !q.origins.includes(e.origin)) return false;
  if (q.onlyRare && !e.rare) return false;
  if (q.onlyFarmable && e.farmSources === 0) return false;

  if (!inRange(e.npcPrice, q.price)) return false;
  if (!inRange(e.best?.chancePct ?? 0, q.chance)) return false;
  if (!inRange(e.sources, q.sources)) return false;

  // Item sem fonte farmavel nao tem nivel — e nao pode passar num filtro de
  // nivel so porque `null` viraria 0 e cairia dentro de qualquer faixa.
  if (q.farmLevel[0] != null || q.farmLevel[1] != null) {
    if (e.minFarmLevel == null) return false;
    if (!inRange(e.minFarmLevel, q.farmLevel)) return false;
  }

  if (q.droppedBy != null && !e.sourceIds.includes(q.droppedBy)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// A ordem
// ---------------------------------------------------------------------------

export type ItemSortKey =
  | "name" | "id" | "category" | "price" | "gold"
  | "sources" | "chance" | "farmLevel" | "goldPerKill";

export const ITEM_SORT_LABEL: Record<ItemSortKey, string> = {
  name: "Nome",
  id: "Id do jogo",
  category: "Categoria",
  price: "Valor de NPC",
  gold: "Preço em ouro",
  sources: "Quantas fontes",
  chance: "Chance na melhor fonte",
  farmLevel: "Nível pra farmar",
  goldPerKill: "Ouro por abate",
};

function sortValue(e: ItemEntry, key: ItemSortKey): number | string {
  switch (key) {
    case "name": return e.name.toLowerCase();
    case "id": return e.id;
    case "category": return e.category;
    case "price": return e.npcPrice;
    case "gold": return e.goldPrice;
    case "sources": return e.sources;
    case "chance": return e.best?.chancePct ?? 0;
    // Sem fonte farmavel vai pro FIM em ordem crescente, nao pro comeco: "a
    // partir do nivel 1" e uma afirmacao, e um item que nao se farma nao a faz.
    case "farmLevel": return e.minFarmLevel ?? Infinity;
    case "goldPerKill": return e.goldPerKill;
  }
}

export function sortEntries(
  list: ItemEntry[],
  key: ItemSortKey,
  dir: "asc" | "desc",
): ItemEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * sign;
    }
    // Empate desempata pelo NOME (e nao pelo id): a lista de itens se le em
    // ordem alfabetica, e id de item do jogo nao tem significado pro leitor.
    if (va === vb || (!Number.isFinite(va) && !Number.isFinite(vb))) {
      return a.name.localeCompare(b.name);
    }
    return (va - vb) * sign;
  });
}

// ---------------------------------------------------------------------------
// Extremos — as reguas dos controles de faixa
// ---------------------------------------------------------------------------

export interface ItemBounds {
  price: [number, number];
  chance: [number, number];
  farmLevel: [number, number];
  sources: [number, number];
}

export function computeItemBounds(entries: ItemEntry[]): ItemBounds {
  const b: ItemBounds = {
    price: [0, 0],
    chance: [0, 100],
    farmLevel: [Infinity, -Infinity],
    sources: [0, 0],
  };
  for (const e of entries) {
    if (e.npcPrice > b.price[1]) b.price[1] = e.npcPrice;
    if (e.sources > b.sources[1]) b.sources[1] = e.sources;
    if (e.minFarmLevel != null) {
      if (e.minFarmLevel < b.farmLevel[0]) b.farmLevel[0] = e.minFarmLevel;
      if (e.minFarmLevel > b.farmLevel[1]) b.farmLevel[1] = e.minFarmLevel;
    }
  }
  // Catalogo vazio (fonte fora do ar) nao pode devolver Infinity pro slider.
  if (!Number.isFinite(b.farmLevel[0])) b.farmLevel = [0, 0];
  if (b.price[1] === 0) b.price = [0, 1];
  if (b.sources[1] === 0) b.sources = [0, 1];
  return b;
}

export function countBy<K extends string>(
  entries: ItemEntry[],
  pick: (e: ItemEntry) => K | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const k = pick(e);
    if (k != null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dois itens que APONTAM pra outra coisa do catalogo
// ---------------------------------------------------------------------------
//
// Carta de shiny e disco de TM nao caem de ninguem, entao o indice reverso nao
// tem nada a dizer sobre eles — e sem isto a ficha deles fica em branco. Mas os
// dois carregam a resposta no PROPRIO NOME: "Shiny Venusaur Card" e do Venusaur,
// "Fire-Type TM Disk" e a maquina de Fogo. Sao funcoes puras de string; quem
// resolve pro dado e a pagina, que tem o catalogo na mao.

/** Especie de uma carta de shiny, ou null se o item nao for carta.
 *
 *  A comparacao ignora tudo que nao e letra ou numero: o item se chama
 *  "Shiny Farfetch'd Card" e a especie, "Farfetchd" — com apostrofo no meio,
 *  1 das 52 cartas ficaria orfa. */
export function cardSpeciesName(itemName: string): string | null {
  const m = /^Shiny (.+) Card$/i.exec(itemName.trim());
  return m ? m[1] : null;
}

/** Chave de comparacao de nome proprio entre as duas metades do catalogo. */
export const nameKey = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Tipo da maquina de TM, ou null (o "AoE TM Disk" nao tem tipo). */
export function tmDiskType(itemName: string): string | null {
  const m = /^([A-Za-z]+)-Type TM Disk$/i.exec(itemName.trim());
  return m ? m[1].toUpperCase() : null;
}
