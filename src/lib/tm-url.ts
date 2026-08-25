// A pergunta do TM na URL.
//
// Duas coisas viajam, e as duas mudam a resposta na tela: o disco escolhido e se
// a lista está recortada na sua bolsa. A bolsa em si NÃO viaja — ela mora no
// navegador de quem coletou, e um link que carregasse a coleção junto mandaria
// mais do que quem mandou quis mandar. O que o link diz é "olhe o disco de Fogo",
// e do outro lado ele abre com a coleção de quem abriu.

import { slugDoTipo, tipoDoSlug } from "./tipo-url";
import type { PokeType } from "./types";

export interface TmState {
  /** null = nenhum escolhido ainda, e a tela mostra o panorama dos dezenove */
  disco: PokeType | null;
  /** recortar a lista nas cartas da bolsa */
  meus: boolean;
}

export const EMPTY_TM: TmState = { disco: null, meus: false };

export function parseTmState(sp: URLSearchParams): TmState {
  return {
    disco: tipoDoSlug(sp.get("d") ?? ""),
    meus: sp.get("meus") === "1",
  };
}

export function buildTmSearch(s: TmState): string {
  const p = new URLSearchParams();
  if (s.disco) p.set("d", slugDoTipo(s.disco));
  if (s.meus) p.set("meus", "1");
  const str = p.toString();
  return str ? `?${str}` : "";
}
