import { ALL_TYPES } from "./typing";
import { TYPE_LABEL } from "./labels";
import type { PokeType } from "./types";

/**
 * O endereco de um tipo, em portugues.
 *
 * A dex ja filtra por tipo, mas por parametro de busca (`/dex?tipo=fire`), e
 * parametro de busca e um endereco de segunda classe: o buscador rastreia com
 * ma vontade, nao distribui autoridade e raramente indexa. Uma pessoa que procura
 * "pokemon de fogo poke idle world" nao tem pagina pra encontrar.
 *
 * O slug e PORTUGUES porque o site e em portugues e a URL e lida por gente:
 * `/dex/tipo/fogo`, nao `/dex/tipo/fire`. O valor interno segue sendo o do
 * catalogo (`FIRE`) — quem traduz e esta camada, e so ela.
 *
 * Sem acento e sem cedilha de proposito: `água` na URL vira `%C3%A1gua`, que
 * quebra a leitura e quebra o copiar-e-colar.
 */
const SLUG: Record<PokeType, string> = {
  NORMAL: "normal",
  FIRE: "fogo",
  WATER: "agua",
  ELECTRIC: "eletrico",
  GRASS: "planta",
  ICE: "gelo",
  FIGHTING: "lutador",
  POISON: "venenoso",
  GROUND: "terrestre",
  FLYING: "voador",
  PSYCHIC: "psiquico",
  BUG: "inseto",
  ROCK: "pedra",
  GHOST: "fantasma",
  DRAGON: "dragao",
  DARK: "sombrio",
  STEEL: "metalico",
  FAIRY: "fada",
};

const POR_SLUG = new Map<string, PokeType>(
  ALL_TYPES.map((t) => [SLUG[t], t] as const),
);

export const slugDoTipo = (t: PokeType): string => SLUG[t];
export const tipoDoSlug = (s: string): PokeType | null => POR_SLUG.get(s.toLowerCase()) ?? null;
export const caminhoDoTipo = (t: PokeType): string => `/dex/tipo/${SLUG[t]}`;

/** Todos os slugs, na ordem canonica do catalogo — alimenta o generateStaticParams. */
export const TODOS_SLUGS: string[] = ALL_TYPES.map((t) => SLUG[t]);

/** "Pokémon de Fogo" / "Pokémon de Água" — o nome como a frase usa. */
export const nomeDoTipo = (t: PokeType): string => TYPE_LABEL[t];
