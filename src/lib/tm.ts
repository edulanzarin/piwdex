// O disco de TM: qual trocar, e em quem pôr.
//
// O TM e o MAIOR salto de poder do jogo, e o catalogo prova isso sozinho: o melhor
// golpe natural das 482 especies rende 43,3 de poder por segundo, e TODO golpe de
// TM rende 60 (600 de poder a cada 10 segundos). Nao ha golpe natural que chegue
// perto, e nenhuma tela do jogo nem de terceiro diz onde esse salto rende mais.
//
// A decisao tem a MESMA forma da troca do Eevee, e por isso a ferramenta se parece
// com aquela: o TM Researcher troca N pecas por "um disco A SUA ESCOLHA", com o
// mesmo N pra qualquer tipo. Custo igual em todas as opcoes de novo — entao o
// preco nao separa nada e a pergunta inteira vira "quem aproveita". Ver
// [[Ordene pela grandeza que decide, não pela que impressiona]], seção da grandeza
// que nao varia.
//
// Tres achados do catalogo que a tela precisa dizer em voz alta:
//
//  1. **Draconic Soul tem 300 de poder, e nao 600.** E o unico dos quinze. Quem
//     troca o disco de Dragao esperando o mesmo salto dos outros leva metade.
//  2. **Normal, Aco e Fada tem DISCO e nao tem GOLPE.** Os tres itens existem no
//     `items.json` e nenhuma das 482 especies aprende um golpe de TM desses tipos.
//  3. **O disco de Fantasma serve a UMA especie.** So o Gengar aprende Untold
//     Nightmare.
//
// E um que muda como a tela se explica: a RAZAO de ganho (dps com TM / dps sem)
// nao muda com nivel nem com quality. Os dois lados usam o mesmo stat ofensivo
// multiplicado pelo mesmo fator `(nivel/100) * quality^0.8`, entao ele cancela. O
// que NAO cancela e o IV, quando o melhor golpe natural e fisico e o TM e especial
// (ou o contrario): ai a conta passa a depender de Atk contra Sp.Atk, que sao dois
// IV diferentes. Por isso existem os dois modos — catalogo pela base, e o SEU pela
// carta.

import type { Attack, PokeType } from "./types";
import {
  isOffensive,
  hasStab,
  isTm,
  type MetaMon,
  type MovePool,
} from "./meta";
import { projectAll } from "./stats";

/** Poder dos golpes de TM. O de Dragao e a excecao, e ela e o ponto. */
export const PODER_TM = 600;

export interface Disco {
  tipo: PokeType;
  /** nome exato do item no `items.json` */
  item: string;
  /** o golpe que o disco ensina; null = o item existe e nenhuma especie o aprende */
  golpe: Attack | null;
  /** as especies do conjunto que aprendem esse golpe */
  quem: MetaMon[];
}

/** O disco de AoE nao ensina golpe: ele faz os golpes NORMAIS do pokemon
 *  espalharem. Como o efeito nao esta em `attacks[]`, nada aqui o simula — a tela
 *  diz o que ele faz e para por ai. */
export const ITEM_AOE = "AoE TM Disk";

/** `"Fire-Type TM Disk"` a partir de `"FIRE"`. O nome do item e a unica chave que
 *  liga o golpe do catalogo ao icone da loja, entao ele se monta num lugar so. */
export const itemDoTipo = (t: PokeType): string =>
  `${t.charAt(0)}${t.slice(1).toLowerCase()}-Type TM Disk`;

/**
 * Os discos, montados a partir do CATALOGO e não de uma lista escrita à mão.
 *
 * O tipo do golpe sempre bate com o tipo do disco (conferido nas quinze), então o
 * campo `tm` do golpe É a identidade do disco. Escrever a tabela à mão duplicaria
 * uma relação que o dado já carrega, e a cópia envelheceria no dia em que o jogo
 * publicasse o décimo sexto.
 */
export function montarDiscos(mons: MetaMon[], tipos: PokeType[]): Disco[] {
  const golpePorTipo = new Map<PokeType, Attack>();
  const quemPorTipo = new Map<PokeType, MetaMon[]>();

  for (const m of mons) {
    for (const a of m.attacks) {
      if (!a.tm) continue;
      if (!golpePorTipo.has(a.tm)) golpePorTipo.set(a.tm, a);
      const arr = quemPorTipo.get(a.tm) ?? [];
      arr.push(m);
      quemPorTipo.set(a.tm, arr);
    }
  }

  return tipos.map((t) => ({
    tipo: t,
    item: itemDoTipo(t),
    golpe: golpePorTipo.get(t) ?? null,
    quem: quemPorTipo.get(t) ?? [],
  }));
}

// ------------------------------------------------------------------ o ganho

export interface GanhoTm {
  mon: MetaMon;
  /** dps do moveset SEM o TM */
  natural: number;
  /** dps do moveset COM o TM */
  comTm: number;
  /** comTm / natural. `Infinity` quando a espécie não tem golpe ofensivo natural */
  razao: number;
  delta: number;
  /** o melhor golpe natural — o que o TM passa a ofuscar */
  melhorNatural: Attack | null;
  /** os golpes de TM que ela aprende (17 das jogáveis aprendem dois) */
  golpes: Attack[];
}

/**
 * DPS de um golpe com o stat ofensivo JÁ RESOLVIDO.
 *
 * Existe porque o `moveDps` do meta lê `c.baseAtk`/`c.baseSpAtk` direto — ele mede
 * ESPÉCIE, que é o certo pra uma tier list e o errado pra responder sobre o seu
 * bicho. A fórmula é a mesma; o que muda é de onde vem o stat.
 */
const dpsCom = (a: Attack, stat: number, stab: boolean): number =>
  !isOffensive(a)
    ? 0
    : (a.power * stat * (stab ? 1.5 : 1)) / (a.cooldownMs / 1000);

/** Atk e Sp.Atk de um pokémon, na ordem [físico, especial]. */
const ofensivos = (mon: MetaMon, stats?: number[]): [number, number] =>
  stats ? [stats[1], stats[3]] : [mon.baseAtk, mon.baseSpAtk];

/**
 * Quanto o TM adiciona.
 *
 * `stats` opcional é o que separa os dois modos: sem ele a conta é sobre as bases
 * da espécie (comparável com a tier list); com ele é sobre os seis stats de uma
 * carta da bolsa, e aí o IV entra — e o IV importa de verdade quando o golpe
 * natural e o de TM usam stats diferentes.
 *
 * O DPS é do MOVESET INTEIRO, e não do melhor golpe, pela mesma razão que o resto
 * do site: neste jogo cada golpe dispara sozinho quando a recarga acaba, então
 * ninguém escolhe um. É por isso que o TM não multiplica o dano por 60/43 — ele
 * SOMA um golpe muito bom a um moveset que continua disparando.
 */
export function ganhoDe(mon: MetaMon, stats?: number[]): GanhoTm {
  const [fis, esp] = ofensivos(mon, stats);
  let natural = 0;
  let comTm = 0;
  let melhorNatural: Attack | null = null;
  let melhorDps = 0;
  const golpes: Attack[] = [];

  for (const a of mon.attacks) {
    if (!isOffensive(a)) continue;
    const dps = dpsCom(
      a,
      a.category === "SPECIAL" ? esp : fis,
      hasStab(mon, a),
    );
    comTm += dps;
    if (isTm(a)) {
      golpes.push(a);
    } else {
      natural += dps;
      if (dps > melhorDps) {
        melhorDps = dps;
        melhorNatural = a;
      }
    }
  }

  return {
    mon,
    natural,
    comTm,
    razao: natural > 0 ? comTm / natural : Infinity,
    delta: comTm - natural,
    melhorNatural,
    golpes,
  };
}

/** Só quem tem golpe de TM — o resto do catálogo não é resposta pra nada aqui. */
export const aprendeTm = (mon: MetaMon): boolean =>
  mon.attacks.some((a) => a.tm != null);

/** O ganho considerando SÓ o disco escolhido, e não todos os TM da espécie.
 *  Dezessete das jogáveis aprendem dois (Charizard, Gyarados, Dragonite…), e somar
 *  os dois responderia uma pergunta que ninguém fez: o Researcher entrega UM disco
 *  por troca. */
export function ganhoDoDisco(
  mon: MetaMon,
  tipo: PokeType,
  stats?: number[],
): GanhoTm {
  const cheio = ganhoDe(mon, stats);
  const doDisco = cheio.golpes.filter((a) => a.tm === tipo);
  const [fis, esp] = ofensivos(mon, stats);
  const soma = doDisco.reduce(
    (t, a) =>
      t + dpsCom(a, a.category === "SPECIAL" ? esp : fis, hasStab(mon, a)),
    0,
  );
  const comTm = cheio.natural + soma;
  return {
    ...cheio,
    comTm,
    razao: cheio.natural > 0 ? comTm / cheio.natural : Infinity,
    delta: soma,
    golpes: doDisco,
  };
}

/** Os seis stats de uma carta, projetados — a entrada do modo "os meus". */
export const statsDaCarta = (
  mon: MetaMon,
  level: number,
  quality: number,
  ivs: number[],
): number[] =>
  projectAll(
    [
      mon.baseHp,
      mon.baseAtk,
      mon.baseDef,
      mon.baseSpAtk,
      mon.baseSpDef,
      mon.baseSpeed,
    ],
    ivs,
    level,
    quality,
  ).stats;

/** O pool que a espécie usaria; existe pra tela nomear o que está comparando. */
export const POOL_LABEL: Record<MovePool, string> = {
  natural: "sem TM",
  tm: "com TM",
};
