// Ponte entre o catalogo (data.ts) e o motor da dex (dex.ts).
//
// Fica separada porque e o unico lugar que conhece os dois lados, e porque o
// resultado e caro: derivar 482 especies (melhor golpe, estagio, fraquezas)
// custa tempo e nao muda enquanto o jogo nao publicar patch. O memo tem a
// VERSAO do catalogo como chave — memo sem chave, ou com chave errada, e como
// um processo longo passa a servir dado de ontem pra sempre.

import { getData } from "./data";
import { buildEntry, computeBounds, type DexBounds, type DexEntry } from "./dex";

export interface DexPayload {
  entries: DexEntry[];
  bounds: DexBounds;
  /** todo nome de item que alguma especie dropa, ordenado — o indice reverso */
  lootIndex: string[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
  counts: { creatures: number; items: number; hunts: number; drops: number };
}

let memo: { version: string; payload: Omit<DexPayload, "catalog"> } | null = null;

export async function getDexPayload(): Promise<DexPayload> {
  const db = await getData();
  const catalog = { live: db.live, generatedAt: db.generatedAt, error: db.error };

  if (memo?.version === db.version) return { ...memo.payload, catalog };

  const entries = db.creatures.map((c) =>
    buildEntry(c, {
      spotsOf: (x) => db.locationsOf(x).length,
      acquisitionOf: db.acquisitionOf,
      chainOf: (x) => db.evolutionChainOf(x).map((s) => ({ pokeId: s.creature.pokeId })),
    }),
  );

  // O indice de loot sai dos NOMES que aparecem em loot, nao do catalogo de
  // itens inteiro: oferecer no filtro um item que ninguem dropa so entrega
  // lista vazia.
  const names = new Set<string>();
  for (const c of db.creatures) for (const l of c.loot) names.add(l.name);

  const payload = {
    entries,
    // Os extremos saem do conjunto JOGAVEL: uma variante de Orre com stat fora
    // da curva esticaria o slider e deixaria 95% do catalogo espremido num
    // canto do trilho.
    bounds: computeBounds(entries.filter((e) => !e.variant)),
    lootIndex: [...names].sort((a, b) => a.localeCompare(b)),
    counts: {
      creatures: db.counts.creatures,
      items: db.counts.items,
      hunts: db.counts.hunts,
      drops: db.totalDropEntries,
    },
  };

  memo = { version: db.version, payload };
  return { ...payload, catalog };
}
