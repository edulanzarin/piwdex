// Avaliacao de anuncio do mercado em DOIS eixos independentes:
//
//  1. Qualidade "genetica" (genes): o quanto o bicho e bom em si, pelo IV total
//     sobre o maximo (192). Independe de nivel e de preco — e o teto permanente.
//
//  2. Preco (deal): se VALE A PENA pelo que se paga. Custo-beneficio = Power por
//     unidade de preco, comparado com a MEDIANA dos anuncios listados (por moeda).
//     Mediana em vez de media pra um anuncio absurdo (golpe/typo) nao mover a regua.
//
// Os dois sao separados de proposito: um bicho de genes medianos (amarelo) mas
// barato (deal verde) pode valer mais a pena que um perfeito supervalorizado.

import type { MarketMon } from "./game-account";

export type Grade = "great" | "ok" | "bad";

const IV_MAX_TOTAL = 192;

// Amostra minima por moeda pra a mediana significar algo. Abaixo disso nao cravamos
// veredito de preco (retorna null) — melhor calar que enganar.
export const MIN_SAMPLE = 4;

// Custo-beneficio precisa estar ao menos 25% acima da mediana pra ser "otimo", e nao
// pode cair abaixo de 80% dela pra ainda ser "justo".
export const DEAL_GREAT = 1.25;
export const DEAL_FAIR = 0.8;

/** Qualidade dos genes pelo IV total (0..192). Verde >=150, amarelo >=100, vermelho abaixo. */
export function ivGrade(ivTotal: number | null): Grade | null {
  if (ivTotal == null) return null;
  if (ivTotal >= 150) return "great";
  if (ivTotal >= 100) return "ok";
  return "bad";
}

/** Custo-beneficio bruto: Power por unidade de preco. Null quando falta dado. */
export function valuePerCoin(m: Pick<MarketMon, "power" | "price">): number | null {
  if (m.power == null || m.power <= 0 || m.price <= 0) return null;
  return m.power / m.price;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Baseline de custo-beneficio, separado por moeda (nao da pra comparar ouro com diamante).
export interface DealBench {
  GOLD: number | null;
  DIAMONDS: number | null;
  count: { GOLD: number; DIAMONDS: number };
}

/** Constroi o baseline (mediana de Power/preco por moeda) sobre um conjunto de anuncios. */
export function buildBench(mons: MarketMon[]): DealBench {
  const g: number[] = [];
  const d: number[] = [];
  for (const m of mons) {
    const v = valuePerCoin(m);
    if (v == null) continue;
    (m.currency === "DIAMONDS" ? d : g).push(v);
  }
  return { GOLD: median(g), DIAMONDS: median(d), count: { GOLD: g.length, DIAMONDS: d.length } };
}

function benchFor(m: MarketMon, bench: DealBench): { base: number | null; n: number } {
  return m.currency === "DIAMONDS"
    ? { base: bench.DIAMONDS, n: bench.count.DIAMONDS }
    : { base: bench.GOLD, n: bench.count.GOLD };
}

/** Quanto o custo-beneficio do anuncio esta acima/abaixo da mediana da moeda (1 = na media).
 *  Null quando falta dado ou a amostra e pequena demais. */
export function dealRatio(m: MarketMon, bench: DealBench): number | null {
  const v = valuePerCoin(m);
  const { base, n } = benchFor(m, bench);
  if (v == null || base == null || base <= 0 || n < MIN_SAMPLE) return null;
  return v / base;
}

/** Veredito de preco a partir do ratio de custo-beneficio. */
export function priceGrade(m: MarketMon, bench: DealBench): Grade | null {
  const r = dealRatio(m, bench);
  if (r == null) return null;
  if (r >= DEAL_GREAT) return "great";
  if (r >= DEAL_FAIR) return "ok";
  return "bad";
}
