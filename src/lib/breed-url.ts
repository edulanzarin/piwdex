// A pergunta do Breeding na URL.
//
// Mesmo contrato da dex, dos itens e da calculadora. Aqui o argumento é o mais
// forte de todos: um par de breeding é uma DECISÃO que se discute com outra
// pessoa ("vale queimar esses dois?"), e sem a URL isso vira print de tela com
// doze números que ninguém confere.
//
// A estante de pokémon salvos NÃO entra aqui — ela é a coleção pessoal de quem
// abriu o site, mora no `localStorage` e não tem por que viajar num link.

import type { BreedMode } from "./breeding";

export interface ParentState {
  /** pokeId da espécie; null = slot vazio */
  id: number | null;
  quality: number;
  /** os seis IVs, ordem canônica */
  ivs: number[];
  shiny: boolean;
}

export interface BreedState {
  a: ParentState;
  b: ParentState;
  mode: BreedMode;
  /** Double Stones: 40 pedras em vez de 20 */
  double: boolean;
  /** nível da projeção de stats do ovo */
  level: number;
  /** Quality alvo do planejador */
  target: number;
}

export const EMPTY_PARENT: ParentState = {
  id: null,
  quality: 1,
  ivs: [0, 0, 0, 0, 0, 0],
  shiny: false,
};

export const EMPTY_BREED: BreedState = {
  a: EMPTY_PARENT,
  b: EMPTY_PARENT,
  mode: "free",
  double: false,
  level: 100,
  target: 2.6,
};

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const trava = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function parseParent(sp: URLSearchParams, lado: "a" | "b"): ParentState {
  const id = Number(sp.get(lado));
  const ivs = (sp.get(`${lado}v`) ?? "").split("-");
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    quality: trava(num(sp.get(`${lado}q`), EMPTY_PARENT.quality), 0, 999),
    ivs: Array.from({ length: 6 }, (_, i) => Math.round(trava(num(ivs[i] ?? null, 0), 0, 32))),
    shiny: sp.get(`${lado}s`) === "1",
  };
}

export function parseBreedState(sp: URLSearchParams): BreedState {
  return {
    a: parseParent(sp, "a"),
    b: parseParent(sp, "b"),
    mode: sp.get("m") === "pher" ? "pheromone" : "free",
    double: sp.get("ds") === "1",
    level: Math.max(1, Math.round(num(sp.get("lv"), EMPTY_BREED.level))),
    // Shiny não tem teto conhecido, então o campo aceita acima de 2.600 — mas um
    // alvo absurdo só serve pra travar a conta do planejador.
    target: trava(num(sp.get("alvo"), EMPTY_BREED.target), 0, 10),
  };
}

function writeParent(p: URLSearchParams, s: ParentState, lado: "a" | "b"): void {
  if (s.id == null) return;
  p.set(lado, String(s.id));
  p.set(`${lado}q`, s.quality.toFixed(3));
  if (s.ivs.some((v) => v > 0)) p.set(`${lado}v`, s.ivs.join("-"));
  if (s.shiny) p.set(`${lado}s`, "1");
}

export function buildBreedSearch(s: BreedState): string {
  const p = new URLSearchParams();
  writeParent(p, s.a, "a");
  writeParent(p, s.b, "b");
  if (s.mode !== EMPTY_BREED.mode) p.set("m", "pher");
  if (s.double) p.set("ds", "1");
  if (s.level !== EMPTY_BREED.level) p.set("lv", String(s.level));
  if (s.target !== EMPTY_BREED.target) p.set("alvo", s.target.toFixed(3));
  const str = p.toString();
  return str ? `?${str}` : "";
}
