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
//  3. Preco (deal): se VALE A PENA pelo que se paga. NAO sai do Power atual (o nivel
//     infla: um lixo upado tem Power alto), e sim do TETO do bicho — o Power que ele
//     teria num nivel de referencia com a Quality e o IV que tem. O mercado INTEIRO
//     (todas as especies) vira a regua: mediana de preco-por-teto por especie+moeda,
//     com fallback global. Preco justo = taxa x teto do bicho; caro/barato = quanto o
//     anuncio foge disso. Ver o motor mais abaixo (buildPriceModel/fairPriceOf).
//
// A NOTA do bicho (borda do card) e comandada pela Quality (pois pesa mais), com os
// genes so temperando. Genes e Quality tambem aparecem separados no veredito, porque
// um bicho de genes otimos mas Quality baixa ainda vale — como reprodutor.

import type { MarketMon, Currency } from "./game-account";
import { projectAll } from "./stats";

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

// O preco justo precisa estar ao menos 25% acima do pago pra o negocio ser "otimo", e
// o pago nao pode passar de 125% do justo pra ainda ser "justo".
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

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Motor de preco justo (valor). Roda no servidor sobre o MERCADO INTEIRO.
//
// A pergunta "ta caro?" nao pode sair do Power ATUAL (nivel infla). Sai do TETO do
// bicho: o Power que ele teria no nivel de referencia com a Quality e o IV reais —
// captura especie + Quality + genes e ignora o quanto ja upou. Para cada especie+moeda
// pegamos a mediana de preco-por-teto; com poucos anuncios da especie, cai pra global.
// Preco justo do anuncio = taxa x teto dele.
// ---------------------------------------------------------------------------

const CEIL_LEVEL = 100; // nivel de referencia constante — o valor absoluto some na razao
export const MIN_SPECIES_SAMPLE = 5; // abaixo disso a taxa da especie e fraca -> desce a cadeia

// O preco NAO escala linear com o teto: um Q2.1+ (so sai de breeding) vale despropor-
// cionalmente mais que a projecao linear sugere, e a mediana do mercado inteiro e
// dominada por bicho cru (Q~1.0-1.3 baratinho) — uma regua unica ESMAGA a elite.
// Por isso a regua e POR FAIXA de Quality (e shiny separado de nao-shiny, o premio de
// shiny e outro mercado): elite se compara com elite. Faixas casadas com as notas
// (Q_OK/Q_GREAT) + o corte de breeding-only (2.1, acima do teto selvagem ~1.8+herancas).
export const Q_BAND_EDGES = [1.4, 1.8, 2.1] as const;
export function qualityBand(q: number | null): number {
  if (q == null) return 0;
  let b = 0;
  for (const edge of Q_BAND_EDGES) if (q >= edge) b++;
  return b; // 0: cru | 1: medio | 2: topo selvagem | 3: elite de breeding
}

/** Teto de Power do bicho, independente do nivel atual: projeta no nivel de referencia
 *  com a Quality real e o IV distribuido igual entre os stats. Precisa dos bases da especie. */
export function monCeiling(bases: number[] | undefined, ivTotal: number | null, quality: number | null): number | null {
  if (!bases || bases.length !== 6) return null;
  const q = quality ?? 1;
  const ivEach = ivTotal != null ? ivTotal / 6 : 0;
  const ivs = [ivEach, ivEach, ivEach, ivEach, ivEach, ivEach];
  return projectAll(bases, ivs, CEIL_LEVEL, q).power;
}

// O minimo que o motor precisa de cada anuncio pra montar a regua.
export interface PriceItem {
  speciesId: number;
  currency: Currency;
  price: number;
  ceil: number | null;
  quality: number | null;
  shiny: boolean;
}

interface Rate { rate: number; n: number }

export interface PriceModel {
  globalRate: { GOLD: number | null; DIAMONDS: number | null }; // ultimo fallback (regua geral)
  bandRate: Map<string, Rate>; // `${currency}:${band}:${shiny}` -> mediana de preco/teto da faixa
  speciesBandRate: Map<string, Rate>; // `${speciesId}:${currency}:${band}:${shiny}`
}

const sbKey = (speciesId: number, currency: Currency, band: number, shiny: boolean) =>
  `${speciesId}:${currency}:${band}:${shiny ? 1 : 0}`;
const bKey = (currency: Currency, band: number, shiny: boolean) => `${currency}:${band}:${shiny ? 1 : 0}`;

/** Monta a regua (mediana de preco-por-teto por especie+faixa, por faixa, e global)
 *  sobre TODO o mercado. */
export function buildPriceModel(items: PriceItem[]): PriceModel {
  const g: number[] = [];
  const d: number[] = [];
  const byBand = new Map<string, number[]>();
  const bySpBand = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, v: number) => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };
  for (const it of items) {
    if (it.ceil == null || it.ceil <= 0 || it.price <= 0) continue;
    const ppc = it.price / it.ceil;
    (it.currency === "DIAMONDS" ? d : g).push(ppc);
    const band = qualityBand(it.quality);
    push(byBand, bKey(it.currency, band, it.shiny), ppc);
    push(bySpBand, sbKey(it.speciesId, it.currency, band, it.shiny), ppc);
  }
  const toRates = (m: Map<string, number[]>): Map<string, Rate> => {
    const out = new Map<string, Rate>();
    for (const [k, arr] of m) {
      const md = median(arr);
      if (md != null) out.set(k, { rate: md, n: arr.length });
    }
    return out;
  };
  return { globalRate: { GOLD: median(g), DIAMONDS: median(d) }, bandRate: toRates(byBand), speciesBandRate: toRates(bySpBand) };
}

export interface FairPriceMeta {
  price: number;
  n: number; // quantos anuncios sustentam a taxa usada
  tier: "species-band" | "band" | "global"; // qual degrau da cadeia respondeu
}

/** Preco justo estimado com a proveniencia: taxa da especie NA MESMA faixa de Quality
 *  (amostra >= MIN), senao a faixa global, senao a regua geral — sempre x teto do bicho. */
export function fairPriceMeta(it: PriceItem, model: PriceModel): FairPriceMeta | null {
  if (it.ceil == null || it.ceil <= 0) return null;
  const band = qualityBand(it.quality);
  const sb = model.speciesBandRate.get(sbKey(it.speciesId, it.currency, band, it.shiny));
  if (sb && sb.n >= MIN_SPECIES_SAMPLE) return { price: Math.round(sb.rate * it.ceil), n: sb.n, tier: "species-band" };
  const b = model.bandRate.get(bKey(it.currency, band, it.shiny));
  if (b && b.n >= MIN_SPECIES_SAMPLE) return { price: Math.round(b.rate * it.ceil), n: b.n, tier: "band" };
  const rate = it.currency === "DIAMONDS" ? model.globalRate.DIAMONDS : model.globalRate.GOLD;
  if (rate == null || rate <= 0) return null;
  return { price: Math.round(rate * it.ceil), n: 0, tier: "global" };
}

/** Preco justo estimado do anuncio (so o numero). Null quando falta teto ou regua. */
export function fairPriceOf(it: PriceItem, model: PriceModel): number | null {
  return fairPriceMeta(it, model)?.price ?? null;
}

// ---- Veredito de preco a partir do preco justo (usado no client) ----

/** Nota de preco: compara o que se paga com o preco justo. Barato (paga bem menos) = otimo. */
export function priceGrade(price: number, fairPrice: number | null): Grade | null {
  if (fairPrice == null || fairPrice <= 0 || price <= 0) return null;
  const r = fairPrice / price; // >1 => paga menos que o justo
  if (r >= DEAL_GREAT) return "great";
  if (r >= DEAL_FAIR) return "ok";
  return "bad";
}

/** Quanto o preco esta acima(+) / abaixo(-) do justo, em %. Negativo = barato. */
export function dealPct(price: number, fairPrice: number | null): number | null {
  if (fairPrice == null || fairPrice <= 0 || price <= 0) return null;
  return Math.round((price / fairPrice - 1) * 100);
}
