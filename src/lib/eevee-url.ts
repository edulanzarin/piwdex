// A pergunta do Eevee na URL.
//
// Mesmo contrato da calculadora. Aqui o que viaja e curto de proposito: o ramo
// escolhido e o nivel/quality do Eevee que voce tem. Nao entram os IV da carta —
// carta e coleção pessoal, mora no navegador de quem coletou, e mandar os seis IV
// de um bicho na URL faz o link dizer mais do que quem mandou quis dizer.

import { TROCAS } from "./eevee";

export interface EeveeState {
  /** indice em TROCAS */
  ramo: number;
  level: number;
  quality: number;
}

export const EMPTY_EEVEE: EeveeState = { ramo: 0, level: 100, quality: 1 };

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function parseEeveeState(sp: URLSearchParams): EeveeState {
  // O ramo viaja por NOME e nao por indice: `?r=espeon` sobrevive a loja ganhar um
  // sexto destino, e `?r=4` viraria outro pokemon no dia em que a lista crescer.
  const nome = (sp.get("r") ?? "").toLowerCase();
  const i = TROCAS.findIndex((t) => t.nome.toLowerCase() === nome);
  return {
    ramo: i >= 0 ? i : EMPTY_EEVEE.ramo,
    level: Math.max(1, num(sp.get("lv"), EMPTY_EEVEE.level)),
    quality: Math.max(0, num(sp.get("q"), EMPTY_EEVEE.quality)),
  };
}

export function buildEeveeSearch(s: EeveeState): string {
  const p = new URLSearchParams();
  if (s.ramo !== EMPTY_EEVEE.ramo) p.set("r", TROCAS[s.ramo].nome.toLowerCase());
  if (s.level !== EMPTY_EEVEE.level) p.set("lv", String(s.level));
  if (s.quality !== EMPTY_EEVEE.quality) p.set("q", String(s.quality));
  const str = p.toString();
  return str ? `?${str}` : "";
}
