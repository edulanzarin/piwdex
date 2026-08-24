// A pergunta do Meta na URL. Mesmo contrato das outras telas.
//
// O que precisa viajar no link: a vista, o pool de golpes (ele troca o ranking
// INTEIRO, entao mandar a tier list sem dizer o pool e mandar outra tier list), o
// recorte da busca, o perfil aberto e os dois lados do duelo.

import type { MovePool, Tier } from "./meta";
import type { PokeType } from "./types";

export type MetaView = "tiers" | "duelo" | "tipos";

export interface MetaState {
  view: MetaView;
  pool: MovePool;
  /** busca por nome na tier list */
  q: string;
  type: PokeType | "";
  tier: Tier | "";
  /** pokeId do perfil aberto; null = nenhum */
  focus: number | null;
  /** duelo: os dois lados */
  a: number | null;
  aLv: number;
  aQ: number;
  b: number | null;
  bLv: number;
  bQ: number;
  /** o lado B e um selvagem de hunt (HP x5, dano x1.8) */
  wild: boolean;
  /** IV usado nos dois lados do duelo */
  iv: "medio" | "perfeito";
  /** incluir lendarios na lista. Padrao: nao — ver `playableSet` */
  lendarios: boolean;
}

export const EMPTY_META: MetaState = {
  view: "tiers",
  pool: "natural",
  q: "",
  type: "",
  tier: "",
  focus: null,
  a: null,
  aLv: 100,
  aQ: 1,
  b: null,
  bLv: 100,
  bQ: 1,
  wild: false,
  iv: "medio",
  lendarios: false,
};

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const id = (v: string | null): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const oneOf = <T extends string>(v: string | null, valid: readonly T[], fallback: T): T =>
  (valid as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

const VIEWS = ["tiers", "duelo", "tipos"] as const;
const POOLS = ["natural", "tm"] as const;
const IVS = ["medio", "perfeito"] as const;
const TIER_VALUES = ["S", "A", "B", "C", "D", "E"] as const;

export function parseMetaState(sp: URLSearchParams): MetaState {
  return {
    view: oneOf(sp.get("v"), VIEWS, EMPTY_META.view),
    pool: oneOf(sp.get("golpes"), POOLS, EMPTY_META.pool),
    q: sp.get("q") ?? "",
    type: (sp.get("t") ?? "") as PokeType | "",
    tier: oneOf(sp.get("tier"), TIER_VALUES, "" as Tier | "") as Tier | "",
    focus: id(sp.get("p")),
    a: id(sp.get("a")),
    aLv: Math.max(1, num(sp.get("alv"), EMPTY_META.aLv)),
    aQ: Math.max(0, num(sp.get("aq"), EMPTY_META.aQ)),
    b: id(sp.get("b")),
    bLv: Math.max(1, num(sp.get("blv"), EMPTY_META.bLv)),
    bQ: Math.max(0, num(sp.get("bq"), EMPTY_META.bQ)),
    wild: sp.get("selvagem") === "1",
    lendarios: sp.get("lendarios") === "1",
    iv: oneOf(sp.get("iv"), IVS, EMPTY_META.iv),
  };
}

export function buildMetaSearch(s: MetaState): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | boolean, padrao: string | number | boolean) => {
    if (v !== padrao) p.set(k, typeof v === "boolean" ? "1" : String(v));
  };
  put("v", s.view, EMPTY_META.view);
  put("golpes", s.pool, EMPTY_META.pool);
  put("q", s.q, "");
  put("t", s.type, "");
  put("tier", s.tier, "");
  if (s.focus != null) p.set("p", String(s.focus));
  if (s.a != null) p.set("a", String(s.a));
  put("alv", s.aLv, EMPTY_META.aLv);
  put("aq", s.aQ, EMPTY_META.aQ);
  if (s.b != null) p.set("b", String(s.b));
  put("blv", s.bLv, EMPTY_META.bLv);
  put("bq", s.bQ, EMPTY_META.bQ);
  put("selvagem", s.wild, false);
  put("lendarios", s.lendarios, false);
  put("iv", s.iv, EMPTY_META.iv);
  const str = p.toString();
  return str ? `?${str}` : "";
}
