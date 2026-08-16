// Avaliacao de anuncio do mercado. Um bicho e bom por DUAS coisas permanentes, e
// separado disso vem o preco:
//
//  1. Genes (IV total / 192): a "genetica" de stats. Fixa na captura, evoluir nao
//     re-rola.
//
//  2. Quality (Q): multiplicador permanente que, no jogo, PESA MAIS que o IV — entra
//     na conta duas vezes (em cada stat via Q^exp e de novo no Power = soma*Q). So
//     sobe com breeding. Captura selvagem vai de ~1.0 ate ~1.8; 2.0+ (Mythic/Ancient/
//     Divine) so vem de breeding/shiny; teto normal 2.600. Logo Q perto de 1.0 e bicho
//     cru (so serve de reprodutor) e 1.8 e o minimo que a comunidade recomenda.
//     Fontes: pokepedia/systems/quality do jogo e pokeidletools.com; constantes de
//     breeding conferem com src/lib/breeding.ts (WILD ~1.0, max normal 2.6).
//
//  3. Preco (deal): se VALE A PENA pelo que se paga. Custo-beneficio = Power por
//     unidade de preco, comparado com a MEDIANA dos anuncios listados (por moeda).
//     Mediana em vez de media pra um anuncio absurdo (golpe/typo) nao mover a regua.
//
// A NOTA do bicho (borda do card) e comandada pela Quality (pois pesa mais), com os
// genes so temperando. Genes e Quality tambem aparecem separados no veredito, porque
// um bicho de genes otimos mas Quality baixa ainda vale — como reprodutor.

import type { MarketMon } from "./game-account";

export type Grade = "great" | "ok" | "bad";

const IV_MAX_TOTAL = 192;

// Escala de Quality (ver cabecalho). Constantes pra ficar facil de calibrar.
export const Q_GREAT = 1.8; // topo do selvagem / minimo recomendado — daqui pra cima e verde
export const Q_OK = 1.4; // meio do caminho entre a base (1.0) e o recomendado
export const Q_FODDER = 1.2; // perto da captura crua: so vale de reprodutor
export const QUALITY_CEIL = 2.6; // teto normal (confere com breeding.ts QUALITY_MAX_NORMAL)

/** Nota da Quality (Q): verde >=1.8, amarelo >=1.4, vermelho abaixo. */
export function qualityGrade(q: number | null): Grade | null {
  if (q == null) return null;
  if (q >= Q_GREAT) return "great";
  if (q >= Q_OK) return "ok";
  return "bad";
}

/** Quality perto da base (<=1.2): o bicho so compensa como reprodutor de breeding. */
export function isBreedingStock(q: number | null): boolean {
  return q != null && q <= Q_FODDER;
}

// Amostra minima por moeda pra a mediana significar algo. Abaixo disso nao cravamos
// veredito de preco (retorna null) — melhor calar que enganar.
export const MIN_SAMPLE = 4;

// Custo-beneficio precisa estar ao menos 25% acima da mediana pra ser "otimo", e nao
// pode cair abaixo de 80% dela pra ainda ser "justo".
export const DEAL_GREAT = 1.25;
export const DEAL_FAIR = 0.8;

/** Nota dos genes pelo IV total (0..192). Verde >=150, amarelo >=100, vermelho abaixo. */
export function ivGrade(ivTotal: number | null): Grade | null {
  if (ivTotal == null) return null;
  if (ivTotal >= 150) return "great";
  if (ivTotal >= 100) return "ok";
  return "bad";
}

/** Nota geral do bicho pra a borda do card. A Quality manda (pesa mais que o IV): a
 *  nota parte da Quality e genes fracos so rebaixam um "otimo" pra "bom" — genes de
 *  elite NAO salvam uma Quality baixa (Q baixa = bicho cru, no maximo reprodutor). */
export function monGrade(ivTotal: number | null, quality: number | null): Grade | null {
  const q = qualityGrade(quality);
  if (q == null) return ivGrade(ivTotal); // sem Quality: cai pro que da (genes)
  const iv = ivGrade(ivTotal);
  if (q === "great" && iv === "bad") return "ok"; // Quality otima mas genes fracos: tempera
  return q;
}

const Q_BASE = 1.0; // captura selvagem
const Q_CEIL = QUALITY_CEIL; // teto normal (2.6)

/** Potencial permanente do bicho (0..1), INDEPENDENTE de nivel: combina Quality e IV,
 *  com a Quality pesando mais (ela pesa mais no jogo). Serve pra ordenar por "quao bom
 *  o bicho PODE ser" em vez de pelo Power atual — que so reflete o quanto ja upou, e por
 *  isso um lixo upado passa a frente de um perfeito de nivel baixo. */
export function potentialScore(m: Pick<MarketMon, "ivTotal" | "quality">): number {
  const ivn = m.ivTotal != null ? Math.min(1, Math.max(0, m.ivTotal / IV_MAX_TOTAL)) : 0;
  const qn = m.quality != null ? Math.min(1, Math.max(0, (m.quality - Q_BASE) / (Q_CEIL - Q_BASE))) : 0;
  return 0.6 * qn + 0.4 * ivn;
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
