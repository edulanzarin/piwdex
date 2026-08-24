// Motor de meta do piwdex: quem presta, contra quem, e por que.
//
// O piwtools mede o ataque como `poder x stat base` e a defesa como `hp+def+spDef`,
// soma com 55/35/10 (o 10 e VELOCIDADE) e corta o tier por POSICAO na fila. Os tres
// pontos sao furados, e e aqui que o piwdex diverge de proposito:
//
//  1. COOLDOWN. `poder x stat` trata Solar Beam (160 de poder, 30s de recarga) igual a
//     um golpe de 160 com 5s. No Poke Idle World o combate nao tem turno — o golpe sai
//     quando a recarga acaba. Entao o que mata e DANO POR SEGUNDO, nao poder.
//  2. STAB. Golpe do proprio tipo bate 1.5x (mesma regra que o motor de hunt ja usa).
//  3. HP e DEFESA SE MULTIPLICAM. Somar `hp+def` diz que 200 de HP com 20 de Def e igual
//     a 20 de HP com 200 de Def; na pratica o primeiro aguenta 10x mais. O que se aguenta
//     e HP EFETIVO = hp x def.
//  4. VELOCIDADE NAO E UM TERCEIRO EIXO. A doc do jogo so usa Speed na soma do Power
//     exibido, e nenhum sistema publico dá a ela efeito em combate. O efeito que se
//     observa jogando e encurtar a recarga do golpe — se for isso, ela MULTIPLICA o eixo
//     ofensivo, nao se soma a ele. Sem a formula da haste nao da pra quantificar
//     o efeito multiplicativo — mas deixa-la de FORA tambem e uma escolha, e ela
//     custava: sem velocidade nenhuma, Gengar e Muk de poder parecido empatam, e
//     no jogo eles nao empatam.
//
//     Ela entrou como termo aditivo de peso pequeno (10%), medido e nao chutado:
//     `tools/engenharia-reversa.ts` varreu 231 combinacoes contra 35 posicoes
//     observadas, e o ajuste com velocidade sobe de 0,833 pra 0,920 de correlacao
//     de posto. Aditivo com peso baixo e uma APROXIMACAO do multiplicativo na
//     faixa em que os stats vivem — e a alternativa era ignorar o eixo inteiro.
//     Se um dia a formula da haste aparecer, isto vira multiplicacao e o peso sai.
//
// O TIER tambem muda de natureza. Cortar por posicao (top 10% = S) faz o tier significar
// "sua fila", nao "sua forca": se metade do catalogo fosse otima, 40% dela viraria B ou
// pior. Aqui o corte e por SCORE — tier vira nota. Ver TIER_CUTS.
//
// Tudo aqui e ESTIMATIVA de comparacao, igual ao combat.ts: serve pra ordenar espécie
// contra espécie, nao como numero exato do jogo.

import { amplify, hitDamage } from "./combat";
import { effectiveness } from "./typing";
import { projectAll } from "./stats";
import type { Attack, Creature, PokeType, Rarity } from "./types";

export type MovePool = "natural" | "tm";

/** O que o motor precisa saber de um pokemon. `MetaMon` (o snapshot inteiro) satisfaz
 *  isso, e o payload enxuto que a pagina manda pro browser tambem — assim o mesmo motor
 *  roda no servidor e no cliente sem o cliente baixar loot e descricao de 482 especies. */
export interface MetaMon {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
  huntLevel: number;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
  attacks: Attack[];
  area: string | null;
  captureBase: number | null;
}

/** Só pra deixar explicito que o snapshot serve de entrada sem conversao. */
export type FromCreature = Creature extends MetaMon ? true : never;

/**
 * Pesos do metaScore, e a VELOCIDADE entra como terceiro eixo.
 *
 * Bater e mais decisivo que aguentar numa hunt idle (o alvo morre antes de te
 * derrubar), mas quem nao aguenta rende zero — dai a ofensiva nao chegar a 70%.
 *
 * A velocidade faltava, e a falta era visivel: ela e o que separa um Gengar de um
 * Muk de poder parecido. Os tres numeros sairam de varredura sobre 35 posicoes
 * observadas (`tools/engenharia-reversa.ts`, 231 combinacoes), e o ajuste fecha em
 * correlacao de posto 0,92.
 *
 * Nao sao os pesos "do jogo" — sao os que melhor reproduzem o julgamento de quem
 * joga, que e a unica referencia que existe pra uma tier list. Se um dia houver
 * medicao melhor, a varredura roda de novo e estes numeros mudam.
 */
const W_OFFENSE = 0.55;
const W_BULK = 0.35;
const W_SPEED = 0.10;

export type Tier = "S" | "A" | "B" | "C" | "D" | "E";
export const TIERS: Tier[] = ["S", "A", "B", "C", "D", "E"];

// Cortes de tier por SCORE, um jogo por pool. Sao fixos: calibrados uma vez sobre a
// distribuicao real do catalogo e escritos aqui como numero, nao recalculados por tela.
// A diferenca pro corte por posicao (top 10% = S) aparece no patch: se o jogo buffar
// trinta especies, elas SOBEM de tier — no corte por posicao alguem teria que descer pra
// abrir vaga, porque a fila tem tamanho fixo.
//
// Sao dois jogos porque a forma da distribuicao muda com o pool: com TM ela e bimodal
// (o golpe de poder 600 abre um vale entre basico e evolucao final), sem TM ela e um
// morro so. O tier sempre responde "entre o que EU posso usar, quem presta?".
//
// RECALIBRADOS quando o eixo ofensivo trocou de grandeza (soma de DPS -> poder do
// melhor golpe). Os numeros antigos foram medidos contra a distribuicao velha, e
// mante-los teria posto 150 especies em S — o corte estava certo pra uma escala
// que deixou de existir. Corte herdado de outra grandeza e pior que corte nenhum,
// porque ele parece calibrado.
//
// Os valores saem da distribuicao medida (`tools/dist.ts`) nos cortes de 8/22/42/
// 65/85%, arredondados. O criterio continua sendo SCORE e nao posicao, pelo motivo
// no topo do arquivo: tier tem que significar forca, nao fila.
const TIER_CUTS: Record<MovePool, [Tier, number][]> = {
  natural: [["S", 77], ["A", 70], ["B", 64], ["C", 55], ["D", 48], ["E", -1]],
  tm: [["S", 76], ["A", 69], ["B", 50], ["C", 41], ["D", 36], ["E", -1]],
};

/**
 * Denominador dos eixos — FIXO, e essa e a questao.
 *
 * Os eixos eram normalizados pelo maior do catalogo corrente (`Math.max(...raw)`)
 * enquanto os cortes de tier acima sao numeros absolutos. Regua absoluta sobre
 * escala flutuante quebra exatamente a propriedade que o comentario dos cortes
 * promete: medido sobre o snapshot, bastava o jogo publicar UMA especie com 4x o
 * DPS do melhor atual pra `maxO` dobrar, todo `offense` cair pela metade e o tier
 * S ir de 22 especies pra ZERO — 308 especies trocando de tier sem nenhuma delas
 * ter sido tocada, e o Mewtwo caindo de 87 pra 59,6 por causa de um pokemon que
 * nem e ele.
 *
 * Com a referencia gravada aqui, o buff faz o que tem que fazer: quem foi buffado
 * SOBE e o resto fica onde estava. Um `offense` acima de 1 e legitimo e significa
 * "passou da melhor especie da ultima calibragem" — e o sinal de que esta na hora
 * de recalibrar este par junto com os cortes, num commit deliberado.
 *
 * Medidos em ago/2026 sobre `src/data/piwdex.json`, ja no eixo de SOMA do moveset
 * (`lin` = raiz, entao a unidade e a mesma dos eixos). O bulk nao depende do pool.
 */
const REF_OFFENSE: Record<MovePool, number> = { natural: 128.95, tm: 174.61 };
const REF_BULK = 135.97;

/** Cor do tier — escada quente->fria, mesma leitura do resto do site. Tokens do
 *  piwdex2: os do piwdex 1 (`--yellow` e companhia) nao existem aqui, e cor invalida
 *  vira cor herdada — a escada inteira saia branca sem dar erro nenhum. */
export const TIER_COLOR: Record<Tier, string> = {
  S: "var(--color-warn)", A: "var(--color-ok)", B: "var(--color-neon)",
  C: "var(--color-t-calc)", D: "var(--color-t-breed)", E: "var(--color-text-mute)",
};

export const tierOf = (score: number, pool: MovePool = "natural"): Tier =>
  (TIER_CUTS[pool].find(([, min]) => score >= min) ?? ["E", -1])[0] as Tier;

/** Score minimo de cada tier no pool — a tela usa pra mostrar a regua do corte. */
export const tierFloor = (tier: Tier, pool: MovePool): number =>
  TIER_CUTS[pool].find(([t]) => t === tier)?.[1] ?? 0;

// ---------------------------------------------------------------- pool de golpes

export const isTm = (a: Attack): boolean => a.tm != null;
export const inPool = (a: Attack, pool: MovePool): boolean => pool === "tm" || !isTm(a);

/** Golpe que causa dano (STATUS nao entra no calculo ofensivo). */
export const isOffensive = (a: Attack): boolean =>
  a.power > 0 && a.cooldownMs > 0 && (a.category === "PHYSICAL" || a.category === "SPECIAL");

/** Stat base que o golpe usa: Atk pro fisico, Sp.Atk pro especial. */
export const offStatOf = (c: MetaMon, a: Attack): number =>
  a.category === "SPECIAL" ? c.baseSpAtk : c.baseAtk;

export const hasStab = (c: MetaMon, a: Attack): boolean =>
  a.type === c.type1 || a.type === c.type2;

// ---------------------------------------------------------------- eixos do score

/** DPS neutro de UM golpe: dano por segundo contra um defensor generico, ja com STAB.
 *  Sem alvo, a defesa do outro lado e constante e nao muda ordem nenhuma — por isso ela
 *  fica de fora aqui e volta no matchup (dpsAgainst). */
export function moveDps(c: MetaMon, a: Attack): number {
  if (!isOffensive(a)) return 0;
  const stab = hasStab(c, a) ? 1.5 : 1;
  return (a.power * offStatOf(c, a) * stab) / (a.cooldownMs / 1000);
}

export interface ScoredMove {
  attack: Attack;
  dps: number;
  stab: boolean;
  tm: boolean;
}

/** Golpes ofensivos do pool, do maior DPS pro menor. */
export function scoredMoves(c: MetaMon, pool: MovePool): ScoredMove[] {
  return c.attacks
    .filter((a) => isOffensive(a) && inPool(a, pool))
    .map((a) => ({ attack: a, dps: moveDps(c, a), stab: hasStab(c, a), tm: isTm(a) }))
    .sort((x, y) => y.dps - x.dps || y.attack.power - x.attack.power || x.attack.learnLevel - y.attack.learnLevel);
}

/** O golpe de maior DPS — o que a TELA mostra ("quem carrega a especie").
 *  Nao e mais o que define velocidade: pra isso existe `poolDps`. */
export const bestMove = (c: MetaMon, pool: MovePool): ScoredMove | null =>
  scoredMoves(c, pool)[0] ?? null;

/**
 * DPS do MOVESET INTEIRO — a velocidade real da especie.
 *
 * O `combat.ts` ja tinha abandonado o melhor-golpe de proposito (ver o comentario
 * do `movesetDps` la): neste jogo cada golpe tem recarga propria e dispara sozinho
 * quando recarrega, entao ninguem "escolhe um" — o que fecha a conta e a SOMA das
 * recargas. O meta continuou medindo so o topo, e as duas telas passaram a dar
 * respostas diferentes pra mesma luta: razao soma/topo com mediana 3,07x no
 * catalogo, 6,33x no pior caso (Seviper, 8 golpes).
 *
 * E nao era so escala — era ORDEM: 292 das 434 especies jogaveis mudam mais de 20
 * posicoes no ranking ofensivo entre os dois criterios. Quem tem quatro golpes
 * medios bate mais que quem tem um bom e nada mais, e so a soma enxerga isso.
 */
export function poolDps(c: MetaMon, pool: MovePool): number {
  let total = 0;
  for (const a of c.attacks) {
    if (isOffensive(a) && inPool(a, pool)) total += moveDps(c, a);
  }
  return total;
}

/**
 * PODER do melhor golpe — o eixo ofensivo da tier list.
 *
 * Substitui a soma de DPS do moveset, e a troca tem duas evidencias por tras.
 *
 * ## A queixa
 *
 * Jogadores no Discord: "Miltank ta tier S e Rhydon nao", "Meganium, farfetchd,
 * heracross tudo ta tier S por 0 motivo". Todos de moveset largo. A soma premiava
 * a LARGURA do moveset, e nao a forca dele.
 *
 * ## A medida
 *
 * `tools/engenharia-reversa.ts` testou formulas candidatas contra 35 posicoes
 * observadas da lista concorrente — a que os jogadores consideram certa. O melhor
 * golpe sozinho reproduz a ordem com correlacao de posto 0,784; a soma nao chega
 * perto. E dividir por recarga PIORA: de 0,833 pra 0,291.
 *
 * ## Por que dividir por recarga piora, se DPS e "mais correto"
 *
 * Porque no regime deste jogo quase tudo one-shota. Quando o alvo morre no
 * primeiro golpe, o segundo nunca sai — e ai o que decide nao e quantos golpes
 * por segundo voce daria, e QUAL golpe voce da. Velocidade nao some do modelo:
 * ela migra pro eixo proprio (`baseSpeed`), com peso pequeno, que e onde ela de
 * fato pesa.
 *
 * Cooldown continua mandando na HUNT, onde o combate e sustentado e os relogios
 * atravessam os abates — la o `sim.ts` mede isso direito. Sao regimes diferentes,
 * e usar a mesma grandeza nos dois era o erro.
 */
export function melhorPoder(c: MetaMon, pool: MovePool): number {
  let melhor = 0;
  for (const a of c.attacks) {
    if (!isOffensive(a) || !inPool(a, pool)) continue;
    const stab = hasStab(c, a) ? 1.5 : 1;
    const p = a.power * stab * offStatOf(c, a);
    if (p > melhor) melhor = p;
  }
  return melhor;
}

/** HP efetivo: quanto de dano a especie absorve antes de cair, na media dos dois lados
 *  (fisico e especial). E um PRODUTO — e por isso que somar hp+def esconde o tanque. */
export const effectiveHp = (c: MetaMon): number =>
  c.baseHp * ((c.baseDef + c.baseSpDef) / 2);

/** Bulk so contra um lado, pra quando a pergunta e "ele aguenta golpe fisico?". */
export const effectiveHpVs = (c: MetaMon, side: "physical" | "special"): number =>
  c.baseHp * (side === "physical" ? c.baseDef : c.baseSpDef);

// DPS e HP efetivo sao ambos PRODUTO de dois stats, entao crescem quadraticamente e a
// distribuicao fica com cauda longa. A raiz devolve os dois pra escala linear de stat,
// que e onde a normalizacao se comporta e o score fica legivel.
const lin = (x: number): number => Math.sqrt(Math.max(0, x));

// ---------------------------------------------------------------- catalogo e ranking

/** Conjunto jogavel: tira as variantes de skin (Brave Blastoise e companhia apontam pra
 *  base com `captureBase` e nao sao uma linha propria do catalogo) e mantem Orre, que tem
 *  stats proprios. Sem isso a mesma especie aparece 2x na tier list. */
export const playableSet = (creatures: MetaMon[]): MetaMon[] =>
  creatures.filter((c) => c.captureBase == null || c.area === "orre");

export interface MetaEntry {
  creature: MetaMon;
  /** Nota 0..100 combinando ataque e resistencia. */
  score: number;
  tier: Tier;
  position: number;
  /** Quanto do topo do catalogo esse pokemon alcanca em cada eixo (0..1). */
  offense: number;
  bulk: number;
  /** Numeros crus por tras dos eixos. */
  dps: number;
  ehp: number;
  best: ScoredMove | null;
  /** Power do jogo: soma dos 6 stats base (a Quality do individuo entra depois). */
  basePower: number;
}

/** Tier list completa do conjunto jogavel, no pool pedido.
 *  Cada eixo e normalizado pelo MAIOR do catalogo — assim "100 de ataque" quer dizer
 *  "o melhor golpe do jogo", uma referencia que nao muda quando o filtro da tela muda. */
export function metaTable(creatures: MetaMon[], pool: MovePool = "natural"): MetaEntry[] {
  const set = playableSet(creatures);
  const raw = set.map((c) => {
    const best = bestMove(c, pool);
    const dps = poolDps(c, pool);
    const ehp = effectiveHp(c);
    return {
      creature: c,
      best,
      dps,
      ehp,
      // Os tres eixos CRUS. A raiz saiu do ofensivo: ela existia porque `poolDps`
      // era produto de dois stats e crescia quadraticamente; `melhorPoder` tambem
      // e produto, entao a raiz fica — o que muda e a grandeza dentro dela.
      o: lin(melhorPoder(c, pool)),
      b: lin((c.baseHp + c.baseDef + c.baseSpDef) / 3),
      v: c.baseSpeed,
    };
  });

  const maxO = Math.max(1e-9, ...raw.map((r) => r.o));
  const maxB = Math.max(1e-9, ...raw.map((r) => r.b));
  const maxV = Math.max(1e-9, ...raw.map((r) => r.v));

  return raw
    .map((r) => {
      // Normaliza pelo MAIOR DO CATALOGO, e nao por constante gravada: as antigas
      // (`REF_OFFENSE`, `REF_BULK`) foram medidas contra a escala do `poolDps`, que
      // deixou de ser o eixo. Referencia de outra grandeza e pior que nenhuma.
      const offense = r.o / maxO;
      const bulk = r.b / maxB;
      const speed = r.v / maxV;
      const score =
        Math.round((W_OFFENSE * offense + W_BULK * bulk + W_SPEED * speed) * 1000) / 10;
      const c = r.creature;
      return {
        creature: c,
        score,
        tier: tierOf(score, pool),
        position: 0,
        offense,
        bulk,
        dps: r.dps,
        ehp: r.ehp,
        best: r.best,
        basePower: c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed,
      };
    })
    .sort((a, b) => b.score - a.score || b.offense - a.offense || a.creature.name.localeCompare(b.creature.name))
    .map((e, i) => ({ ...e, position: i + 1 }));
}

// ---------------------------------------------------------------- matchup

/** Efetividade JA amplificada pelo reforco de hunt (x2 vira x2.5) — a mesma que o
 *  Hunt Planner mostra, pra o site inteiro falar de efetividade do mesmo jeito. */
export const effOf = (atk: PokeType, target: MetaMon): number =>
  amplify(effectiveness(atk, target.type1, target.type2));

export interface Matchup {
  attacker: MetaMon;
  defender: MetaMon;
  move: Attack | null;
  /** Efetividade amplificada do melhor golpe contra este alvo. */
  eff: number;
  /** DPS contra ESTE alvo: ja divide pela defesa dele e aplica a efetividade. */
  dps: number;
  /** Segundos pra derrubar o alvo (HP de hunt, x5). Infinity = nao machuca. */
  ttk: number;
}

/** DPS de um golpe contra um alvo concreto: entra a defesa do alvo e a efetividade. */
function dpsAgainst(atk: MetaMon, a: Attack, def: MetaMon): number {
  const base = moveDps(atk, a);
  if (base <= 0) return 0;
  const eff = effOf(a.type, def);
  if (eff <= 0) return 0;
  const wall = a.category === "SPECIAL" ? def.baseSpDef : def.baseDef;
  return (base * eff) / Math.max(1, wall);
}

// HP de wild na hunt e x5 (doc do jogo). Como os dois lados usam a mesma escala, isso so
// muda a unidade do ttk — mas mantem o numero comparavel ao do Hunt Planner.
const HUNT_HP_MULT = 5;

/** Melhor golpe do atacante contra o defensor, e quanto ele demora pra derrubar. */
export function matchup(attacker: MetaMon, defender: MetaMon, pool: MovePool = "natural"): Matchup {
  // `total` manda na VELOCIDADE (os golpes disparam todos, cada um na sua recarga);
  // `best` manda no que a tela MOSTRA — com que golpe e com que efetividade voce
  // bate. Sao perguntas diferentes e por isso sao dois numeros, nao um.
  let best: { a: Attack; dps: number } | null = null;
  let total = 0;
  for (const a of attacker.attacks) {
    if (!isOffensive(a) || !inPool(a, pool)) continue;
    const d = dpsAgainst(attacker, a, defender);
    if (d <= 0) continue; // imune a esse tipo
    total += d;
    if (!best || d > best.dps) best = { a, dps: d };
  }
  const hp = defender.baseHp * HUNT_HP_MULT;
  return {
    attacker,
    defender,
    move: best?.a ?? null,
    eff: best ? effOf(best.a.type, defender) : 0,
    dps: total,
    ttk: total > 0 ? hp / total : Infinity,
  };
}

export interface Duel {
  other: MetaMon;
  /** Meu golpe contra ele e o dele contra mim. */
  mine: Matchup;
  theirs: Matchup;
  /** >1 = eu derrubo ele antes de ele me derrubar. E a razao dos tempos de kill. */
  edge: number;
}

/**
 * Vantagem como razao de tempos: >1 = eu derrubo antes.
 *
 * Os tres casos degenerados existem de verdade no catalogo e precisam de resposta,
 * nao de uma divisao torta:
 *  - so ELE nao me machuca -> Infinity (ganho sem chance de perder);
 *  - so EU nao machuco ele -> 0 (perco sem chance de ganhar). Era aqui que a tela
 *    quebrava: 0 e finito, entao o guarda `Number.isFinite(margin)` deixava passar
 *    e o `1 / margin` do ramo de derrota imprimia literalmente "Infinityx" — em
 *    991 pares do catalogo em nivel 100, e 1.542 em nivel 5;
 *  - NENHUM dos dois machuca o outro -> 1, empate. Antes o primeiro `if` respondia
 *    Infinity, ou seja, "voce ganha", numa luta que nao termina.
 */
function razaoDeTempo(meuTtk: number, dele: number): number {
  const euNaoBato = !Number.isFinite(meuTtk);
  const eleNaoBate = !Number.isFinite(dele);
  if (euNaoBato && eleNaoBate) return 1;
  if (eleNaoBate) return Infinity;
  if (euNaoBato) return 0;
  return dele / meuTtk;
}

/** Duelo entre duas especies, medindo OS DOIS LADOS.
 *  O piwtools decide nemesis so por "tem golpe super efetivo contra voce" — o que promove
 *  qualquer pokemon fraco com o tipo certo. Aqui quem ganha e quem derruba primeiro. */
export function duel(mine: MetaMon, other: MetaMon, pool: MovePool = "natural"): Duel {
  const a = matchup(mine, other, pool);
  // O outro lado e sempre natural: o wild nao compra TM (mesma regra do combat.ts).
  const b = matchup(other, mine, "natural");
  const edge = razaoDeTempo(a.ttk, b.ttk);
  return { other, mine: a, theirs: b, edge };
}

/** Quem te derruba primeiro — as ameacas reais, ordenadas pela vantagem DELES.
 *  So entra quem realmente ganha de voce (edge < 1). */
export function nemeses(c: MetaMon, creatures: MetaMon[], n = 6, pool: MovePool = "natural"): Duel[] {
  return playableSet(creatures)
    .filter((o) => o.pokeId !== c.pokeId)
    .map((o) => duel(c, o, pool))
    .filter((d) => d.edge < 1 && Number.isFinite(d.theirs.ttk))
    .sort((x, y) => x.edge - y.edge)
    .slice(0, n);
}

/** Suas presas: quem voce derruba com folga e sem tomar de volta. */
export function preys(c: MetaMon, creatures: MetaMon[], n = 6, pool: MovePool = "natural"): Duel[] {
  return playableSet(creatures)
    .filter((o) => o.pokeId !== c.pokeId)
    .map((o) => duel(c, o, pool))
    .filter((d) => d.mine.eff > 1 && Number.isFinite(d.mine.ttk))
    .sort((x, y) => y.edge - x.edge)
    .slice(0, n);
}

// ---------------------------------------------------------------- perfil de stats

export const STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "speed"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const statOf = (c: MetaMon, k: StatKey): number =>
  k === "hp" ? c.baseHp : k === "atk" ? c.baseAtk : k === "def" ? c.baseDef
    : k === "spAtk" ? c.baseSpAtk : k === "spDef" ? c.baseSpDef : c.baseSpeed;

export interface StatStanding {
  key: StatKey;
  value: number;
  /** 0..1 — fatia do catalogo que este pokemon supera neste stat. */
  percentile: number;
  rank: number;
}

/** Onde cada stat base do pokemon cai dentro do catalogo jogavel. */
export function statStandings(c: MetaMon, creatures: MetaMon[]): Record<StatKey, StatStanding> {
  const set = playableSet(creatures);
  const out = {} as Record<StatKey, StatStanding>;
  for (const k of STAT_KEYS) {
    const values = set.map((x) => statOf(x, k)).sort((a, b) => b - a);
    const v = statOf(c, k);
    const rank = values.findIndex((x) => x <= v) + 1 || values.length;
    const below = values.filter((x) => x < v).length;
    out[k] = { key: k, value: v, rank, percentile: set.length <= 1 ? 1 : below / (set.length - 1) };
  }
  return out;
}

/** Papel que os stats sugerem. Chaves de i18n em `meta.role.*`. */
export type Role =
  | "glassCannon" | "sweeper" | "physicalAttacker" | "specialAttacker" | "mixedAttacker"
  | "bulkyAttacker" | "wall" | "physicalWall" | "specialWall" | "balanced" | "filler";

/** Le os percentis e da um nome ao formato. A ordem dos testes importa: do perfil mais
 *  especifico pro mais generico, senao tudo vira "equilibrado". */
export function roleOf(st: Record<StatKey, StatStanding>): Role {
  const atk = st.atk.percentile, spa = st.spAtk.percentile;
  const off = Math.max(atk, spa);
  const gap = Math.abs(atk - spa);
  const hp = st.hp.percentile, def = st.def.percentile, spd = st.spDef.percentile;
  const bulk = (hp + def + spd) / 3;
  const speed = st.speed.percentile;

  if (off >= 0.85 && bulk <= 0.35) return "glassCannon";
  if (off >= 0.8 && bulk >= 0.65) return "bulkyAttacker";
  if (off >= 0.8 && speed >= 0.8) return "sweeper";
  if (bulk >= 0.8 && off <= 0.45) {
    if (def >= spd + 0.15) return "physicalWall";
    if (spd >= def + 0.15) return "specialWall";
    return "wall";
  }
  if (off >= 0.65 && gap <= 0.12) return "mixedAttacker";
  if (spa >= 0.65 && spa >= atk + 0.1) return "specialAttacker";
  if (atk >= 0.65 && atk >= spa + 0.1) return "physicalAttacker";
  if (off >= 0.45 || bulk >= 0.45) return "balanced";
  return "filler";
}

// ---------------------------------------------------------------- analise por tipo

export interface TypeStanding {
  type: PokeType;
  /** Melhor DPS que o catalogo entrega com golpe DESTE tipo. */
  bestDps: number;
  bestUser: MetaMon | null;
  bestMove: Attack | null;
  /** Quantas especies jogaveis carregam golpe do tipo. */
  users: number;
  /** Quantas especies jogaveis SAO do tipo. */
  species: number;
}

/** Panorama ofensivo de cada tipo: quem bate mais forte com ele e quanta gente o tem. */
export function typeStandings(creatures: MetaMon[], pool: MovePool = "natural"): Map<PokeType, TypeStanding> {
  const set = playableSet(creatures);
  const out = new Map<PokeType, TypeStanding>();
  const bump = (t: PokeType) => {
    let s = out.get(t);
    if (!s) { s = { type: t, bestDps: 0, bestUser: null, bestMove: null, users: 0, species: 0 }; out.set(t, s); }
    return s;
  };
  for (const c of set) {
    bump(c.type1).species++;
    if (c.type2) bump(c.type2).species++;
    const seen = new Set<PokeType>();
    for (const a of c.attacks) {
      if (!isOffensive(a) || !inPool(a, pool)) continue;
      const s = bump(a.type);
      if (!seen.has(a.type)) { s.users++; seen.add(a.type); }
      const d = moveDps(c, a);
      if (d > s.bestDps) { s.bestDps = d; s.bestUser = c; s.bestMove = a; }
    }
  }
  return out;
}

// ---------------------------------------------------------------- arena (Stadium)

/** Um pokemon CONCRETO: especie mais o que o individuo tem (nivel, Quality, IVs).
 *  O Stadium compara individuos, nao especies — e por isso ele nao usa o metaScore. */
export interface Fighter {
  mon: MetaMon;
  level: number;
  quality: number;
  /** Na ordem hp, atk, def, spAtk, spDef, speed. */
  ivs: number[];
  /** Alvo de hunt: leva o reforco do jogo (HP x5, dano x1.8). Ver pokepedia/systems/combat. */
  wild: boolean;
}

export interface ArenaSide {
  move: Attack | null;
  eff: number;
  /** Dano por golpe e por segundo contra o outro lado. */
  hit: number;
  dps: number;
  /** Segundos pra derrubar o outro. Infinity = nao consegue. */
  ttk: number;
  stats: number[];
  power: number;
}

export interface ArenaResult {
  me: ArenaSide;
  foe: ArenaSide;
  /** true = eu derrubo antes de cair. */
  win: boolean;
  /** Folga: 2 = eu derrubo ele no dobro da velocidade. Infinity = ele nao me machuca. */
  margin: number;
}

const WILD_HP_X = 5;    // HP do wild na hunt (doc do jogo)
const WILD_DMG_X = 1.8; // dano do wild por golpe (doc do jogo)

function sideOf(atk: Fighter, def: Fighter, pool: MovePool, dmgMult: number) {
  const a = projectAll(
    [atk.mon.baseHp, atk.mon.baseAtk, atk.mon.baseDef, atk.mon.baseSpAtk, atk.mon.baseSpDef, atk.mon.baseSpeed],
    atk.ivs, atk.level, atk.quality,
  );
  const d = projectAll(
    [def.mon.baseHp, def.mon.baseAtk, def.mon.baseDef, def.mon.baseSpAtk, def.mon.baseSpDef, def.mon.baseSpeed],
    def.ivs, def.level, def.quality,
  );
  const defHp = d.stats[0] * (def.wild ? WILD_HP_X : 1);

  let best: { mv: Attack; eff: number; hit: number; dps: number } | null = null;
  let total = 0;
  for (const mv of atk.mon.attacks) {
    if (!isOffensive(mv) || !inPool(mv, pool)) continue;
    if (mv.learnLevel > atk.level) continue;
    const eff = effOf(mv.type, def.mon);
    if (eff <= 0) continue;
    const off = mv.category === "SPECIAL" ? a.stats[3] : a.stats[1];
    const wall = mv.category === "SPECIAL" ? d.stats[4] : d.stats[2];
    const hit = hitDamage(mv.power, off, wall, hasStab(atk.mon, mv) ? 1.5 : 1, eff) * dmgMult;
    const dps = hit / (mv.cooldownMs / 1000);
    // O Stadium media so o melhor golpe enquanto o Hunt Planner soma o moveset, e
    // o mesmo par saia com "segundos pra derrubar" ~3x diferentes de uma tela pra
    // outra. Aqui o criterio passa a ser o mesmo: a soma manda no tempo, o melhor
    // golpe segue sendo o que a tela nomeia.
    total += dps;
    if (!best || dps > best.dps) best = { mv, eff, hit, dps };
  }

  const side: ArenaSide = {
    move: best?.mv ?? null,
    eff: best?.eff ?? 0,
    hit: best?.hit ?? 0,
    dps: total,
    ttk: total > 0 ? defHp / total : Infinity,
    stats: a.stats,
    power: a.power,
  };
  return side;
}

/** Duelo entre dois individuos, com os stats REAIS de cada um (nivel, Quality, IV) e o
 *  mesmo modelo de dano do Hunt Planner. Quem ganha e quem derruba primeiro — nao quem
 *  tem o maior numero. O lado wild/boss leva o reforco do jogo nos dois sentidos: mais
 *  HP pra aguentar e mais dano por golpe. */
export function arenaDuel(me: Fighter, foe: Fighter, pool: MovePool = "natural"): ArenaResult {
  // A TM e do jogador: o lado selvagem bate sempre com o moveset natural.
  const mine = sideOf(me, foe, me.wild ? "natural" : pool, me.wild ? WILD_DMG_X : 1);
  const theirs = sideOf(foe, me, foe.wild ? "natural" : pool, foe.wild ? WILD_DMG_X : 1);
  const margin = razaoDeTempo(mine.ttk, theirs.ttk);
  return { me: mine, foe: theirs, win: mine.ttk < theirs.ttk, margin };
}

/** IV medio do jogo (32 por stat no teto). E o palpite quando o jogador nao digita os
 *  IVs reais — o mesmo baseline que o motor de hunt usa. */
export const DEFAULT_IV = 21;
export const defaultIvs = (): number[] => [DEFAULT_IV, DEFAULT_IV, DEFAULT_IV, DEFAULT_IV, DEFAULT_IV, DEFAULT_IV];
