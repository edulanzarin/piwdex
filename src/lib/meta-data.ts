// Ponte entre o catalogo (data.ts) e o motor de meta (meta.ts).
//
// Mesmo contrato do `dex-data.ts` e do `hunt-data.ts`: deriva uma vez no servidor,
// guarda por VERSAO do catalogo e manda pro navegador o minimo pra tela refazer as
// contas sozinha.
//
// Aqui o payload NAO pode ser o ranking pronto. A tier list muda inteira com o pool
// de golpes, o perfil precisa duelar a especie escolhida contra as outras 480, e o
// duelo projeta stats em qualquer nivel — sao contas que dependem do que o usuario
// escolhe, entao o que viaja e o INSUMO: as seis bases e os golpes.
//
// A diferenca pro payload da hunt e o NOME do golpe: a hunt so precisa do tipo (a
// tela mostra "Elétrico x2.5"), o meta mostra qual golpe carrega a especie ("Electric
// Storm"). E o que justifica um payload proprio em vez de reusar o de la.

import { cache } from "react";
import { getData } from "./data";
import type { AttackCategory, PokeType, Rarity } from "./types";

/** Um golpe em tupla: nome, tipo, especial?, poder, recarga (ms), nivel, tipo da TM. */
export type PackedAttack = [string, PokeType, 0 | 1, number, number, number, PokeType | null];

export interface PackedMon {
  id: number;
  name: string;
  t1: PokeType;
  t2: PokeType | null;
  r: Rarity;
  /** nivel do ponto de caca — 0 quando a especie nao se caca */
  hl: number;
  /** hp, atk, def, spAtk, spDef, speed */
  b: number[];
  a: PackedAttack[];
  /** regiao: null = catalogo base, "orre" = Orre */
  area: string | null;
  /** pokeId da especie que se captura pra chegar nesta (variante de skin) */
  cb: number | null;
}

export interface MetaPayload {
  mons: PackedMon[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
}

let memo: { version: string; mons: PackedMon[] } | null = null;

export const getMetaPayload = cache(async (): Promise<MetaPayload> => {
  const db = await getData();
  const catalog = { live: db.live, generatedAt: db.generatedAt, error: db.error };
  if (memo?.version === db.version) return { mons: memo.mons, catalog };

  const mons: PackedMon[] = db.creatures.map((c) => ({
    id: c.pokeId,
    name: c.name,
    t1: c.type1,
    t2: c.type2,
    r: c.rarity,
    hl: c.huntLevel,
    b: [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed],
    a: c.attacks.map((a) => [
      a.name,
      a.type,
      a.category === "SPECIAL" ? 1 : 0,
      a.power,
      a.cooldownMs,
      a.learnLevel,
      a.tm,
    ] as PackedAttack),
    area: c.area,
    cb: c.captureBase,
  }));

  memo = { version: db.version, mons };
  return { mons, catalog };
});

/** O formato que o motor pede. O `category` volta a ser palavra porque e assim que a
 *  tela mostra ("golpe especial"), e "STATUS" nao viaja: golpe sem dano nao entra em
 *  conta ofensiva nenhuma — o motor ja o descartaria. */
export function unpackMon(p: PackedMon) {
  return {
    pokeId: p.id,
    name: p.name,
    type1: p.t1,
    type2: p.t2,
    rarity: p.r,
    huntLevel: p.hl,
    baseHp: p.b[0],
    baseAtk: p.b[1],
    baseDef: p.b[2],
    baseSpAtk: p.b[3],
    baseSpDef: p.b[4],
    baseSpeed: p.b[5],
    attacks: p.a.map((a) => ({
      name: a[0],
      type: a[1],
      category: (a[2] === 1 ? "SPECIAL" : "PHYSICAL") as AttackCategory,
      power: a[3],
      cooldownMs: a[4],
      learnLevel: a[5],
      tm: a[6],
    })),
    area: p.area,
    captureBase: p.cb,
  };
}
