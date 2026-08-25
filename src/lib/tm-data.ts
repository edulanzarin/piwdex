// Ponte entre o catálogo e a ferramenta de TM.
//
// Mesmo contrato do `stadium-data.ts` e do `eevee-data.ts`: reusa o payload do
// Meta pras espécies — que já traz as seis bases e o MOVESET INTEIRO, incluindo o
// campo `tm` de cada golpe — e acrescenta só o que falta.
//
// E o que falta é pouco de propósito: os ícones dos dezenove discos. Tudo o mais
// que esta tela mostra (quem aprende o quê, quanto o TM adiciona, qual golpe sai
// de cena) se deriva do moveset que já viaja, e derivar no servidor aqui só
// congelaria uma resposta que muda com o que a pessoa escolhe na tela.

import { cache } from "react";
import { getData } from "./data";
import { getMetaPayload, type PackedMon } from "./meta-data";
import { ITEM_AOE, itemDoTipo } from "./tm";
import { assetIconUrl } from "./sprites";
import type { PokeType } from "./types";

export interface DiscoItem {
  /** null no disco de AoE, que não pertence a tipo nenhum */
  tipo: PokeType | null;
  nome: string;
  /** URL no host do jogo; vazia quando o item não está no catálogo */
  icone: string;
}

export interface TmPayload {
  mons: PackedMon[];
  discos: DiscoItem[];
  /** o item que se troca pelos discos, pra tela nomear a moeda certa */
  peca: DiscoItem | null;
  catalog: { live: boolean; generatedAt: string; error: string | null };
}

const TIPOS: PokeType[] = [
  "NORMAL",
  "FIRE",
  "WATER",
  "GRASS",
  "ELECTRIC",
  "ICE",
  "FIGHTING",
  "POISON",
  "GROUND",
  "FLYING",
  "PSYCHIC",
  "BUG",
  "ROCK",
  "GHOST",
  "DRAGON",
  "DARK",
  "STEEL",
  "FAIRY",
];

let memo: {
  version: string;
  discos: DiscoItem[];
  peca: DiscoItem | null;
} | null = null;

export const getTmPayload = cache(async (): Promise<TmPayload> => {
  const { mons, catalog } = await getMetaPayload();
  const db = await getData();

  if (memo?.version === db.version) {
    return { mons, discos: memo.discos, peca: memo.peca, catalog };
  }

  const de = (nome: string, tipo: PokeType | null): DiscoItem => {
    const item = db.getItemByName(nome);
    return { tipo, nome, icone: item ? assetIconUrl(item.icon) : "" };
  };

  // Os dezoito elementais mais o de AoE. A lista de TIPOS é a fonte, e não o
  // `category: "tm"` do catálogo: existe disco no jogo sem golpe correspondente
  // (Normal, Aço, Fada), e a tela precisa MOSTRAR essa ausência em vez de a lista
  // simplesmente não ter a linha. Ausência que não aparece parece decisão.
  const discos = [
    ...TIPOS.map((t) => de(itemDoTipo(t), t)),
    de(ITEM_AOE, null),
  ];

  memo = { version: db.version, discos, peca: de("TM Disk Piece", null) };
  return { mons, discos, peca: memo.peca, catalog };
});
