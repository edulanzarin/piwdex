// Camada de dados: carrega o snapshot puro e monta as derivacoes em memoria.
// As derivacoes sao o que o piwdex tem a mais que o piwtools: indice reverso de
// drop ("onde dropa X"), localizacao de cada criatura e cadeia evolutiva.

import raw from "@/data/piwdex.json";
import type {
  Creature,
  DropSource,
  EvolutionStage,
  Hunt,
  Item,
  Snapshot,
} from "./types";

const snapshot = raw as unknown as Snapshot;

export const generatedAt = snapshot.generatedAt;
export const counts = snapshot.counts;
export const creatures: Creature[] = snapshot.creatures;
export const items: Item[] = snapshot.items;
export const hunts: Hunt[] = snapshot.hunts;

// chance vem em escala 0..100000; porcentagem = chance / 1000.
export const chanceToPct = (chance: number): number => chance / 1000;

// ---- indices (memoizados no modulo) ----

const creatureById = new Map<number, Creature>();
for (const c of creatures) creatureById.set(c.pokeId, c);

const itemById = new Map<number, Item>();
const itemByName = new Map<string, Item>();
for (const i of items) {
  itemById.set(i.id, i);
  itemByName.set(i.name, i);
}

const huntsByLooktype = new Map<number, Hunt[]>();
for (const h of hunts) {
  const arr = huntsByLooktype.get(h.looktype) ?? [];
  arr.push(h);
  huntsByLooktype.set(h.looktype, arr);
}

// indice reverso de drop: nome do item -> criaturas que dropam (com % ja convertida).
const dropSourcesByItem = new Map<string, DropSource[]>();
for (const c of creatures) {
  for (const l of c.loot) {
    const arr = dropSourcesByItem.get(l.name) ?? [];
    arr.push({
      creature: c,
      chancePct: chanceToPct(l.chance),
      minCount: l.minCount,
      maxCount: l.maxCount,
    });
    dropSourcesByItem.set(l.name, arr);
  }
}
// maior chance primeiro
for (const arr of dropSourcesByItem.values()) arr.sort((a, b) => b.chancePct - a.chancePct);

// ---- acessores ----

export const getCreature = (pokeId: number): Creature | undefined =>
  creatureById.get(pokeId);

export const getItem = (id: number): Item | undefined => itemById.get(id);

export const getItemByName = (name: string): Item | undefined => itemByName.get(name);

/** Onde a criatura aparece no mapa (join por looktype). */
export const locationsOf = (c: Creature): Hunt[] =>
  huntsByLooktype.get(c.looktype) ?? [];

/** Quem dropa este item e a que taxa, do mais provavel ao menos. */
export const dropSourcesOf = (itemName: string): DropSource[] =>
  dropSourcesByItem.get(itemName) ?? [];

/** Cadeia evolutiva completa que CONTEM esta criatura, do primeiro estagio ao ultimo. */
export function evolutionChainOf(c: Creature): EvolutionStage[] {
  // acha a base: recua por quem evolui para o atual, ate ninguem apontar.
  let base = c;
  const guard = new Set<number>();
  for (;;) {
    if (guard.has(base.pokeId)) break;
    guard.add(base.pokeId);
    const prev = creatures.find((x) => x.evolvesToId === base.pokeId);
    if (!prev) break;
    base = prev;
  }
  // avanca do base seguindo evolvesToId.
  const chain: EvolutionStage[] = [{ creature: base, evolveLevel: null }];
  const seen = new Set<number>([base.pokeId]);
  let cur = base;
  while (cur.evolvesToId != null) {
    const next = creatureById.get(cur.evolvesToId);
    if (!next || seen.has(next.pokeId)) break;
    chain.push({ creature: next, evolveLevel: cur.evolveLevel });
    seen.add(next.pokeId);
    cur = next;
  }
  return chain;
}

export const totalDropEntries = creatures.reduce((n, c) => n + c.loot.length, 0);
