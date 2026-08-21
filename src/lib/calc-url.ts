// A pergunta da Calculadora na URL.
//
// Mesmo contrato da dex e dos itens, e aqui o argumento e ainda mais direto: o
// que se digita na calculadora e UM bicho especifico — espécie, nível, quality
// e os seis stats. Sem isso na URL, "olha esse Abra que eu peguei" vira print;
// com isso, vira link que o outro abre e continua mexendo.

export interface CalcState {
  /** pokeId da especie; null = nada escolhido ainda */
  id: number | null;
  level: number;
  quality: number;
  /** os seis stats observados, na ordem canonica */
  stats: number[];
  /** nivel da projecao */
  target: number;
}

export const EMPTY_CALC: CalcState = {
  id: null,
  level: 50,
  quality: 1,
  stats: [0, 0, 0, 0, 0, 0],
  target: 100,
};

const num = (v: string | null, fallback: number): number => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function parseCalcState(sp: URLSearchParams): CalcState {
  const id = Number(sp.get("p"));
  const raw = (sp.get("s") ?? "").split("-");
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    level: Math.max(1, num(sp.get("lv"), EMPTY_CALC.level)),
    quality: Math.max(0, num(sp.get("q"), EMPTY_CALC.quality)),
    stats: Array.from({ length: 6 }, (_, i) => Math.max(0, num(raw[i] ?? null, 0))),
    target: Math.max(1, num(sp.get("alvo"), EMPTY_CALC.target)),
  };
}

export function buildCalcSearch(s: CalcState): string {
  const p = new URLSearchParams();
  if (s.id != null) p.set("p", String(s.id));
  if (s.level !== EMPTY_CALC.level) p.set("lv", String(s.level));
  if (s.quality !== EMPTY_CALC.quality) p.set("q", String(s.quality));
  if (s.stats.some((v) => v > 0)) p.set("s", s.stats.join("-"));
  if (s.target !== EMPTY_CALC.target) p.set("alvo", String(s.target));
  const str = p.toString();
  return str ? `?${str}` : "";
}
