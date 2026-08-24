/**
 * O SIMULADOR DE COMBATE — evento a evento, sem formula fechada.
 *
 * ## Por que ele existe
 *
 * O motor anterior resolvia uma luta com uma divisao: `segundos = hp / dps`, onde
 * `dps` era a SOMA do dano por segundo de todos os golpes do moveset.
 *
 * A soma tinha uma justificativa boa e verdadeira — neste jogo cada golpe tem
 * recarga propria e dispara sozinho quando fica pronto, entao ninguem "escolhe
 * um", e quem tem quatro golpes medios bate mais que quem tem um bom e nada mais.
 *
 * Mas somar so vale se todos os golpes chegarem a CAIR antes do alvo morrer. E o
 * caso mais comum deste jogo e o oposto: o lutador one-shota. Quando o primeiro
 * golpe ja mata, os outros sete nunca aconteceram, e dividir o HP pela soma dos
 * oito devolve um tempo de combate inventado.
 *
 * Isso foi medido, nao suposto. Golem nv 422 contra Furious Scyther nv 150, pelo
 * `npm run prever`:
 *
 *     hits    1.0 pra derrubar      <- one-shot
 *     ciclo   5.40s (2.13 de combate + 3.3 de overhead)
 *     kos/h   previsto 663, medido 763 em conta real
 *
 * Um golpe mata, e ainda assim o modelo cobrava 2,13 segundos de porrada.
 *
 * ## O que muda
 *
 * Aqui nao ha divisao. Cada golpe tem um relogio proprio; o simulador anda ate o
 * proximo golpe que fica pronto (dos DOIS lados), aplica o dano, e repete ate
 * alguem cair. O one-shot para de precisar de caso especial — a luta simplesmente
 * termina no primeiro evento.
 *
 * De brinde, tres coisas que a formula fechada nao conseguia expressar passam a
 * sair de graca:
 *
 * 1. **Recarga importa.** Dois movesets com o mesmo DPS somado, um com um golpe de
 *    1s e outro com quatro de 4s, matam em tempos diferentes quando o alvo morre
 *    em um hit. O primeiro ganha, e agora a conta enxerga isso.
 * 2. **Overkill nao rende.** Dano que passa do HP do alvo e desperdicado, e nao
 *    creditado no proximo abate.
 * 3. **O outro lado tambem tem relogio.** A ameaca deixa de ser uma media e passa
 *    a ser "quantos golpes ele conseguiu dar em voce ANTES de morrer".
 *
 * ## Sobre a velocidade
 *
 * Uma luta e uma dezena de eventos, e o catalogo inteiro sao ~167 mil lutas —
 * ainda menos de um segundo. Rapido nao e sinal de raso: o defeito que este
 * arquivo corrige nunca foi falta de CPU, foi a formula. O que a simulacao compra
 * e FIDELIDADE, e ela e barata.
 */

import type { AttackCategory, PokeType } from "./types";
import { huntEffectiveness } from "./combat";

// ---------------------------------------------------------------------------
// A formula de dano
// ---------------------------------------------------------------------------

/**
 * Dano de UM golpe.
 *
 * A forma e a canonica da serie, e a mudanca em relacao ao modelo anterior esta no
 * termo de NIVEL:
 *
 *     ((2*L/5 + 2) * Power * A/D) / 50 + 2
 *
 * O modelo antigo era `K * Power * (A/D)`, com `K = 0.28`. Ali o nivel so entrava
 * de contrabando, por dentro dos stats — e por isso precisava de um fator de
 * escala pra fechar a conta. Esse `K` nunca foi uma constante do jogo que alguem
 * mediu: era o RESTO de uma formula a que faltava um termo.
 *
 * Com o termo no lugar, nao ha o que calibrar. Se o jogo escalar diferente, o erro
 * vai aparecer como um desvio CONSTANTE contra as medidas do `npm run prever` — e
 * um desvio constante e uma constante que se mede, nao um fator que se chuta.
 *
 * `Math.max(1, ...)`: o jogo nunca aplica dano zero, e sem o piso um golpe de
 * poder baixo contra defesa alta zeraria e travaria a simulacao num laco infinito.
 */
export function danoDeGolpe(
  nivel: number,
  power: number,
  ataque: number,
  defesa: number,
  stab: number,
  efetividade: number,
): number {
  const base = ((2 * nivel) / 5 + 2) * power * (ataque / Math.max(1, defesa));
  return Math.max(1, (base / 50 + 2) * stab * efetividade);
}

// ---------------------------------------------------------------------------
// As partes
// ---------------------------------------------------------------------------

export interface GolpeSim {
  type: PokeType;
  power: number;
  category: AttackCategory;
  cooldownMs: number;
}

export interface LadoSim {
  nivel: number;
  t1: PokeType;
  t2: PokeType | null;
  hp: number;
  atk: number;
  spa: number;
  def: number;
  spDef: number;
  golpes: GolpeSim[];
}

export interface ResultadoLuta {
  /** segundos de COMBATE ate o alvo cair. Nao inclui spawn nem aproximacao. */
  segundos: number;
  /** golpes que o lutador chegou a dar */
  golpesDados: number;
  /** dano do golpe mais forte que ele tem contra ESTE alvo (o que a tela mostra) */
  maiorDano: number;
  tipoDoMaior: PokeType | null;
  categoriaDoMaior: AttackCategory | null;
  efetividadeDoMaior: number;
  /** dano que o ALVO conseguiu aplicar no lutador durante a luta */
  danoSofrido: number;
  /** o lutador venceu? `false` = nao consegue matar dentro do teto de tempo */
  venceu: boolean;
  /** quantas lutas inteiras ele aguenta com a vida cheia, sem cura */
  lutasPorVida: number;
}

/**
 * Teto de duracao de UMA luta.
 *
 * Nao e balanceamento, e seguranca: sem ele, um lutador cujo unico golpe e imune
 * contra o alvo faz a simulacao andar pra sempre. Sessenta segundos e muito acima
 * de qualquer luta real deste jogo — quem passa disso nao esta "demorando", esta
 * impossibilitado, e o resultado certo pra ele e `venceu: false`.
 */
const TETO_S = 60;

/** STAB: o golpe do mesmo tipo do lutador bate 1,5x. Regra da serie, confirmada no jogo. */
const stabDe = (l: LadoSim, g: GolpeSim): number => (g.type === l.t1 || g.type === l.t2 ? 1.5 : 1);

/** O dano que `de` aplica em `para` com este golpe, ja com tipo e STAB. */
function dano(de: LadoSim, para: LadoSim, g: GolpeSim): number {
  const eff = huntEffectiveness(g.type, para.t1, para.t2);
  if (eff <= 0) return 0; // imune: nao entra na fila
  const ataque = g.category === "SPECIAL" ? de.spa : de.atk;
  const defesa = g.category === "SPECIAL" ? para.spDef : para.def;
  return danoDeGolpe(de.nivel, g.power, ataque, defesa, stabDe(de, g), eff);
}

/**
 * Simula UMA luta ate alguem cair.
 *
 * O laco e por EVENTO e nao por tick de tempo fixo: andar de 100ms em 100ms
 * gastaria 600 passos numa luta de um golpe e ainda erraria a recarga por
 * arredondamento. Aqui o relogio pula direto pro proximo golpe que fica pronto, o
 * que e exato e custa uma dezena de iteracoes.
 */
export function simular(lutador: LadoSim, alvo: LadoSim): ResultadoLuta {
  // Pre-computa o dano de cada golpe: ele nao muda durante a luta, e recalcular
  // dentro do laco multiplicaria o custo pelo numero de eventos sem mudar nada.
  const meus = lutador.golpes
    .map((g) => ({ g, d: dano(lutador, alvo, g) }))
    .filter((x) => x.d > 0 && x.g.cooldownMs > 0);
  const dele = alvo.golpes
    .map((g) => ({ g, d: dano(alvo, lutador, g) }))
    .filter((x) => x.d > 0 && x.g.cooldownMs > 0);

  const maior = meus.reduce<{ g: GolpeSim; d: number } | null>(
    (m, x) => (!m || x.d > m.d ? x : m),
    null,
  );

  if (!meus.length) {
    return {
      segundos: TETO_S, golpesDados: 0,
      maiorDano: 0, tipoDoMaior: null, categoriaDoMaior: null, efetividadeDoMaior: 0,
      danoSofrido: 0, venceu: false, lutasPorVida: 0,
    };
  }

  /**
   * O relogio de cada golpe.
   *
   * Todos comecam PRONTOS (t = 0), e isso e uma decisao com consequencia: numa
   * luta de um hit, quem tem oito golpes prontos escolhe o melhor deles, enquanto
   * comecar com as recargas escalonadas faria o resultado depender de uma ordem
   * arbitraria. Entrar em campo com tudo carregado tambem e o que acontece no
   * jogo — a recarga corre durante a luta, nao antes dela.
   */
  const meuT = meus.map(() => 0);
  const deleT = dele.map(() => 0);

  let hpAlvo = alvo.hp;
  let hpMeu = lutador.hp;
  let t = 0;
  let golpesDados = 0;
  let sofrido = 0;

  while (hpAlvo > 0 && t < TETO_S) {
    // O proximo instante em que QUALQUER golpe dos dois lados fica pronto.
    let prox = Infinity;
    for (const x of meuT) if (x < prox) prox = x;
    for (const x of deleT) if (x < prox) prox = x;
    if (!Number.isFinite(prox)) break;
    t = Math.max(t, prox);

    // Meus golpes prontos agora. O MAIS FORTE primeiro: com o alvo prestes a
    // cair, gastar o fraco antes seria jogar fora o abate mais rapido — e o jogo
    // dispara o que esta pronto, entao a ordem entre simultaneos e nossa.
    const prontos = meus
      .map((x, i) => ({ ...x, i }))
      .filter((x) => meuT[x.i] <= t + 1e-9)
      .sort((a, b) => b.d - a.d);

    for (const p of prontos) {
      if (hpAlvo <= 0) break;
      hpAlvo -= p.d; // o excedente se PERDE: overkill nao adianta o proximo abate
      golpesDados++;
      meuT[p.i] = t + p.g.cooldownMs / 1000;
    }
    if (hpAlvo <= 0) break;

    // O alvo revida com o que dele estiver pronto.
    for (let i = 0; i < dele.length; i++) {
      if (deleT[i] > t + 1e-9) continue;
      hpMeu -= dele[i].d;
      sofrido += dele[i].d;
      deleT[i] = t + dele[i].g.cooldownMs / 1000;
    }
  }

  const venceu = hpAlvo <= 0;
  const segundos = venceu ? Math.max(t, 0) : TETO_S;

  /**
   * Quantas lutas ele aguenta com a vida cheia.
   *
   * `Infinity` quando o alvo nao consegue arranhar — e o caso do lutador muito
   * acima da hunt, que e o caso comum de quem usa a ferramenta. Quem chama
   * converte pro teto que a tela suporta; aqui o valor honesto e "nao morre".
   */
  const lutasPorVida = sofrido > 0 ? lutador.hp / sofrido : Infinity;

  return {
    segundos,
    golpesDados,
    maiorDano: maior?.d ?? 0,
    tipoDoMaior: maior?.g.type ?? null,
    categoriaDoMaior: maior?.g.category ?? null,
    efetividadeDoMaior: maior ? huntEffectiveness(maior.g.type, alvo.t1, alvo.t2) : 0,
    danoSofrido: sofrido,
    venceu,
    lutasPorVida,
  };
}

/**
 * A CACADA SUSTENTADA — n abates seguidos, com as recargas atravessando.
 *
 * Simular UMA luta isolada responde "quanto tempo pra matar este bicho", e essa
 * nao e a pergunta da ferramenta. A pergunta e "quantos abates por hora", e as
 * duas divergem por um motivo concreto: **a recarga nao zera quando o alvo
 * morre**.
 *
 * O erro que isso produz e grande e foi medido. Com as recargas comecando
 * limpas a cada luta, um lutador que one-shota mata em t=0 — combate zero — e a
 * hora inteira vira 3600/overhead. No Golem contra Furious Scyther isso deu 1091
 * abates/h contra 763 observados: +43%.
 *
 * O que acontece de verdade: o primeiro alvo morre no golpe mais forte, e o
 * SEGUNDO aparece com esse golpe ainda descarregando. Ou ele espera, ou mata com
 * um golpe pior. Os dois custam tempo, e nenhum dos dois existe numa luta isolada.
 *
 * Por isso a conta certa e a de REGIME: roda uma sequencia, descarta o comeco (que
 * comeca com tudo carregado e nao se repete) e mede o ritmo do resto.
 */
export interface RitmoCacada {
  /** segundos por abate em REGIME, ja incluindo o intervalo entre alvos */
  segundosPorAbate: number;
  /** so a parte de combate, sem o intervalo */
  combateS: number;
  /** o lutador consegue matar? */
  viavel: boolean;
  /** quantos abates ele aguenta antes de cair, sem cura */
  abatesPorVida: number;
  maiorDano: number;
  tipoDoMaior: PokeType | null;
  categoriaDoMaior: AttackCategory | null;
  efetividadeDoMaior: number;
}

/** Abates simulados. Poucos bastam: o regime se estabelece rapido, e cada um custa
 *  uma dezena de eventos. Os dois primeiros sao descartados como transitorio. */
const ABATES_SIM = 12;
const DESCARTE = 2;

export function ritmoDeCacada(
  lutador: LadoSim,
  alvo: LadoSim,
  /** segundos entre um alvo morrer e o proximo estar ao alcance (spawn, aproximacao) */
  intervaloS: number,
): RitmoCacada {
  const meus = lutador.golpes
    .map((g) => ({ g, d: dano(lutador, alvo, g) }))
    .filter((x) => x.d > 0 && x.g.cooldownMs > 0);
  const dele = alvo.golpes
    .map((g) => ({ g, d: dano(alvo, lutador, g) }))
    .filter((x) => x.d > 0 && x.g.cooldownMs > 0);

  const maior = meus.reduce<{ g: GolpeSim; d: number } | null>(
    (m, x) => (!m || x.d > m.d ? x : m),
    null,
  );

  const vazio: RitmoCacada = {
    segundosPorAbate: TETO_S, combateS: TETO_S, viavel: false, abatesPorVida: 0,
    maiorDano: 0, tipoDoMaior: null, categoriaDoMaior: null, efetividadeDoMaior: 0,
  };
  if (!meus.length) return vazio;

  const meuT = meus.map(() => 0);
  const deleT = dele.map(() => 0);
  let t = 0;
  let sofridoTotal = 0;
  let tRegime = 0;
  let combateRegime = 0;

  for (let k = 0; k < ABATES_SIM; k++) {
    const inicio = t;
    let hpAlvo = alvo.hp;
    let guarda = 0;

    while (hpAlvo > 0 && guarda++ < 400) {
      let prox = Infinity;
      for (const x of meuT) if (x < prox) prox = x;
      for (const x of deleT) if (x < prox) prox = x;
      if (!Number.isFinite(prox)) break;
      t = Math.max(t, prox);
      if (t - inicio > TETO_S) break;

      const prontos = meus
        .map((x, i) => ({ ...x, i }))
        .filter((x) => meuT[x.i] <= t + 1e-9)
        .sort((a, b) => b.d - a.d);
      for (const p of prontos) {
        if (hpAlvo <= 0) break;
        hpAlvo -= p.d;
        meuT[p.i] = t + p.g.cooldownMs / 1000;
      }
      if (hpAlvo <= 0) break;

      for (let i = 0; i < dele.length; i++) {
        if (deleT[i] > t + 1e-9) continue;
        sofridoTotal += dele[i].d;
        deleT[i] = t + dele[i].g.cooldownMs / 1000;
      }
    }

    if (hpAlvo > 0) return vazio; // nao mata dentro do teto: hunt inviavel

    const combate = t - inicio;
    // O intervalo entre alvos corre com as recargas ANDANDO — e essa a diferenca
    // que faz o regime existir: quem tem golpe de recarga curta chega no proximo
    // alvo pronto, quem tem golpe lento chega esperando.
    t += intervaloS;
    if (k >= DESCARTE) {
      tRegime += combate + intervaloS;
      combateRegime += combate;
    }
  }

  const n = ABATES_SIM - DESCARTE;
  const porAbate = tRegime / n;
  const sofridoPorAbate = sofridoTotal / ABATES_SIM;

  return {
    segundosPorAbate: porAbate,
    combateS: combateRegime / n,
    viavel: true,
    abatesPorVida: sofridoPorAbate > 0 ? lutador.hp / sofridoPorAbate : Infinity,
    maiorDano: maior?.d ?? 0,
    tipoDoMaior: maior?.g.type ?? null,
    categoriaDoMaior: maior?.g.category ?? null,
    efetividadeDoMaior: maior ? huntEffectiveness(maior.g.type, alvo.t1, alvo.t2) : 0,
  };
}
