// Ponte entre o catalogo (data.ts) e o motor de hunt (combat.ts + hunt.ts).
//
// Mesmo contrato do `dex-data.ts`: deriva UMA vez no servidor, guarda por VERSAO
// do catalogo e manda pro navegador o minimo que a tela precisa pra refazer a
// conta sozinha.
//
// O que a hunt precisa a mais que a dex, e por que:
//
//  - **Golpes de TODO MUNDO.** O combate tem dois lados: o motor mede o seu DPS
//    contra o alvo E o dano que o alvo te devolve (`threatOf`). Sem o moveset do
//    selvagem, a tela promete XP/h de uma hunt que te mata. Por isso os golpes
//    vao PACOTADOS em tupla (`PackedMove`): 3.783 golpes com nome de campo em
//    JSON sao 133KB de chave repetida; em tupla, 77KB — o mesmo dado.
//  - **Loot cru por especie.** O ouro por abate ja vem calculado, mas o Tipo do
//    Dia MULTIPLICA a chance de cada drop e a chance tem TETO (ver `boost.ts`).
//    Refazer isso no cliente exige `[chance, quantidade media, preco]` — com o
//    total pronto, o bonus viraria "+20% em cima de tudo", que e exatamente o
//    erro que o teto desmente.
//
// So quem tem ponto no mapa vira ALVO; qualquer especie pode ser o seu LUTADOR
// (o jogador pode ter um que so evolui). Sao duas listas, nao uma.

import { cache } from "react";
import { getData } from "./data";
import { CHANCE_MAX } from "./boost";
import { enemyCombatStats, type EnemyCombat } from "./combat";
import { itemIconUrl } from "./sprites";
import type { PokeType } from "./types";

/** Um golpe em tupla: tipo, poder, nivel que aprende, especial?, recarga (ms), TM?. */
export type PackedMove = [PokeType, number, number, 0 | 1, number, 0 | 1];

/** Uma especie jogavel — qualquer uma pode ser o lutador. */
export interface PackedSpecies {
  id: number;
  name: string;
  t1: PokeType;
  t2: PokeType | null;
  /** hp, atk, def, spAtk, spDef, speed */
  bases: number[];
  mv: PackedMove[];
}

/** Um alvo de hunt: o que o motor precisa (EnemyCombat) mais o que a tela mostra. */
export interface HuntTarget extends EnemyCombat {
  /** quanto o jogo paga por vender o pokemon capturado — a lei de captura usa isso */
  sell: number;
  /** o drop que MAIS PAGA por abate (valor esperado), nao o mais caro */
  topDrop: { name: string; icon: string } | null;
}

/** `[chance, quantidade media, preco de NPC]` por especie — o cru pro Tipo do Dia. */
export type PackedDrops = Record<number, [number, number, number][]>;

export interface HuntPayload {
  species: PackedSpecies[];
  targets: HuntTarget[];
  drops: PackedDrops;
  areas: string[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
}

let memo: { version: string; payload: Omit<HuntPayload, "catalog"> } | null = null;

export const getHuntPayload = cache(async (): Promise<HuntPayload> => {
  const db = await getData();
  const catalog = { live: db.live, generatedAt: db.generatedAt, error: db.error };
  if (memo?.version === db.version) return { ...memo.payload, catalog };

  const species: PackedSpecies[] = [];
  const targets: HuntTarget[] = [];
  const drops: PackedDrops = {};

  for (const c of db.creatures) {
    const bases = [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];
    species.push({
      id: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      bases,
      mv: c.attacks.map((a) => [
        a.type,
        a.power,
        a.learnLevel,
        a.category === "SPECIAL" ? 1 : 0,
        a.cooldownMs,
        a.tm != null ? 1 : 0,
      ]),
    });

    const locs = db.locationsOf(c);
    if (locs.length === 0) continue; // sem ponto no mapa nao ha o que cacar

    // Ouro esperado por abate e o drop que mais paga. "Mais paga" e por VALOR
    // ESPERADO: 346 especies listam o Strange Pheromone, que vale 1.000.000 e cai
    // com chance ZERO. Ordenar por preco coroava um item que nunca sai.
    let gold = 0;
    let top: { name: string; icon: string; ev: number } | null = null;
    const packed: [number, number, number][] = [];
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      const price = it?.npcPrice ?? 0;
      const qty = (l.minCount + l.maxCount) / 2;
      const ev = (Math.min(CHANCE_MAX, l.chance) / CHANCE_MAX) * qty * price;
      gold += ev;
      if (it && ev > 0 && (!top || ev > top.ev)) {
        top = { name: it.name, icon: itemIconUrl(it), ev };
      }
      if (price > 0 && l.chance > 0) packed.push([l.chance, qty, price]);
    }
    if (packed.length) drops[c.pokeId] = packed;

    const huntLevel = Math.max(1, c.huntLevel);
    targets.push({
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      huntLevel,
      areas: [...new Set(locs.map((h) => h.area))].sort(),
      spotCount: locs.length,
      xp: c.experience,
      goldEV: Math.round(gold),
      sell: c.sellValue,
      topDrop: top ? { name: top.name, icon: top.icon } : null,
      ...enemyCombatStats(bases, huntLevel),
    });
  }

  const payload = {
    species: species.sort((a, b) => a.name.localeCompare(b.name)),
    targets,
    drops,
    areas: [...new Set(db.hunts.map((h) => h.area))].sort(),
  };
  memo = { version: db.version, payload };
  return { ...payload, catalog };
});
