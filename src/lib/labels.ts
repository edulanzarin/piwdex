// Os nomes em portugues, num lugar so.
//
// Por que centralizar em vez de traduzir na tela: o mesmo tipo aparece no badge
// do card, no menu de filtro, no chip de filtro ativo, na tabela de fraquezas e
// na ficha. Traduzido em cinco lugares, um dia quatro concordam e um discorda —
// e a tela passa a se contradizer sobre a mesma coisa.
//
// **Nome de pokemon e de item ficam em INGLES**, de proposito: o jogo e em
// ingles, e quem procura "Bulb" no piwdex esta com o inventario do jogo aberto
// do lado. Traduzir o nome quebraria justamente a ponte entre as duas telas. O
// que se traduz e o VOCABULARIO do sistema — tipo, raridade, categoria, papel.

import type { Acquisition, AttackCategory, PokeType, Rarity } from "./types";
import type { Stage } from "./dex";
import type { ItemCategory, ItemOrigin } from "./items";
import type { RarityTier } from "./rarity";

/** Nome do tipo em portugues — os mesmos que o proprio jogo usa no idioma BR
 *  (o evento "Tipo do Dia" chega como "Sombrio", nao "DARK"). */
export const TYPE_LABEL: Record<PokeType, string> = {
  NORMAL: "Normal",
  FIRE: "Fogo",
  WATER: "Água",
  ELECTRIC: "Elétrico",
  GRASS: "Planta",
  ICE: "Gelo",
  FIGHTING: "Lutador",
  POISON: "Venenoso",
  GROUND: "Terrestre",
  FLYING: "Voador",
  PSYCHIC: "Psíquico",
  BUG: "Inseto",
  ROCK: "Pedra",
  GHOST: "Fantasma",
  DRAGON: "Dragão",
  DARK: "Sombrio",
  STEEL: "Metálico",
  FAIRY: "Fada",
};

/** Raridade da ESPECIE (o traco do catalogo, 6 valores). Nao confundir com a
 *  faixa de Quality do INDIVIDUO, logo abaixo — compartilham nomes. */
export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Raro",
  EPIC: "Épico",
  LEGENDARY: "Lendário",
  MYTHIC: "Mítico",
};

/** Faixa de Quality do INDIVIDUO (9 valores, tabela oficial do jogo). */
export const TIER_LABEL: Record<RarityTier, string> = {
  WEAK: "Fraco",
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Raro",
  EPIC: "Épico",
  LEGENDARY: "Lendário",
  MYTHIC: "Mítico",
  ANCIENT: "Ancestral",
  DIVINE: "Divino",
};

export const CATEGORY_LABEL: Record<AttackCategory, string> = {
  PHYSICAL: "Físico",
  SPECIAL: "Especial",
  STATUS: "Status",
};

/** Como se consegue a especie. "Exclusivo" e nao "Especial" de proposito: o
 *  papel de combate ja usa a palavra Especial (atacante especial), e as duas
 *  apareciam lado a lado no mesmo card. */
export const ACQ_LABEL: Record<Acquisition, string> = {
  hunt: "Caçável",
  evo: "Evolução",
  special: "Exclusivo",
};

export const ACQ_HINT: Record<Acquisition, string> = {
  hunt: "Caçável — tem ponto no mapa",
  evo: "Evolução — só evoluindo",
  special: "Exclusivo — loja, cassino ou evento",
};

export const STAGE_LABEL: Record<Stage, string> = {
  solo: "Não evolui",
  base: "1º estágio",
  mid: "2º estágio",
  final: "Estágio final",
};

export const REGION_LABEL: Record<"base" | "orre", string> = {
  base: "Catálogo base",
  orre: "Orre (endgame)",
};

/** Categoria do item, como o jogo classifica. "Drop" e a categoria de item de
 *  caca — nao confundir com a ORIGEM logo abaixo, que responde outra pergunta
 *  ("cai de alguem?"). Uma Poção tem origem de loja e categoria de cura. */
export const ITEM_CATEGORY_LABEL: Record<ItemCategory, string> = {
  loot: "Drop",
  stone: "Pedra",
  heal: "Cura",
  revive: "Reviver",
  clan: "Clã",
  tm: "TM",
  card: "Carta",
  misc: "Diversos",
};

/** De onde o item vem — o irmao de ACQ_LABEL das especies. */
export const ITEM_ORIGIN_LABEL: Record<ItemOrigin, string> = {
  drop: "Cai de pokémon",
  shop: "Loja",
  special: "Exclusivo",
};

export const ITEM_ORIGIN_HINT: Record<ItemOrigin, string> = {
  drop: "Cai de pokémon — alguma espécie dropa",
  shop: "Loja — se compra com ouro",
  special: "Exclusivo — altar, clã, evento ou shiny",
};

/** Nome curto de cada stat, na ordem canonica (hp, atk, def, spAtk, spDef, speed). */
export const STAT_LABEL = ["Vida", "Ataque", "Defesa", "Atq. Esp.", "Def. Esp.", "Velocidade"] as const;

/** A versao de 2-3 letras, pra cabecalho de tabela e espinha do card. */
export const STAT_SHORT = ["VID", "ATQ", "DEF", "AES", "DES", "VEL"] as const;

/**
 * Nome da especie com a REGIAO quando ela e a variante de Orre.
 *
 * Orre repete o nome do catalogo base ("Sableye") com stats proprios, entao as duas
 * entram na tier list — e a lista mostrava o mesmo nome duas vezes, com notas
 * diferentes, parecendo defeito. O nome proprio continua em ingles (e a chave de
 * busca do jogo); o que se acrescenta e o vocabulario do sistema.
 */
export const monLabel = (m: { name: string; area: string | null }): string =>
  m.area === "orre" ? `${m.name} · Orre` : m.name;

/** Papel que o formato dos stats sugere (motor: `meta.ts` -> `roleOf`). E leitura
 *  de PERCENTIL dentro do catalogo, nao rotulo do jogo — "parede" quer dizer que a
 *  especie aguenta mais que quase todas, nao que ela tenha uma classe. */
export const META_ROLE_LABEL: Record<string, string> = {
  glassCannon: "Canhão de vidro",
  sweeper: "Varredor",
  physicalAttacker: "Atacante físico",
  specialAttacker: "Atacante especial",
  mixedAttacker: "Atacante misto",
  bulkyAttacker: "Atacante resistente",
  wall: "Parede",
  physicalWall: "Parede física",
  specialWall: "Parede especial",
  balanced: "Equilibrado",
  filler: "Sem destaque",
};

/** O que cada papel quer dizer, em uma frase — o rotulo sozinho e adjetivo. */
export const META_ROLE_HINT: Record<string, string> = {
  glassCannon: "bate muito e aguenta pouco",
  sweeper: "bate muito e é rápido",
  physicalAttacker: "o dano dele sai do Ataque",
  specialAttacker: "o dano dele sai do Atq. Especial",
  mixedAttacker: "bate igual pelos dois lados",
  bulkyAttacker: "bate forte e ainda aguenta",
  wall: "aguenta muito e bate pouco",
  physicalWall: "aguenta golpe físico",
  specialWall: "aguenta golpe especial",
  balanced: "sem extremo pra nenhum lado",
  filler: "abaixo da média nos dois eixos",
};

/** Papel de combate lido dos stats. */
export const ROLE_LABEL: Record<string, string> = {
  FISICO: "Físico",
  "SP.ATK": "Atq. Especial",
  TANQUE: "Tanque",
  VIDA: "Vida",
  VELOZ: "Veloz",
};

/** Multiplicador de efetividade por extenso, pro leitor que nao decora "x0.25". */
export function multWord(mult: number): string {
  if (mult === 0) return "imune";
  if (mult === 4) return "dano quádruplo";
  if (mult === 2) return "dano dobrado";
  if (mult === 0.5) return "metade do dano";
  if (mult === 0.25) return "um quarto do dano";
  return `${mult}x de dano`;
}

/**
 * Numero com casas fixas, na vírgula.
 *
 * O site inteiro e pt-BR e mesmo assim `toFixed` vazava ponto decimal pra tela.
 * Nao era so inconsistencia de estilo: na ficha da especie o paragrafo dizia
 * "3,4%" e a tabela LOGO ABAIXO dizia "3.400%" pro mesmo drop — e em pt-BR o
 * ponto e separador de MILHAR, entao a tabela afirmava tres mil e quatrocentos
 * por cento. O `compact` e o `perHourLabel` ja convertiam por conta propria;
 * esta funcao existe pra a conversao parar de ser lembrada caso a caso.
 *
 * `max` corta o zero a direita quando ele nao informa nada (2,50x vira 2,5x).
 */
export function num(n: number, casas = 1, max = false): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: max ? 0 : casas,
    maximumFractionDigits: casas,
  });
}

/** O mesmo, com o sinal de porcento colado. */
export const pct = (n: number, casas = 1): string => `${num(n, casas)}%`;

/** Numero grande em formato compacto brasileiro: 6.500.000.000 vira "6,5 B".
 *  Sem os degraus altos, a versao anterior imprimia "6500000k". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  const cut = (div: number, suf: string) => {
    const v = n / div;
    const s = v.toFixed(Math.abs(v) < 100 ? 1 : 0).replace(".", ",").replace(/,0$/, "");
    return `${s}${suf}`;
  };
  if (abs >= 1e9) return cut(1e9, "B");
  if (abs >= 1e6) return cut(1e6, "M");
  if (abs >= 1000) return cut(1000, "k");
  return String(n);
}

/**
 * Inicial maiuscula.
 *
 * O catalogo do jogo entrega area em caixa baixa (`kanto`, `johto`), e isso e
 * dado cru — nao decisao de escrita. Nome proprio de regiao aparece em frase
 * ("aparece em Kanto") e em rotulo ("KANTO"), entao a normalizacao tem que
 * acontecer na BORDA da tela, e nao no dado.
 *
 * Existia so dentro de `prosa.ts`, privado. Por isso a prosa dizia "Kanto" e o
 * painel de onde caçar, na MESMA tela, dizia "kanto" — a mesma palavra com duas
 * grafias a dez centimetros de distancia.
 */
export const comInicial = (t: string): string =>
  t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
