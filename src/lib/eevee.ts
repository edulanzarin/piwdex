// A escolha do Eevee: o que a Loja do Marlon cobra, e o que ela entrega.
//
// FONTE: a tela da Loja do Marlon, dentro do jogo. Isto NAO existe em fonte
// publica nenhuma, e o que existe esta errado — o `creatures.json` diz que o
// Eevee tem `evolvesToId: 134, evolveLevel: 80`, ou seja UM destino, linear,
// pro Vaporeon. Nao e assim que acontece: o Eevee nao evolui por nivel, ele e
// TROCADO com um NPC, e sao cinco destinos possiveis.
//
// A propria Pokepedia do jogo admite o caso a parte sem publicar a receita:
//
//     "Shiny e Ditto nao evoluem, e Eevee e caso a parte (sistema proprio de
//      stones)."
//
// e o cliente do jogo carrega as strings do NPC — `eeveeReq: "1 Eevee no time"`,
// `needStone: "Faltam {{stone}}"`, `tradedVerb: "Trocou seu Eevee por {{name}}"`
// — mas a TABELA mora no servidor, atras de login. Ela chegou aqui do unico
// lugar onde ela se mostra: a tela, fotografada por quem joga. Ver
// [[A interface do sistema explica o que a API dele esconde]] no Brain.
//
// O que a tela diz, nos cinco casos, palavra por palavra: "$ 65.000", "1 Eevee
// no time", "0/10 Water Stone". Preco igual, quantidade igual, so a pedra muda.
// E ISSO e o achado: como o custo em ouro nao separa as opcoes, a decisao inteira
// se muda pra outro lugar — qual pedra voce consegue farmar, e qual eeveelution
// vale a pena. As duas perguntas o piwdex ja sabia responder antes desta tela
// existir; faltava o dado que liga uma na outra.

import type { MetaMon } from "./meta";

/** pokeId do Eevee no catalogo. */
export const EEVEE_ID = 133;

/** Ouro que o Marlon cobra por QUALQUER uma das cinco trocas. */
export const OURO_DA_TROCA = 65_000;

/** Pedras que ele cobra por QUALQUER uma das cinco trocas. */
export const PEDRAS_DA_TROCA = 10;

export interface TrocaEevee {
  /** pokeId do destino no catalogo */
  pokeId: number;
  nome: string;
  /**
   * Nome EXATO do item, como esta no `items.json`.
   *
   * Nao e enfeite: este texto e a chave do indice reverso de drop (`dropSourcesOf`),
   * entao um acento a mais aqui apaga a tabela inteira de "onde farmar" sem lancar
   * erro nenhum.
   */
  pedra: string;
}

/**
 * As cinco trocas, na ordem em que a loja lista.
 *
 * Duas delas eu tinha CHUTADO errado antes do print chegar, e vale registrar por
 * que o chute era bom e ainda assim era chute: das vinte stones do jogo, Moon
 * Stone e Sun Stone sao as unicas com `npcPrice: 0` — nenhum NPC compra —, e a
 * tradicao da serie manda Umbreon/Espeon virem da lua e do sol. Bateu tudo, e
 * estava errado: sao Darkness e Enigma. Palpite coerente continua sendo palpite.
 */
export const TROCAS: TrocaEevee[] = [
  { pokeId: 136, nome: "Flareon", pedra: "Fire Stone" },
  { pokeId: 134, nome: "Vaporeon", pedra: "Water Stone" },
  { pokeId: 135, nome: "Jolteon", pedra: "Thunder Stone" },
  { pokeId: 197, nome: "Umbreon", pedra: "Darkness Stone" },
  { pokeId: 196, nome: "Espeon", pedra: "Enigma Stone" },
];

/** Os pokeId que sao destino de troca — usado pra cortar a mentira do catalogo. */
export const DESTINOS = new Set(TROCAS.map((t) => t.pokeId));

/**
 * A aresta falsa da linha evolutiva.
 *
 * `evolutionChainOf` monta a cadeia seguindo `evolvesToId`, e no Eevee esse campo
 * aponta pro Vaporeon com `evolveLevel: 80`. A ficha da Pokedex entao afirmava
 * "Eevee -> nv 80 -> Vaporeon" em SEIS paginas (a do Eevee e a dos cinco destinos,
 * porque a cadeia tambem se caminha pra tras). Nenhuma delas era verdade, e o
 * defeito era invisivel: uma linha evolutiva plausivel nao parece um bug.
 *
 * Cortar a aresta e melhor que consertar o dado: o que existe no lugar dela nao e
 * uma evolucao com outro nivel, e um sistema inteiro — cinco destinos, uma pedra
 * cada, um NPC, ouro. Isso nao cabe numa seta, e a ficha passa a apontar pra ca.
 */
export const arestaFalsa = (deId: number, paraId: number | null): boolean =>
  deId === EEVEE_ID && paraId != null && DESTINOS.has(paraId);

/**
 * A especie participa do sistema do Eevee? (o proprio e os cinco destinos)
 *
 * Existe por causa do buraco que o corte da aresta abriu. Sem a seta falsa, o
 * painel de linha evolutiva caia no texto padrao — "Eevee nao evolui e nao vem de
 * nenhuma evolucao, e uma linha de um estagio so" — que troca uma afirmacao falsa
 * por outra: o Eevee VIRA cinco coisas, so nao por evolucao. Cortar dado sem por
 * a verdade no lugar deixa a tela mentindo mais baixo.
 */
export const noSistemaDoEevee = (pokeId: number): boolean =>
  pokeId === EEVEE_ID || DESTINOS.has(pokeId);

// ------------------------------------------------------------------ o farm

/**
 * Uma criatura que solta a pedra, ja com o que a decisao precisa.
 *
 * `min`/`max` importam mais do que parece: quase todo drop de pedra e 1..1, mas
 * ha excecao de peso — Mightyena e Absol soltam de 1 a 5 de uma vez. Contar so a
 * chance faria os dois parecerem iguais a um drop unitario de mesma porcentagem,
 * e eles rendem tres vezes mais por abate.
 */
export interface FonteDaPedra {
  pokeId: number;
  nome: string;
  /** nivel do ponto de caca da criatura */
  nivel: number;
  chancePct: number;
  min: number;
  max: number;
  /**
   * As REGIOES onde ela tem ponto de caca, sem repetir.
   *
   * Regiao e nao nome do ponto: no jogo o ponto se chama como a criatura
   * ("Magmar" cacado em "Magmar"), entao a linha do nome do local repetia a
   * linha de cima e nao dizia nada. "kanto" e "orre" dizem onde ir.
   *
   * Lista vazia significa que ela NAO se caca — e o corte que tira do painel a
   * criatura que solta a pedra num lugar que nao existe.
   */
  areas: string[];
}

/** Pedras por abate, no valor esperado — chance vezes a quantidade media do drop. */
export const pedrasPorAbate = (f: FonteDaPedra): number =>
  (f.chancePct / 100) * ((f.min + f.max) / 2);

/** Abates esperados pra juntar `n` pedras nesta fonte. `Infinity` se ela nao solta. */
export function abatesPara(f: FonteDaPedra, n = PEDRAS_DA_TROCA): number {
  const por = pedrasPorAbate(f);
  return por > 0 ? n / por : Infinity;
}

/**
 * A melhor fonte que o nivel `meu` alcanca.
 *
 * O filtro por nivel nao e conveniencia de tela — sem ele a resposta e sempre a
 * mesma e sempre inutil pra quem esta comecando: as melhores fontes de toda pedra
 * sao variantes de nivel 150 (Furious Magmar, Brave Blastoise), e mandar um
 * jogador de nivel 60 farmar la e mandar ele morrer. `meu = 0` desliga o corte.
 */
export function melhorFonte(fontes: FonteDaPedra[], meu = 0): FonteDaPedra | null {
  const cabem = meu > 0 ? fontes.filter((f) => f.nivel <= meu) : fontes;
  let melhor: FonteDaPedra | null = null;
  for (const f of cabem) {
    if (!melhor || pedrasPorAbate(f) > pedrasPorAbate(melhor)) melhor = f;
  }
  return melhor;
}

// ------------------------------------------------------------- o resultado

export interface Ramo {
  troca: TrocaEevee;
  /** a especie de destino, resolvida no catalogo; null = nao existe (ainda) */
  mon: MetaMon | null;
  fontes: FonteDaPedra[];
}

/**
 * Resolve as cinco trocas contra o catalogo.
 *
 * `mon: null` e um estado previsto, nao um erro: as Bags de Leafeon, Glaceon e
 * Sylveon existem no `items.json` sem que as especies existam no `creatures.json`.
 * Se um dia o Marlon ganhar esses ramos, a tabela daqui cresce e a especie aparece
 * sozinha — e se a especie chegar antes da tabela, o ramo aparece vazio em vez de
 * sumir sem aviso.
 */
export function montarRamos(
  mons: MetaMon[],
  fontesPorPedra: Record<string, FonteDaPedra[]>,
): Ramo[] {
  const porId = new Map(mons.map((m) => [m.pokeId, m]));
  return TROCAS.map((troca) => ({
    troca,
    mon: porId.get(troca.pokeId) ?? null,
    fontes: fontesPorPedra[troca.pedra] ?? [],
  }));
}
