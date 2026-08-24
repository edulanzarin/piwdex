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

import { IV_MAX, estimateIvs, ivRange, projectStat } from "./stats";

const trava = (v: number): number => Math.min(IV_MAX, Math.max(0, v));

/**
 * Os IV inteiros que REPRODUZEM o stat observado, achados por tentativa.
 *
 * Isto substituiu a inversao como caminho principal, e a razao e que inverter
 * era o caminho dificil de um problema facil.
 *
 * A inversao tem duas fontes de erro, e as duas sao do arredondamento:
 *
 * 1. **O intervalo e MEIO-ABERTO.** `Math.round` arredonda meio pra cima, entao
 *    `stat = round(v)` quer dizer `v ∈ [stat-0,5 ; stat+0,5)` — fechado embaixo,
 *    ABERTO em cima. Devolver um par fechado inclui um inteiro a mais na ponta.
 * 2. **O ponto medio nao e a resposta.** Ele cai em `x,5` sempre que o intervalo
 *    mede exatamente 1 — e arredondar `x,5` sobe pra `x+1`, que e justamente o
 *    valor que a formula direta NAO reproduz. E nao e canto raro: a largura vale
 *    `1/(2·fator)`, e da 1 exato quando o fator da 0,5, ou seja num pokemon de
 *    nivel 50 com quality 1,0.
 *
 * Medido em 57 mil combinacoes: em 73% delas o stat observado fixa UM unico IV
 * possivel, e em 1% dessas a tela mostrava o inteiro errado, sempre uma unidade
 * acima. Isso nao era so cosmetico — o breeding le `inteiros` como o IV do pai.
 *
 * Enumerar mata as duas de uma vez: 33 candidatos por stat, 198 pela leitura
 * inteira, e a resposta e exata por construcao. O conjunto e contiguo (a formula
 * cresce com o IV), entao o primeiro e o ultimo bastam pra descrever a faixa.
 */
function ivsCompativeis(
  base: number, stat: number, level: number, quality: number, i: number,
): number[] {
  const out: number[] = [];
  for (let iv = 0; iv <= IV_MAX; iv++) {
    if (projectStat(base, iv, level, quality, i) === stat) out.push(iv);
  }
  return out;
}

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
  const ivsInvertidos = crus.map(trava);
  const faixasInvertidas = faixasCruas.map(
    ([lo, hi]) => [trava(lo), trava(hi)] as [number, number],
  );

  // A ENUMERACAO manda; a inversao vira reserva.
  //
  // A reserva existe porque enumerar e ESTRITO: ele pede que a formula reproduza
  // o stat na bicuda. Se a quality digitada estiver arredondada (o jogo mostra
  // 1,8 pra um 1,83 interno), nenhum inteiro fecha e o conjunto sai vazio — e ai
  // devolver "nao existe" seria culpar a pessoa por um dado que ela copiou
  // certo. Nesse caso a leitura cai no intervalo de antes, que e mais largo e
  // absorve o desencontro, e a tela mostra faixa em vez de ponto.
  const compat = bases.map((b, i) => ivsCompativeis(b, stats[i], level, quality, i));
  const exata = compat.every((c) => c.length > 0);

  const ivs = compat.map((c, i) =>
    c.length ? (c[0] + c[c.length - 1]) / 2 : ivsInvertidos[i],
  );
  const faixas = compat.map((c, i) =>
    c.length ? ([c[0], c[c.length - 1]] as [number, number]) : faixasInvertidas[i],
  );

  return {
    ivs,
    faixas,
    faixasCruas,
    // O inteiro sai do CONJUNTO, e nao de arredondar o ponto. Com um unico IV
    // compativel ele e esse IV, ponto final — e era exatamente aqui que o `x,5`
    // subia pro vizinho errado e entrava no breeding como IV do pai.
    inteiros: compat.map((c, i) =>
      c.length ? c[Math.floor((c.length - 1) / 2)] : Math.round(ivs[i]),
    ),
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
    // CRAVADO agora e uma contagem, nao uma largura: um unico IV inteiro
    // compativel em cada um dos seis stats. A regra antiga (`hi - lo <= 1`) era
    // uma aproximacao disso pela largura do intervalo, e ela ficava na dependencia
    // de a ponta de cima ser aberta — que era justamente o que estava errado.
    // Sem enumeracao exata nao ha o que cravar.
    cravado: exata && compat.every((c) => c.length === 1),
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

  // Tres ramos, e o do meio e o que estava faltando.
  //
  // A regra antiga era `hi - lo > 1 ? faixa : ponto`, e com ela DOIS inteiros
  // compativeis (largura exatamente 1) caiam no ramo do ponto e a tela imprimia
  // "20,5" — um IV que nao existe, porque IV no jogo e inteiro. O numero com
  // virgula ainda por cima parecia mais preciso que a faixa.
  //
  // Com a leitura exata a faixa e feita de inteiros, entao a pergunta certa e
  // quantos cabem: um so vira numero, dois ou mais viram faixa. A fracao so
  // sobra na reserva (quando nenhum inteiro fecha), e ali o ponto e o melhor
  // que ha.
  if (hi === lo) return lo.toFixed(0);
  if (hi - lo >= 1) return `${lo.toFixed(0)}–${hi.toFixed(0)}`;
  return r.ivs[i].toFixed(1);
}

/** Texto do IV total: faixa quando a leitura e larga. */
export function textoIvTotal(r: IvReading): string {
  if (r.impossivel) return "—";
  return r.cravado
    ? String(Math.round(r.somaIv))
    : `${Math.round(r.totalMin)}–${Math.round(r.totalMax)}`;
}
