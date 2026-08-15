// URLs de imagem — mesma origem que o jogo/piwtools usam, sem hospedar nada.

import type { Item } from "./types";

const GAME_HOST = "https://poke.idleworld.online";
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** Sprite do pokemon pelo pokeId (PokeAPI). null para ids fora da faixa valida. */
export function spriteUrl(pokeId: number, shiny = false): string | null {
  if (pokeId <= 0 || pokeId >= 1e4) return null;
  return `${SPRITE_BASE}/${shiny ? "shiny/" : ""}${pokeId}.png`;
}

/** Icone do item. Absoluto (/assets/...) usa a raiz do jogo; bare vira /assets/items/. */
export function itemIconUrl(item: Item): string {
  const icon = item.icon;
  if (icon.startsWith("http")) return icon;
  if (icon.startsWith("/")) return `${GAME_HOST}${icon}`;
  return `${GAME_HOST}/assets/items/${icon}`;
}
