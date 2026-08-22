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
  /** o ponto mais provavel de cada IV, travado em 0..IV_MAX */
  ivs: number[];
  /** o intervalo compativel com o stat da tela, travado em 0..IV_MAX */
  faixas: [number, number][];
  /** as mesmas faixas SEM trava — e nelas que se ve a leitura furada, porque
   *  depois da trava toda faixa cabe em 0..IV_MAX por construcao */
  faixasCruas: [number, number][];
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
  const faixasCruas = bases.map((b, i) => ivRange(b, stats[i], level, quality, i));
  const { ivs: crus } = estimateIvs(bases, stats, level, quality);

  // A trava e AQUI, nas duas pontas e de uma vez so, antes de qualquer conta
  // derivada. Antes ela morava em cada consumidor: `textoIv` travava so o piso
  // no piso e so o teto no teto, e uma faixa inteira acima de IV_MAX saia
  // INVERTIDA na tela ("99-32", com Electrode nv54 quality 0.8, HP 113). O ramo
  // estreito era pior: imprimia o ponto vindo de `estimateIvs`, que so tem
  // Math.max(0, ...) e nenhum teto — a tela afirmava "IV 99.8 /32".
  // `trava` e monotona, entao lo <= hi cru continua lo <= hi travado: faixa
  // invertida deixa de ser representavel em vez de depender de quem imprime.
  const ivs = crus.map(trava);
  const faixas = faixasCruas.map(
    ([lo, hi]) => [trava(lo), trava(hi)] as [number, number],
  );

  return {
    ivs,
    faixas,
    faixasCruas,
    inteiros: ivs.map((v) => Math.round(v)),
    soma: stats.reduce((a, b) => a + b, 0),
    somaIv: ivs.reduce((a, v) => a + v, 0),
    // O trio minimo / mais provavel / maximo sai do MESMO intervalo de
    // arredondamento das barras — nao e margem de erro chutada.
    totalMin: faixas.reduce((a, [lo]) => a + lo, 0),
    totalMax: faixas.reduce((a, [, hi]) => a + hi, 0),
    largura: Math.max(...faixas.map(([lo, hi]) => hi - lo)),
    /** Impossivel e quando NENHUM IV valido cabe na leitura — testar o ponto
     *  dava alarme falso em todo pokemon de nivel baixo. Le a faixa CRUA: a
     *  travada cabe em 0..IV_MAX sempre, e o alarme nunca dispararia. */
    impossivel: faixasCruas.some(([lo, hi]) => lo > IV_MAX || hi < 0),
    // Uma faixa mais estreita que 1 nao contem dois inteiros: o IV esta cravado.
    // Vale sobre a faixa TRAVADA: quem sabe que o IV nao passa de IV_MAX sabe
    // mais, e [31.2, 33.5] e duvida de 0.8 ponto, nao de 2.3.
    cravado: faixas.every(([lo, hi]) => hi - lo <= 1),
  };
}

/** Texto de UM IV: faixa quando ela e larga, ponto quando ela e estreita.
 *  A regra e a mesma nas duas ferramentas, entao ela mora junto da leitura. */
export function textoIv(r: IvReading, i: number): string {
  // Leitura impossivel nao tem numero pra mostrar. Travada em 0..IV_MAX ela sai
  // com cara de leitura boa ("32,0") bem do lado do aviso que diz que ela nao
  // vale — e o numero cala o aviso. O aviso e a informacao util aqui.
  if (r.impossivel) return "—";
  const [lo, hi] = r.faixas[i];
  return hi - lo > 1 ? `${lo.toFixed(0)}–${hi.toFixed(0)}` : r.ivs[i].toFixed(1);
}

/** Texto do IV total: faixa quando a leitura e larga. */
export function textoIvTotal(r: IvReading): string {
  if (r.impossivel) return "—";
  return r.cravado
    ? String(Math.round(r.somaIv))
    : `${Math.round(r.totalMin)}–${Math.round(r.totalMax)}`;
}
