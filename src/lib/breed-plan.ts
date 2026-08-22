// Planejador de breeding: quantos breeds faltam até a Quality alvo.
//
// As REGRAS do jogo moram em `breeding.ts` e não se discutem aqui. Este arquivo
// responde a pergunta que o jogo não responde — e ela é de PROBABILIDADE, não de
// aritmética.
//
// A versão anterior respondia `ceil(delta / ganho médio)`: um número só. Isso é a
// média de um processo aleatório e mente nas duas pontas. No Free, o ganho é
// 0.005 em metade das vezes e 0.040 em 3% — sortear 40 vezes seguidas o piso é
// perfeitamente possível, e quem planejou pela média fica no meio do caminho sem
// dinheiro. Média não é promessa: é o centro de uma distribuição que precisa
// aparecer inteira, do mesmo jeito que o IV da calculadora virou faixa em vez de
// ponto.
//
// Como se calcula EXATO, sem simulação:
//
//   Os ganhos de cada modo são poucos e todos múltiplos de um mesmo passo (Free:
//   5/10/20/40 milésimos, mdc 5; Pheromone: 150/200/250/300, mdc 50). Trocando
//   milésimo por UNIDADE do mdc, o problema vira inteiro: "quantos sorteios até
//   somar N unidades?". Isso é uma cadeia de Markov de N estados que se resolve
//   por programação dinâmica — a distribuição sai exata, com mediana, p90 e a
//   sobra que o teto engole. Monte Carlo aqui seria pior: mais lento, e ainda
//   assim aproximado.

import {
  BASE_COST,
  BASE_STONES,
  PHEROMONE_NORMAL_COUNT,
  QUALITY_DIFF_MAX,
  QUALITY_MAX_NORMAL,
  type BreedMode,
  round3,
  round4,
  tiersFor,
} from "./breeding";

/** Quality tem 3 casas — todo cálculo daqui roda em milésimos INTEIROS.
 *  Somar 0.005 em ponto flutuante 200 vezes erra na terceira casa; somar 5
 *  duzentas vezes não erra nunca. */
export const MIL = 1000;

export const milesimos = (q: number): number => Math.round(q * MIL);

function mdc(a: number, b: number): number {
  return b === 0 ? a : mdc(b, a % b);
}

interface Passos {
  /** tamanho da unidade, em milésimos */
  unidade: number;
  /** cada ganho do modo, em unidades, com a probabilidade */
  passos: { u: number; p: number }[];
  /** média e variância do ganho, em unidades — usadas na aproximação */
  media: number;
  variancia: number;
}

/** Os ganhos do modo reduzidos ao mdc. Sai da tabela de `breeding.ts`: se a
 *  tabela mudar, a unidade se recalcula sozinha. */
function passosDe(mode: BreedMode): Passos {
  const tiers = tiersFor(mode);
  const mils = tiers.map((t) => milesimos(t.gain));
  const unidade = mils.reduce((a, b) => mdc(a, b));
  const passos = tiers.map((t, i) => ({ u: mils[i] / unidade, p: t.prob }));
  const media = passos.reduce((s, x) => s + x.u * x.p, 0);
  const variancia = passos.reduce((s, x) => s + x.p * (x.u - media) ** 2, 0);
  return { unidade, passos, media, variancia };
}

/** Acima disto a matriz da cadeia fica cara demais pra rodar a cada tecla, e o
 *  resultado passa a sair por aproximação — declarada, nunca disfarçada. */
const MAX_ESTADOS = 2500;
const MAX_BREEDS = 20000;

export interface BreedsDist {
  /** o melhor caso possível: todo sorteio no ganho máximo */
  melhor: number;
  /** mediana — metade das tentativas fecha até aqui */
  p50: number;
  /** o azarado: 9 em cada 10 tentativas fecham até aqui */
  p90: number;
  media: number;
  /** quanto se passa do alvo, em Quality, no sorteio que fecha a conta */
  sobra: number;
  /** false = veio da aproximação normal, porque o alvo é longe demais */
  exato: boolean;
}

/**
 * Distribuição do número de breeds pra acumular `deltaMil` milésimos de Quality.
 *
 * Cadeia absorvente: o estado é quanto já se acumulou (0..need-1) e a absorção é
 * "chegou". `P(N = n)` é o que cai na absorção no passo n, então mediana, p90 e
 * média saem da mesma varredura — junto com a SOBRA, que é o quanto o último
 * sorteio passa do ALVO. Passar do alvo só custa alguma coisa quando o alvo está
 * colado no teto 2.600; quem decide isso é `modePlan`, não esta função.
 */
export function breedsDist(deltaMil: number, mode: BreedMode): BreedsDist {
  const { unidade, passos, media: mu, variancia } = passosDe(mode);
  if (deltaMil <= 0) {
    return { melhor: 0, p50: 0, p90: 0, media: 0, sobra: 0, exato: true };
  }
  const need = Math.ceil(deltaMil / unidade);
  const maiorPasso = Math.max(...passos.map((x) => x.u));
  const melhor = Math.ceil(need / maiorPasso);

  if (need > MAX_ESTADOS) {
    // Renovação assintótica: N ≈ need/μ com desvio √(need·σ²/μ³). Só se chega
    // aqui com alvo irreal (Shiny não tem teto e o campo aceita o que digitarem).
    const media = need / mu;
    const desvio = Math.sqrt((need * variancia) / mu ** 3);
    return {
      melhor,
      p50: Math.max(melhor, Math.round(media)),
      p90: Math.max(melhor, Math.round(media + 1.2816 * desvio)),
      media: round4(media),
      sobra: round3(((mu - 1) / 2) * (unidade / MIL)),
      exato: false,
    };
  }

  let atual = new Float64Array(need);
  atual[0] = 1;
  let acumulado = 0; // P(N <= n)
  let media = 0;
  let sobraU = 0;
  let p50 = 0;
  let p90 = 0;
  let n = 0;

  while (acumulado < 1 - 1e-12 && n < MAX_BREEDS) {
    const proximo = new Float64Array(need);
    let fechou = 0;
    for (let u = 0; u < need; u++) {
      const p = atual[u];
      if (p === 0) continue;
      for (const s of passos) {
        const v = u + s.u;
        const pp = p * s.p;
        if (v >= need) {
          fechou += pp;
          sobraU += pp * (v - need);
        } else {
          proximo[v] += pp;
        }
      }
    }
    n++;
    const antes = acumulado;
    acumulado += fechou;
    media += n * fechou;
    if (antes < 0.5 && acumulado >= 0.5) p50 = n;
    if (antes < 0.9 && acumulado >= 0.9) p90 = n;
    atual = proximo;
  }

  // Cauda que não fechou dentro do limite de passos: em vez de fingir que a
  // conta acabou, o que sobrou entra na média pelo tempo médio restante.
  if (acumulado < 1 - 1e-12) {
    const resto = 1 - acumulado;
    media += resto * (n + need / mu);
    if (p50 === 0) p50 = n;
    if (p90 === 0) p90 = n;
  }

  return {
    melhor,
    p50: Math.max(melhor, p50),
    p90: Math.max(melhor, p90),
    media: round4(media),
    sobra: round3((sobraU * unidade) / MIL),
    exato: true,
  };
}

export interface ModePlan {
  mode: BreedMode;
  dist: BreedsDist;
  /** custo do caminho TÍPICO (p50) e do azarado (p90) */
  money: [number, number];
  stones: [number, number];
  pheromones: [number, number];
  /** pokémon da espécie consumidos: cada breed come 2 e devolve 1, então uma
   *  corrente de N breeds custa N+1 bichos */
  parents: [number, number];
  /** chance de o filho AINDA casar com um parceiro na Quality de agora */
  compatChance: number;
  /** o alvo está perto o bastante do teto pra sobra do último sorteio bater nele */
  capWaste: boolean;
}

export interface BreedPlan {
  base: number;
  target: number;
  /** 2.600 no normal; null no Shiny, que fica com a Quality bruta */
  cap: number | null;
  effectiveTarget: number;
  delta: number;
  reached: boolean;
  /** o alvo pedido passa do teto — o plano mira no teto e diz isso */
  overCap: boolean;
  free: ModePlan;
  pheromone: ModePlan;
}

function modePlan(
  deltaMil: number,
  mode: BreedMode,
  effectiveTarget: number,
  cap: number | null,
): ModePlan {
  const dist = breedsDist(deltaMil, mode);
  const tiers = tiersFor(mode);
  // Um filho que sobe mais de 0.150 acima do parceiro fica ÓRFÃO: não existe par
  // válido pra ele na sua estante de agora. No Free o maior ganho é 0.040 e isso
  // nunca acontece; no Pheromone o piso do ganho já é 0.150, então metade dos
  // sorteios deixa o filho fora do alcance de um parceiro na Quality de hoje.
  const compatChance = tiers
    .filter((t) => t.gain <= QUALITY_DIFF_MAX + 1e-9)
    .reduce((s, t) => s + t.prob, 0);
  // Transbordo só é DESPERDÍCIO quando passa do TETO — passar do alvo, por si, não
  // custa nada. A regra antiga era `temTeto && dist.sobra > 0`, e `sobra` é a esperança
  // do transbordo do ÚLTIMO sorteio: ela é > 0 em praticamente todo plano, então o
  // aviso amarelo saía até com o alvo 1.4 de Quality ABAIXO do teto, onde a sobra é
  // ganho de graça. Aviso que dispara sempre não é aviso: é ruído que ensina a ignorar
  // o amarelo. O último sorteio pousa em [alvo, alvo + maiorGanho) — parte de menos que
  // o alvo e soma um ganho —, logo só há o que perder se essa faixa cruza o teto. Com o
  // alvo NO teto isso vale sempre, que é o caso que o aviso existia pra pegar.
  const maiorGanho = Math.max(...tiers.map((t) => t.gain));
  const capWaste = cap != null && effectiveTarget + maiorGanho > cap + 1e-9 && dist.sobra > 0;
  return {
    mode,
    dist,
    money: [dist.p50 * BASE_COST, dist.p90 * BASE_COST],
    stones: [dist.p50 * BASE_STONES, dist.p90 * BASE_STONES],
    pheromones:
      mode === "pheromone"
        ? [dist.p50 * PHEROMONE_NORMAL_COUNT, dist.p90 * PHEROMONE_NORMAL_COUNT]
        : [0, 0],
    parents: [dist.p50 + 1, dist.p90 + 1],
    compatChance: round4(compatChance),
    capWaste,
  };
}

/** Plano completo: da Quality de hoje até o alvo, nos dois modos. */
export function planBreeding(base: number, target: number, shiny: boolean): BreedPlan {
  const cap = shiny ? null : QUALITY_MAX_NORMAL;
  const effectiveTarget = cap != null ? Math.min(target, cap) : target;
  const deltaMil = Math.max(0, milesimos(effectiveTarget) - milesimos(base));
  return {
    base: round3(base),
    target: round3(target),
    cap,
    effectiveTarget: round3(effectiveTarget),
    delta: round3(deltaMil / MIL),
    reached: deltaMil <= 0,
    overCap: cap != null && target > cap + 1e-9,
    free: modePlan(deltaMil, "free", effectiveTarget, cap),
    pheromone: modePlan(deltaMil, "pheromone", effectiveTarget, cap),
  };
}

// ---- Double Stones: vale os 20 Stones a mais? ----
//
// A conta é curta e ninguém a faz de cabeça: 5% de +1 IV num stat abaixo de 32,
// por 20 Stones extras. São 20 breeds pra UM ponto esperado, e 400 Stones por
// ponto — número que decide sozinho, e que some se todos os stats já estão em 32.

export const DOUBLE_STONE_EXTRA = 20;

export interface DoubleStoneMath {
  /** stats que ainda podem subir */
  elegiveis: number;
  /** IV esperado ganho por breed */
  ivPorBreed: number;
  /** breeds até um ponto de IV, em média */
  breedsPorIv: number | null;
  /** Stones a mais gastas por ponto de IV esperado */
  stonesPorIv: number | null;
}

export function doubleStoneMath(ivs: number[], chance: number): DoubleStoneMath {
  const elegiveis = ivs.filter((v) => v < 32).length;
  const ivPorBreed = elegiveis > 0 ? chance : 0;
  return {
    elegiveis,
    ivPorBreed: round4(ivPorBreed),
    breedsPorIv: ivPorBreed > 0 ? Math.round(1 / ivPorBreed) : null,
    stonesPorIv: ivPorBreed > 0 ? Math.round(DOUBLE_STONE_EXTRA / ivPorBreed) : null,
  };
}
