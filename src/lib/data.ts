// Camada de dados: pega o catalogo (live com fallback) e monta as derivacoes.
// As derivacoes (indice reverso de drop, localizacoes, evolucao) sao o que o piwdex
// tem a mais que o piwtools.
//
// Frescor: quem decide e o source.ts (ETag da fonte, ver la). Aqui a unica regra e
// que TODA derivacao morre junto com a versao do catalogo — a chave do memo e o
// `version` da fonte, entao no segundo em que o jogo publica um patch, indice de
// drop, localizacao e cadeia evolutiva sao remontados do zero. Memo de modulo com
// chave errada (ou sem chave) e exatamente como um processo longo serve dado de
// ontem pra sempre.

import { cache } from "react";
import { fetchSource } from "./source";
import type { Acquisition, Creature, DropSource, EvolutionStage, Hunt, Item } from "./types";

// chance vem em escala 0..100000; porcentagem = chance / 1000. (Puro, sem fetch.)
export const chanceToPct = (chance: number): number => chance / 1000;

export interface DB {
  creatures: Creature[];
  items: Item[];
  hunts: Hunt[];
  /** quando o JOGO publicou este catalogo */
  generatedAt: string;
  live: boolean;
  /** identidade do catalogo; muda quando o jogo muda */
  version: string;
  /** epoch ms da ultima conferencia com a fonte */
  checkedAt: number;
  /** por que caiu pro snapshot; null = dado do jogo */
  error: string | null;
  counts: { creatures: number; items: number; hunts: number };
  totalDropEntries: number;
  getCreature: (pokeId: number) => Creature | undefined;
  getItem: (id: number) => Item | undefined;
  getItemByName: (name: string) => Item | undefined;
  locationsOf: (c: Creature) => Hunt[];
  acquisitionOf: (c: Creature) => Acquisition;
  dropSourcesOf: (itemName: string) => DropSource[];
  evolutionChainOf: (c: Creature) => EvolutionStage[];
}

// Derivacoes montadas em cima do catalogo, guardadas por VERSAO. Remontar as tabelas
// (2.657 entradas de loot, 347 spots, cadeias evolutivas) a cada request nao deixaria
// nada mais atual — o que decide atualidade e a versao da fonte, e ela e a chave daqui.
let derived: { version: string; index: DerivedIndex } | null = null;

type DerivedIndex = Pick<
  DB,
  "totalDropEntries" | "getCreature" | "getItem" | "getItemByName" | "locationsOf"
  | "acquisitionOf" | "dropSourcesOf" | "evolutionChainOf"
>;

/** `force` fura a CDN do jogo e refaz o download (acao explicita do usuario). */
export const getData = cache(async (force = false): Promise<DB> => {
  const src = await fetchSource(force);
  const { creatures, items, hunts, generatedAt, live, version, checkedAt, error } = src;

  if (derived && derived.version === version) {
    return { creatures, items, hunts, generatedAt, live, version, checkedAt, error,
             counts: { creatures: creatures.length, items: items.length, hunts: hunts.length },
             ...derived.index };
  }

  const creatureById = new Map<number, Creature>();
  for (const c of creatures) creatureById.set(c.pokeId, c);

  const itemById = new Map<number, Item>();
  const itemByName = new Map<string, Item>();
  for (const i of items) {
    itemById.set(i.id, i);
    itemByName.set(i.name, i);
  }

  const creaturesByLooktype = new Map<number, Creature[]>();
  for (const c of creatures) {
    const arr = creaturesByLooktype.get(c.looktype) ?? [];
    arr.push(c);
    creaturesByLooktype.set(c.looktype, arr);
  }
  // Um looktype pode ser dividido por varias criaturas (ex.: Gyarados e Furious
  // Gyarados). Atribui cada ponto de hunt a criatura cujo huntLevel e o mais proximo
  // do nivel do ponto — assim o spot de Outland/150 vai pro Furious, nao pro Gyarados.
  const huntsByCreature = new Map<number, Hunt[]>();
  for (const h of hunts) {
    const cands = creaturesByLooktype.get(h.looktype);
    if (!cands || cands.length === 0) continue;
    let best = cands[0];
    for (const c of cands) {
      if (Math.abs(c.huntLevel - h.level) < Math.abs(best.huntLevel - h.level)) best = c;
    }
    const arr = huntsByCreature.get(best.pokeId) ?? [];
    arr.push(h);
    huntsByCreature.set(best.pokeId, arr);
  }

  // Alvos de evolucao: quem e o "para onde" de alguma evolucao chega por evoluir.
  const evolveTargets = new Set<number>();
  for (const c of creatures) if (c.evolvesToId != null) evolveTargets.add(c.evolvesToId);
  // Como se consegue: tem spot -> caca; senao e alvo de evolucao -> evolucao;
  // senao -> especial (loja/cassino/ovo/evento). Puro dado derivado.
  function acquisitionOf(c: Creature): Acquisition {
    if ((huntsByCreature.get(c.pokeId)?.length ?? 0) > 0) return "hunt";
    if (evolveTargets.has(c.pokeId)) return "evo";
    return "special";
  }

  // indice reverso de drop: nome do item -> criaturas que dropam (com % convertida).
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
  for (const arr of dropSourcesByItem.values()) arr.sort((a, b) => b.chancePct - a.chancePct);

  function evolutionChainOf(c: Creature): EvolutionStage[] {
    let base = c;
    const guard = new Set<number>();
    for (;;) {
      if (guard.has(base.pokeId)) break;
      guard.add(base.pokeId);
      const prev = creatures.find((x) => x.evolvesToId === base.pokeId);
      if (!prev) break;
      base = prev;
    }
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

  const index: DerivedIndex = {
    totalDropEntries: creatures.reduce((n, c) => n + c.loot.length, 0),
    getCreature: (pokeId) => creatureById.get(pokeId),
    getItem: (id) => itemById.get(id),
    getItemByName: (name) => itemByName.get(name),
    locationsOf: (c) => huntsByCreature.get(c.pokeId) ?? [],
    acquisitionOf,
    dropSourcesOf: (itemName) => dropSourcesByItem.get(itemName) ?? [],
    evolutionChainOf,
  };
  derived = { version, index };

  return {
    creatures,
    items,
    hunts,
    generatedAt,
    live,
    version,
    checkedAt,
    error,
    counts: { creatures: creatures.length, items: items.length, hunts: hunts.length },
    ...index,
  };
});
