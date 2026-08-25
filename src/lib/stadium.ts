// A ARENA: seis pokémon contra um boss, e o combate inteiro simulado.
//
// ## Por que não é o duelo rodado seis vezes
//
// O Duelo do `/meta` responde "este ganha daquele?" — um contra um, os dois com a
// vida cheia. A arena responde outra coisa: "o meu TIME derruba este boss?". E a
// diferença entre as duas não é de escala, é de mecânica. Três coisas só existem
// aqui:
//
//  1. **O HP do boss atravessa.** O segundo pokémon não entra contra um boss
//     inteiro — entra contra o que sobrou. É por isso que um time de seis
//     medianos derruba o que nenhum deles derruba sozinho, e nenhuma soma de
//     duelos individuais consegue dizer isso.
//  2. **A recarga do boss atravessa também.** Ele estava lutando quando o seu
//     caiu; não recomeça com todos os golpes prontos. Quem entra depois pega o
//     boss no meio da recarga, e isso é tempo de graça que a luta isolada não tem.
//  3. **Quem entra chega com a recarga ZERADA.** Acabou de entrar em campo: o
//     primeiro golpe custa a própria recarga (é a mesma regra do `sim.ts`, e o
//     motivo está lá — sem ela, todo one-shot termina no instante zero e a
//     velocidade de ataque deixa de separar dois lutadores).
//
// Então o laço é UM só, com o lado do jogador trocando de lutador quando o atual
// cai. A fórmula de dano é a do `sim.ts` (`danoEntre`), importada e não copiada:
// a mesma dupla tem de sair com o mesmo número aqui e no Duelo.
//
// ## O que este motor NÃO sabe
//
// O jogo aplica uma penalidade de GRUPO que não está publicada. O
// `/api/game/boss` devolve, por boss, algo como
// `{members: 6, strength: 2.46, deficit: 3.54, mult: 48.69}` — e `mult` é
// exatamente `3^deficit`, com `deficit = members - strength`. Ou seja: faltar
// "força" no grupo multiplica alguma coisa por dezenas de vezes.
//
// O que a fonte não diz é DUAS coisas: como `strength` é calculada, e o que
// `mult` multiplica (HP do boss? dano que ele dá? recompensa?). Sem as duas, pôr
// o fator na conta seria inventar um número com três casas de precisão em cima de
// um mecanismo que ninguém mediu — e ele é grande o bastante pra dominar todo o
// resto do resultado.
//
// Fica de fora da conta e DENTRO da tela, como aviso. A alternativa (embutir um
// chute) devolveria um combate cujo resultado é a penalidade, não o time.

import { danoEntre, type GolpeSim, type LadoSim } from "./sim";
import { huntEffectiveness } from "./combat";
import { projectAll } from "./stats";
import type { MetaMon, MovePool } from "./meta";
import type { Attack, PokeType } from "./types";

/** Reforço do lado selvagem/boss, como o jogo documenta na caçada. */
const REFORCO_HP = 5;
const REFORCO_DANO = 1.8;

/**
 * Teto de duração do combate inteiro, em segundos.
 *
 * Não é balanceamento, é trava de laço — a mesma razão do `TETO_S` do `sim.ts`,
 * só que aqui o teto cobre a passagem dos seis. Quinze minutos é muito acima de
 * qualquer combate real; quem passa disso não está demorando, está travado (o
 * time não fura a defesa e o boss não fura a nossa), e a resposta certa pra ele é
 * "não acaba", não um vencedor.
 */
const TETO_S = 900;

/** Um pokémon concreto no ringue: espécie mais o que o indivíduo tem. */
export interface ArenaMon {
  mon: MetaMon;
  level: number;
  quality: number;
  /** na ordem hp, atk, def, spAtk, spDef, speed */
  ivs: number[];
}

/** O alvo. `reforco` liga o que o jogo dá a selvagem e boss: HP x5 e dano x1.8. */
export interface ArenaAlvo extends ArenaMon {
  reforco: boolean;
}

/** A passagem de UM membro pelo ringue — do momento em que entra ao em que sai. */
export interface Passagem {
  /** posição no time, 0-based */
  slot: number;
  mon: MetaMon;
  /** segundo do combate em que ele entrou */
  entrouEm: number;
  /** quanto tempo ele ficou */
  segundos: number;
  danoDado: number;
  danoSofrido: number;
  /** fração do HP do alvo (0..1) quando entrou e quando saiu */
  hpAlvoAntes: number;
  hpAlvoDepois: number;
  /** fração da vida DELE que sobrou (0 = caiu) */
  hpRestante: number;
  caiu: boolean;
  /** foi ele que derrubou o boss */
  derrubou: boolean;
  /** nunca chegou a bater: nenhum golpe dele atravessa o tipo do alvo */
  inerte: boolean;
}

export interface ResultadoArena {
  vitoria: boolean;
  /** o combate bateu no teto sem ninguém cair — ver `TETO_S` */
  travou: boolean;
  segundos: number;
  passagens: Passagem[];
  /** quantos do time caíram */
  quedas: number;
  /** quantos nem chegaram a entrar (o boss caiu antes) */
  reserva: number;
  /** fração do HP do alvo que sobrou, 0..1 */
  hpAlvoRestante: number;
  danoTotal: number;
  /** slot de quem tirou mais HP do boss; null com time vazio */
  carregou: number | null;
}

/** O retrato de um membro MEDIDO CONTRA ESTE ALVO — o que a carta dele mostra. */
export interface FichaMembro {
  slot: number;
  mon: MetaMon;
  /** os seis stats projetados, na ordem canônica */
  stats: number[];
  power: number;
  /** o golpe de maior dano dele contra este alvo */
  golpe: Attack | null;
  tipo: PokeType | null;
  /** efetividade amplificada desse golpe */
  eff: number;
  /** dano do golpe mais forte, num acerto */
  maiorDano: number;
  /** dano por segundo do moveset inteiro contra este alvo */
  dps: number;
  /** segundos pra derrubar o boss SOZINHO; Infinity quando não derruba */
  ttkSozinho: number;
  /** segundos até ele cair sozinho; Infinity quando o boss não o machuca */
  ttdSozinho: number;
  /** ele ganha o 1x1 contra o boss */
  venceSozinho: boolean;
  /** fração do HP do boss que ele tira antes de cair (0..1) — a nota da arena */
  fatia: number;
}

// ---------------------------------------------------------------- as partes

const ofensivo = (a: Attack): boolean => a.power > 0 && a.category !== "STATUS" && a.cooldownMs > 0;
const noPool = (a: Attack, pool: MovePool): boolean => pool === "tm" || a.tm == null;

/** Os golpes que este indivíduo TEM: ofensivos, já aprendidos e dentro do pool. */
function golpesDe(a: ArenaMon, pool: MovePool): GolpeSim[] {
  return a.mon.attacks
    .filter((mv) => ofensivo(mv) && mv.learnLevel <= a.level && noPool(mv, pool))
    .map((mv) => ({
      type: mv.type,
      power: mv.power,
      category: mv.category,
      cooldownMs: mv.cooldownMs,
    }));
}

const bases = (m: MetaMon): number[] => [
  m.baseHp, m.baseAtk, m.baseDef, m.baseSpAtk, m.baseSpDef, m.baseSpeed,
];

/**
 * Converte um pokémon da arena no lado que o simulador entende.
 *
 * O reforço de HP entra AQUI e não no laço, porque ele é uma propriedade do
 * lutador (o boss tem cinco vidas), não do golpe. Já o reforço de DANO fica de
 * fora: ele multiplica o golpe, e quem aplica é quem bate.
 */
function ladoDe(a: ArenaMon, pool: MovePool, reforcoHp = false): LadoSim & { power: number; stats: number[] } {
  const p = projectAll(bases(a.mon), a.ivs, a.level, a.quality);
  return {
    nivel: a.level,
    t1: a.mon.type1,
    t2: a.mon.type2,
    hp: p.stats[0] * (reforcoHp ? REFORCO_HP : 1),
    atk: p.stats[1],
    spa: p.stats[3],
    def: p.stats[2],
    spDef: p.stats[4],
    golpes: golpesDe(a, pool),
    stats: p.stats,
    power: p.power,
  };
}

/**
 * Golpes com o dano contra o alvo já resolvido; sem os que não atravessam.
 *
 * `alinhado` é o que separa o lado do JOGADOR do lado do BOSS, e a distinção
 * custou um bug: o relógio de recarga do boss atravessa a troca de lutador, mas
 * o que ele acerta muda junto — um golpe Elétrico some da lista contra um membro
 * Terra e volta contra o próximo. Com a lista FILTRADA, o índice 2 deixa de ser o
 * mesmo golpe entre um membro e outro, e o relógio guardado passa a valer pra
 * outra recarga: um golpe de 30s herdava o relógio de um de 5s e disparava seis
 * vezes mais.
 *
 * Alinhado, o índice é sempre o do moveset do boss, e o golpe que não atravessa
 * fica com dano zero em vez de sair da lista. O lado do jogador não precisa
 * disso — ele entra com o relógio zerado — então lá a filtragem continua.
 */
function armar(de: LadoSim, para: LadoSim, mult: number, alinhado = false) {
  const todos = de.golpes.map((g) => ({ g, d: danoEntre(de, para, g) * mult }));
  return alinhado ? todos : todos.filter((x) => x.d > 0);
}

// ---------------------------------------------------------------- o combate

/**
 * O combate inteiro: o time entra em fila contra o alvo, um de cada vez.
 *
 * O laço é por EVENTO (o próximo golpe que fica pronto, dos dois lados) e não por
 * tique de tempo — exato e barato, ver `sim.ts`. O que ele guarda a mais é a
 * passagem de cada membro, porque é ela que responde a pergunta da tela: não
 * "quem ganhou", e sim ONDE o time quebrou.
 *
 * A ordem do time é a ordem de entrada, e ela importa: o jogador escolhe quem
 * segura o começo. A ferramenta não reordena por conta própria — reordenar seria
 * responder uma pergunta que ele não fez, e escondendo que respondeu.
 */
export function simularArena(
  time: ArenaMon[],
  alvo: ArenaAlvo,
  pool: MovePool = "natural",
): ResultadoArena {
  const vazio: ResultadoArena = {
    vitoria: false, travou: false, segundos: 0, passagens: [],
    quedas: 0, reserva: 0, hpAlvoRestante: 1, danoTotal: 0, carregou: null,
  };
  if (!time.length) return vazio;

  // A TM é do jogador: o boss bate sempre com o moveset natural da espécie dele.
  const ladoAlvo = ladoDe(alvo, "natural", alvo.reforco);
  const hpAlvoCheio = ladoAlvo.hp;
  if (hpAlvoCheio <= 0) return vazio;

  const multAlvo = alvo.reforco ? REFORCO_DANO : 1;

  // O relógio do boss nasce na própria recarga e NÃO é reiniciado entre membros:
  // é a mecânica 2 do cabeçalho deste arquivo. Ele é indexado pelo moveset do
  // boss, e não pela lista do que acerta — ver `armar`.
  const relAlvo = ladoAlvo.golpes.map((g) => g.cooldownMs / 1000);
  let armasAlvo: { g: GolpeSim; d: number }[] = [];

  const passagens: Passagem[] = [];
  let hpAlvo = hpAlvoCheio;
  let t = 0;
  let travou = false;

  for (let slot = 0; slot < time.length && hpAlvo > 0 && !travou; slot++) {
    const membro = time[slot];
    const lado = ladoDe(membro, pool);
    const minhas = armar(lado, ladoAlvo, 1);

    // As armas do boss dependem de QUEM está na frente dele (tipo e defesa do
    // membro atual), então elas são refeitas a cada troca. Os RELÓGIOS não —
    // são os mesmos golpes, com a mesma recarga correndo.
    armasAlvo = armar(ladoAlvo, lado, multAlvo, true);

    const relMeu = minhas.map((x) => x.g.cooldownMs / 1000);
    let hpMeu = lado.hp;
    const entrouEm = t;
    const hpAlvoAntes = hpAlvo / hpAlvoCheio;
    let danoDado = 0;
    let danoSofrido = 0;

    // Nenhum dos dois atravessa o outro: o combate não anda, e rodar o laço até
    // o teto chegaria no mesmo lugar quinze minutos depois.
    const alvoMachuca = armasAlvo.some((x) => x.d > 0);
    if (!minhas.length && !alvoMachuca) travou = true;

    while (hpAlvo > 0 && hpMeu > 0 && !travou) {
      let prox = Infinity;
      for (const x of relMeu) if (x < prox) prox = x;
      for (let i = 0; i < relAlvo.length; i++) if (relAlvo[i] < prox) prox = relAlvo[i];
      if (!Number.isFinite(prox)) { travou = true; break; }
      t = Math.max(t, prox);
      if (t > TETO_S) { travou = true; break; }

      // Meus golpes prontos, o MAIS FORTE primeiro: com o boss quase caindo,
      // gastar o fraco antes jogaria fora a queda mais rápida. O jogo dispara o
      // que está pronto, então a ordem entre simultâneos é nossa.
      const prontos = minhas
        .map((x, i) => ({ ...x, i }))
        .filter((x) => relMeu[x.i] <= t + 1e-9)
        .sort((a, b) => b.d - a.d);
      for (const p of prontos) {
        if (hpAlvo <= 0) break;
        // O excedente se perde: overkill não adianta nada, e creditar o que
        // passou do zero inflaria o dano de quem derruba.
        danoDado += Math.min(p.d, hpAlvo);
        hpAlvo -= p.d;
        relMeu[p.i] = t + p.g.cooldownMs / 1000;
      }
      if (hpAlvo <= 0) break;

      // O boss revida com tudo que estiver pronto. O golpe que NÃO atravessa
      // (dano zero contra este membro) mesmo assim sai e volta pra recarga: ele
      // continua sendo disparado no jogo, e é isso que deixa o relógio no ciclo
      // certo pra quando o próximo membro entrar — contra ele o mesmo golpe pode
      // machucar.
      for (let i = 0; i < armasAlvo.length; i++) {
        if (relAlvo[i] > t + 1e-9) continue;
        hpMeu -= armasAlvo[i].d;
        danoSofrido += armasAlvo[i].d;
        relAlvo[i] = t + armasAlvo[i].g.cooldownMs / 1000;
      }
    }

    const caiu = hpMeu <= 0;
    passagens.push({
      slot,
      mon: membro.mon,
      entrouEm: Math.round(entrouEm * 10) / 10,
      segundos: Math.round((t - entrouEm) * 10) / 10,
      danoDado,
      danoSofrido,
      hpAlvoAntes,
      hpAlvoDepois: Math.max(0, hpAlvo) / hpAlvoCheio,
      hpRestante: caiu ? 0 : Math.max(0, hpMeu) / lado.hp,
      caiu,
      derrubou: hpAlvo <= 0,
      inerte: minhas.length === 0,
    });
  }

  const danoTotal = passagens.reduce((s, p) => s + p.danoDado, 0);
  let lider: Passagem | null = null;
  for (const p of passagens) if (!lider || p.danoDado > lider.danoDado) lider = p;
  const carregou = lider?.slot ?? null;

  return {
    vitoria: hpAlvo <= 0,
    travou,
    segundos: Math.round(t * 10) / 10,
    passagens,
    quedas: passagens.filter((p) => p.caiu).length,
    reserva: time.length - passagens.length,
    hpAlvoRestante: Math.max(0, hpAlvo) / hpAlvoCheio,
    danoTotal,
    carregou,
  };
}

/**
 * O retrato de um membro contra este alvo.
 *
 * A medida que interessa é a `fatia`: quanto do boss ele leva embora ANTES de
 * cair. É ela que se soma entre os seis — DPS alto num pokémon que aguenta dois
 * golpes não derruba nada, e "aguenta muito" sem dano também não. A fatia junta
 * os dois eixos numa grandeza que a pessoa consegue somar de cabeça: três de 40%
 * derrubam.
 *
 * Ela sai da MESMA simulação do combate de time, com o membro sozinho — e não de
 * uma fórmula paralela. Fórmula paralela é como duas telas passam a discordar.
 */
export function fichaDe(
  membro: ArenaMon,
  slot: number,
  alvo: ArenaAlvo,
  pool: MovePool = "natural",
): FichaMembro {
  const lado = ladoDe(membro, pool);
  const ladoAlvo = ladoDe(alvo, "natural", alvo.reforco);

  let golpe: Attack | null = null;
  let maiorDano = 0;
  let dps = 0;
  for (const mv of membro.mon.attacks) {
    if (!ofensivo(mv) || mv.learnLevel > membro.level || !noPool(mv, pool)) continue;
    const d = danoEntre(lado, ladoAlvo, {
      type: mv.type, power: mv.power, category: mv.category, cooldownMs: mv.cooldownMs,
    });
    if (d <= 0) continue; // imune: não entra na conta
    dps += d / (mv.cooldownMs / 1000);
    if (d > maiorDano) { maiorDano = d; golpe = mv; }
  }

  const solo = simularArena([membro], alvo, pool);
  const p = solo.passagens[0];

  return {
    slot,
    mon: membro.mon,
    stats: lado.stats,
    power: lado.power,
    golpe,
    tipo: golpe?.type ?? null,
    eff: golpe ? huntEffectiveness(golpe.type, alvo.mon.type1, alvo.mon.type2) : 0,
    maiorDano,
    dps,
    ttkSozinho: solo.vitoria ? solo.segundos : Infinity,
    ttdSozinho: p?.caiu ? p.segundos : Infinity,
    venceSozinho: solo.vitoria,
    fatia: p ? Math.min(1, p.hpAlvoAntes - p.hpAlvoDepois) : 0,
  };
}

/**
 * Quem do time é a melhor escolha contra este alvo.
 *
 * O critério é a `fatia`, e o desempate é o DPS. Não é "o de maior poder": poder
 * é soma de stat, e soma de stat não sabe com que tipo o boss bate — é
 * exatamente o número que manda um Machamp de poder altíssimo pra cima de um
 * boss Psíquico.
 */
export function melhorDoTime(fichas: FichaMembro[]): FichaMembro | null {
  let melhor: FichaMembro | null = null;
  for (const f of fichas) {
    if (!melhor || f.fatia > melhor.fatia || (f.fatia === melhor.fatia && f.dps > melhor.dps)) {
      melhor = f;
    }
  }
  return melhor;
}

/**
 * A penalidade de grupo do jogo, como ela é observada — e nada além disso.
 *
 * O `/api/game/boss` devolve `mult` e `deficit` por boss, e a relação entre os
 * dois é exata: `mult = 3^deficit`. Isto está aqui pra a tela poder DIZER o
 * tamanho do que ela não está calculando ("faltando 3,5 de força, o jogo
 * multiplica por ~49"), e não pra entrar em conta nenhuma — ver o cabeçalho.
 */
export const penalidadeDeGrupo = (deficit: number): number => Math.pow(3, Math.max(0, deficit));

export const ARENA_MEMBROS = 6;
export { REFORCO_HP, REFORCO_DANO };
