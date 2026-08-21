// A leitura de IV a partir dos stats da tela do jogo.
//
// Mora aqui, e nao dentro da calculadora, porque **duas ferramentas fazem a
// mesma pergunta sobre o mesmo pokemon**: a calculadora ("esse que eu peguei
// presta?") e o breeding ("o que esse pai vai passar pro filho?"). Se cada tela
// invertesse a formula por conta propria, o mesmo Venusaur poderia ler IV 30
// numa e 31 na outra — e a ferramenta perde a autoridade que e a unica coisa que
// ela tem.
//
// O motivo de existir e o que o jogo NAO mostra: o IV. A tela do jogo entrega
// stat, nivel e quality; o IV e o que separa dois Venusaur identicos na tela, e
// so aparece invertendo `stats.ts`.
//
// E o resultado e FAIXA, nunca ponto: o stat na tela ja veio arredondado, entao
// um mesmo numero cabe num intervalo de IV. Em nivel alto o intervalo fecha em
// cima de um inteiro e da pra cravar; em nivel baixo ele engole dezenas de
// pontos. Ver [[Estimativa que inverte valor arredondado e faixa, nao ponto]].

import { IV_MAX, estimateIvs, ivRange } from "./stats";

const trava = (v: number): number => Math.min(IV_MAX, Math.max(0, v));

export interface IvReading {
  /** o ponto mais provavel de cada IV, travado em 0..32 */
  ivs: number[];
  /** o intervalo compativel com o stat da tela, stat a stat */
  faixas: [number, number][];
  /** o mesmo ponto arredondado pra inteiro — IV no jogo e inteiro */
  inteiros: number[];
  soma: number;
  somaIv: number;
  totalMin: number;
  totalMax: number;
  /** a maior largura entre as seis faixas: o tamanho da duvida */
  largura: number;
  /** true quando nenhum IV entre 0 e 32 explica os stats informados */
  impossivel: boolean;
  /** true quando as seis faixas cabem num inteiro so: da pra cravar */
  cravado: boolean;
}

export function lerIvs(
  bases: number[],
  stats: number[],
  level: number,
  quality: number,
): IvReading {
  const { ivs } = estimateIvs(bases, stats, level, quality);
  const faixas = bases.map((b, i) => ivRange(b, stats[i], level, quality, i));
  return {
    ivs,
    faixas,
    inteiros: ivs.map((v) => Math.round(trava(v))),
    soma: stats.reduce((a, b) => a + b, 0),
    somaIv: ivs.reduce((a, v) => a + trava(v), 0),
    // O trio minimo / mais provavel / maximo sai do MESMO intervalo de
    // arredondamento das barras — nao e margem de erro chutada.
    totalMin: faixas.reduce((a, [lo]) => a + trava(lo), 0),
    totalMax: faixas.reduce((a, [, hi]) => a + trava(hi), 0),
    largura: Math.max(...faixas.map(([lo, hi]) => hi - lo)),
    /** Impossivel e quando NENHUM IV valido cabe na leitura — testar o ponto
     *  dava alarme falso em todo pokemon de nivel baixo. */
    impossivel: faixas.some(([lo, hi]) => lo > IV_MAX || hi < 0),
    // Uma faixa mais estreita que 1 nao contem dois inteiros: o IV esta cravado.
    cravado: faixas.every(([lo, hi]) => hi - lo <= 1),
  };
}

/** Texto de UM IV: faixa quando ela e larga, ponto quando ela e estreita.
 *  A regra e a mesma nas duas ferramentas, entao ela mora junto da leitura. */
export function textoIv(r: IvReading, i: number): string {
  const [lo, hi] = r.faixas[i];
  return hi - lo > 1
    ? `${Math.max(0, lo).toFixed(0)}–${Math.min(IV_MAX, hi).toFixed(0)}`
    : r.ivs[i].toFixed(1);
}

/** Texto do IV total: faixa quando a leitura e larga. */
export function textoIvTotal(r: IvReading): string {
  if (r.impossivel) return "—";
  return r.cravado
    ? String(Math.round(r.somaIv))
    : `${Math.round(r.totalMin)}–${Math.round(r.totalMax)}`;
}
