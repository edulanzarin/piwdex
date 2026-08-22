// A pergunta da Hunt na URL.
//
// Mesmo contrato da dex, dos itens e da calculadora. Aqui ele pesa mais que nos
// outros: a resposta desta tela depende de UM pokemon especifico (espécie, nível,
// quality e os seis stats) somado a um cenário (VIP, TM, Tipo do Dia, bola). Sem
// isso no link, "cacça o Kingler ate o 60" vira print — com isso, vira uma URL que
// o outro abre e continua mexendo.
//
// O que NAO entra: pagina da tabela e nada mais. Padrao omitido, como nas outras
// telas, pra o link curto continuar curto.

import type { MovePool } from "./combat";
import type { RouteMode } from "./combat";
import type { HuntSort } from "./hunt";
import type { PokeType } from "./types";

export type HuntView = "ranking" | "rota";

export interface HuntState {
  /** pokeId do SEU pokemon; null = nada escolhido */
  id: number | null;
  level: number;
  quality: number;
  /** os seis stats como o jogo mostra; tudo zero = usa o IV medio */
  stats: number[];
  pool: MovePool;
  vip: boolean;
  view: HuntView;
  /** o que a ROTA persegue; o ranking ordena por coluna */
  mode: RouteMode;
  /** contar a captura no ouro (o jogo gasta uma bola por abate) */
  cap: boolean;
  /** chave da bola usada na conta de captura */
  ball: string;
  /** tipo premiado hoje; "" = nenhum */
  day: PokeType | "";
  /** nivel alvo da rota */
  target: number;
  /** filtros do ranking */
  type: PokeType | "";
  area: string;
  maxLvl: number | null;
  /** esconde hunt que te derruba antes de 2 abates */
  safe: boolean;
  sort: HuntSort;
  dir: "asc" | "desc";
  page: number;
}

export const EMPTY_HUNT: HuntState = {
  id: null,
  level: 50,
  quality: 1,
  stats: [0, 0, 0, 0, 0, 0],
  pool: "natural",
  vip: false,
  view: "rota",
  mode: "xp",
  cap: false,
  ball: "poke",
  day: "",
  target: 100,
  type: "",
  area: "",
  maxLvl: null,
  safe: false,
  sort: "xp",
  dir: "desc",
  page: 0,
};

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const oneOf = <T extends string>(v: string | null, valid: readonly T[], fallback: T): T =>
  (valid as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

const VIEWS = ["rota", "ranking"] as const;
const MODES = ["xp", "gold"] as const;
const POOLS = ["natural", "tm"] as const;
const SORTS = ["xp", "gold", "kos", "eff", "risk", "level", "name"] as const;

export function parseHuntState(sp: URLSearchParams): HuntState {
  const id = Number(sp.get("p"));
  const raw = (sp.get("s") ?? "").split("-");
  const maxLvl = sp.get("ate");
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    level: Math.max(1, num(sp.get("lv"), EMPTY_HUNT.level)),
    quality: Math.max(0, num(sp.get("q"), EMPTY_HUNT.quality)),
    stats: Array.from({ length: 6 }, (_, i) => Math.max(0, num(raw[i] ?? null, 0))),
    pool: oneOf(sp.get("golpes"), POOLS, EMPTY_HUNT.pool),
    vip: sp.get("vip") === "1",
    view: oneOf(sp.get("v"), VIEWS, EMPTY_HUNT.view),
    mode: oneOf(sp.get("m"), MODES, EMPTY_HUNT.mode),
    cap: sp.get("cap") === "1",
    ball: sp.get("bola") ?? EMPTY_HUNT.ball,
    day: (sp.get("dia") ?? "") as PokeType | "",
    target: Math.max(2, num(sp.get("alvo"), EMPTY_HUNT.target)),
    type: (sp.get("t") ?? "") as PokeType | "",
    area: sp.get("area") ?? "",
    maxLvl: maxLvl != null && maxLvl !== "" ? Math.max(1, num(maxLvl, 1)) : null,
    safe: sp.get("seg") === "1",
    sort: oneOf(sp.get("ord"), SORTS, EMPTY_HUNT.sort),
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    page: Math.max(0, num(sp.get("pg"), 0)),
  };
}

export function buildHuntSearch(s: HuntState): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | boolean, padrao: string | number | boolean) => {
    if (v !== padrao) p.set(k, typeof v === "boolean" ? "1" : String(v));
  };
  if (s.id != null) p.set("p", String(s.id));
  put("lv", s.level, EMPTY_HUNT.level);
  put("q", s.quality, EMPTY_HUNT.quality);
  if (s.stats.some((v) => v > 0)) p.set("s", s.stats.join("-"));
  put("golpes", s.pool, EMPTY_HUNT.pool);
  put("vip", s.vip, false);
  put("v", s.view, EMPTY_HUNT.view);
  put("m", s.mode, EMPTY_HUNT.mode);
  put("cap", s.cap, false);
  put("bola", s.ball, EMPTY_HUNT.ball);
  put("dia", s.day, "");
  put("alvo", s.target, EMPTY_HUNT.target);
  put("t", s.type, "");
  put("area", s.area, "");
  if (s.maxLvl != null) p.set("ate", String(s.maxLvl));
  put("seg", s.safe, false);
  put("ord", s.sort, EMPTY_HUNT.sort);
  put("dir", s.dir, EMPTY_HUNT.dir);
  put("pg", s.page, 0);
  const str = p.toString();
  return str ? `?${str}` : "";
}
