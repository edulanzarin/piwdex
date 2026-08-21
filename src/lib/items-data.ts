// Ponte entre o catalogo (data.ts) e o motor de itens (items.ts) — a irma de
// `dex-data.ts`.
//
// Fica separada pelo mesmo motivo: e o unico lugar que conhece os dois lados, e
// o resultado e caro (428 itens x 2.657 linhas do indice reverso). O memo tem a
// VERSAO do catalogo como chave — memo sem chave e como um processo longo passa
// a servir dado de ontem pra sempre.

import { getData } from "./data";
import {
  buildItemEntry,
  computeItemBounds,
  type ItemBounds,
  type ItemEntry,
} from "./items";

/** Especie reduzida ao par que o filtro "o que ela dropa" precisa. Mandar a
 *  `Creature` inteira pra alimentar um combobox custaria 1MB pra usar dois
 *  campos. */
export interface DexBrief {
  id: number;
  name: string;
}

export interface ItemsPayload {
  entries: ItemEntry[];
  bounds: ItemBounds;
  /** so as especies que dropam ALGUMA coisa — oferecer no filtro quem nao dropa
   *  nada so entrega lista vazia */
  dexIndex: DexBrief[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
  counts: { items: number; dropped: number; farmable: number; drops: number };
}

let memo: { version: string; payload: Omit<ItemsPayload, "catalog"> } | null = null;

export async function getItemsPayload(): Promise<ItemsPayload> {
  const db = await getData();
  const catalog = { live: db.live, generatedAt: db.generatedAt, error: db.error };

  if (memo?.version === db.version) return { ...memo.payload, catalog };

  const entries = db.items.map((i) =>
    buildItemEntry(i, {
      sourcesOf: db.dropSourcesOf,
      spotsOf: (c) => db.locationsOf(c).length,
    }),
  );

  const dexIndex: DexBrief[] = db.creatures
    .filter((c) => c.loot.length > 0)
    .map((c) => ({ id: c.pokeId, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    entries,
    bounds: computeItemBounds(entries),
    dexIndex,
    counts: {
      items: entries.length,
      dropped: entries.filter((e) => e.sources > 0).length,
      farmable: entries.filter((e) => e.farmSources > 0).length,
      drops: db.totalDropEntries,
    },
  };

  memo = { version: db.version, payload };
  return { ...payload, catalog };
}
