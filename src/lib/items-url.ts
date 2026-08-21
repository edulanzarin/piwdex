// Serializacao da pergunta dos Itens na URL — o mesmo contrato da dex
// (`dex-url.ts`): filtro mora na URL pra o F5 nao apagar oito ajustes, pra o
// botao voltar desfazer o ultimo filtro em vez de sair da pagina, e pra "olha
// esse aqui" virar link em vez de print.
//
// Chaves curtas, e escreve-se so o que DIFERE do padrao: a URL limpa e
// `/itens`, nao `/itens?q=&c=&o=...`.

import {
  EMPTY_ITEM_QUERY,
  type ItemCategory,
  type ItemOrigin,
  type ItemQuery,
  type ItemSortKey,
} from "./items";

export type ItemView = "grid" | "table";

export interface ItemsState {
  query: ItemQuery;
  sort: ItemSortKey;
  dir: "asc" | "desc";
  view: ItemView;
  page: number;
}

export const DEFAULT_ITEMS_STATE: ItemsState = {
  query: EMPTY_ITEM_QUERY,
  sort: "name",
  dir: "asc",
  view: "grid",
  page: 0,
};

const list = (s: string | null): string[] =>
  s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];

const range = (s: string | null): [number | null, number | null] => {
  if (!s) return [null, null];
  const [lo, hi] = s.split("-");
  const num = (v: string | undefined) => {
    if (v == null || v === "" || v === "*") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return [num(lo), num(hi)];
};

const rangeStr = ([lo, hi]: [number | null, number | null]): string | null =>
  lo == null && hi == null ? null : `${lo ?? "*"}-${hi ?? "*"}`;

export function parseItemsState(sp: URLSearchParams): ItemsState {
  const by = Number(sp.get("by"));
  const query: ItemQuery = {
    q: sp.get("q") ?? "",
    categories: list(sp.get("c")) as ItemCategory[],
    origins: list(sp.get("o")) as ItemOrigin[],
    onlyRare: sp.get("rare") === "1",
    onlyFarmable: sp.get("farm") === "1",
    price: range(sp.get("pr")),
    chance: range(sp.get("ch")),
    farmLevel: range(sp.get("fl")),
    sources: range(sp.get("src")),
    droppedBy: Number.isFinite(by) && by > 0 ? by : null,
  };

  const page = Number(sp.get("p") ?? "1");

  return {
    query,
    sort: (sp.get("sort") as ItemSortKey) ?? "name",
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
    view: sp.get("view") === "table" ? "table" : "grid",
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
  };
}

export function buildItemsSearch(s: ItemsState): string {
  const p = new URLSearchParams();
  const { query: q } = s;

  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.categories.length) p.set("c", q.categories.join(","));
  if (q.origins.length) p.set("o", q.origins.join(","));
  if (q.onlyRare) p.set("rare", "1");
  if (q.onlyFarmable) p.set("farm", "1");

  const ranges: [string, [number | null, number | null]][] = [
    ["pr", q.price], ["ch", q.chance], ["fl", q.farmLevel], ["src", q.sources],
  ];
  for (const [key, r] of ranges) {
    const v = rangeStr(r);
    if (v) p.set(key, v);
  }

  if (q.droppedBy != null) p.set("by", String(q.droppedBy));

  if (s.sort !== "name") p.set("sort", s.sort);
  if (s.dir !== "asc") p.set("dir", s.dir);
  if (s.view !== "grid") p.set("view", s.view);
  if (s.page > 0) p.set("p", String(s.page + 1));

  const str = p.toString();
  return str ? `?${str}` : "";
}
