// Serializacao da pergunta da dex na URL.
//
// Filtro mora na URL, nao em `useState` solto. O motivo nao e purismo: sem isso
// o F5 perde 8 filtros ajustados a mao, o botao voltar do navegador sai da
// pagina em vez de desfazer o ultimo filtro, e "olha esse aqui" vira um print
// em vez de um link. Com isso, a busca inteira e compartilhavel.
//
// As chaves sao curtas de proposito — a URL de um filtro rico fica legivel
// (`?t=FIRE&lv=1-40&sort=xp`) em vez de virar um paragrafo.

import type { Acquisition, PokeType, Rarity } from "./types";
import { EMPTY_QUERY, type DexQuery, type SortKey, type Stage } from "./dex";

export type ViewMode = "grid" | "table";

export interface DexState {
  query: DexQuery;
  sort: SortKey;
  dir: "asc" | "desc";
  view: ViewMode;
  page: number;
}

export const DEFAULT_STATE: DexState = {
  query: EMPTY_QUERY,
  sort: "dex",
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

export function parseState(sp: URLSearchParams): DexState {
  const q: DexQuery = {
    q: sp.get("q") ?? "",
    types: list(sp.get("t")) as PokeType[],
    typeMode: sp.get("tm") === "all" ? "all" : "any",
    rarities: list(sp.get("r")) as Rarity[],
    acquisitions: list(sp.get("a")) as Acquisition[],
    stages: list(sp.get("s")) as Stage[],
    regions: list(sp.get("g")) as ("base" | "orre")[],
    level: range(sp.get("lv")),
    value: range(sp.get("vl")),
    statTotal: range(sp.get("st")),
    xp: range(sp.get("xp")),
    power: range(sp.get("pw")),
    movePool: sp.get("pool") === "tm" ? "tm" : "natural",
    onlyTm: sp.get("hastm") === "1",
    onlySpots: sp.get("spot") === "1",
    weakTo: list(sp.get("w")) as PokeType[],
    resistTo: list(sp.get("rs")) as PokeType[],
    drops: sp.get("d"),
    includeVariants: sp.get("var") === "1",
  };

  const page = Number(sp.get("p") ?? "1");

  return {
    query: q,
    sort: (sp.get("sort") as SortKey) ?? "dex",
    dir: sp.get("dir") === "desc" ? "desc" : "asc",
    view: sp.get("view") === "table" ? "table" : "grid",
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
  };
}

/**
 * Escreve so o que DIFERE do padrao. A URL limpa e `/dex`, nao
 * `/dex?q=&t=&r=&...` — parametro vazio polui o historico e da a impressao de
 * que ha filtro ligado quando nao ha.
 */
export function buildSearch(s: DexState): string {
  const p = new URLSearchParams();
  const { query: q } = s;

  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.types.length) p.set("t", q.types.join(","));
  if (q.typeMode !== "any") p.set("tm", q.typeMode);
  if (q.rarities.length) p.set("r", q.rarities.join(","));
  if (q.acquisitions.length) p.set("a", q.acquisitions.join(","));
  if (q.stages.length) p.set("s", q.stages.join(","));
  if (q.regions.length) p.set("g", q.regions.join(","));

  const ranges: [string, [number | null, number | null]][] = [
    ["lv", q.level], ["vl", q.value], ["st", q.statTotal],
    ["xp", q.xp], ["pw", q.power],
  ];
  for (const [key, r] of ranges) {
    const v = rangeStr(r);
    if (v) p.set(key, v);
  }

  if (q.movePool !== "natural") p.set("pool", q.movePool);
  if (q.onlyTm) p.set("hastm", "1");
  if (q.onlySpots) p.set("spot", "1");
  if (q.weakTo.length) p.set("w", q.weakTo.join(","));
  if (q.resistTo.length) p.set("rs", q.resistTo.join(","));
  if (q.drops) p.set("d", q.drops);
  if (q.includeVariants) p.set("var", "1");

  if (s.sort !== "dex") p.set("sort", s.sort);
  if (s.dir !== "asc") p.set("dir", s.dir);
  if (s.view !== "grid") p.set("view", s.view);
  if (s.page > 0) p.set("p", String(s.page + 1));

  const str = p.toString();
  return str ? `?${str}` : "";
}
