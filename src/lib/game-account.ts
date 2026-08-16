// Normaliza o JSON de /api/characters/me em pokemons com Power/IV calculados pela
// nossa engine (stats.ts). O formato EXATO da resposta do jogo so da pra cravar com um
// token real, entao isto e best-effort: varre o JSON atras de objetos que parecem
// pokemon (tem nivel + nome/id) e tenta mapear os campos por varios nomes conhecidos.
// A rota tambem devolve o RAW pra a gente finalizar o mapeamento quando conectar.

import { estimateIvs, powerOf, projectAll } from "./stats";
import type { Creature } from "./types";

export interface AccountMon {
  pokeId: number | null;
  name: string;
  level: number | null;
  quality: number | null;
  shiny: boolean;
  power: number | null;
  ivTotal: number | null;
  ivs: number[] | null;
}

type Rec = Record<string, unknown>;

const asNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const firstNum = (o: Rec, keys: string[]) => { for (const k of keys) { const n = asNum(o[k]); if (n != null) return n; } return null; };
const firstStr = (o: Rec, keys: string[]) => { for (const k of keys) { const s = asStr(o[k]); if (s) return s; } return null; };

function statsOf(o: Rec): number[] | null {
  const arr = o.stats ?? o.currentStats ?? o.baseStats;
  if (Array.isArray(arr) && arr.length >= 6 && arr.slice(0, 6).every((x) => asNum(x) != null)) return arr.slice(0, 6).map(Number);
  const six = [
    firstNum(o, ["hp", "health"]),
    firstNum(o, ["atk", "attack"]),
    firstNum(o, ["def", "defense"]),
    firstNum(o, ["spAtk", "spatk", "specialAttack", "spAttack"]),
    firstNum(o, ["spDef", "spdef", "specialDefense", "spDefense"]),
    firstNum(o, ["speed", "spd", "spe"]),
  ];
  return six.every((x) => x != null) ? (six as number[]) : null;
}
function ivsOf(o: Rec): number[] | null {
  const arr = o.ivs ?? o.growths ?? o.iv ?? o.growth;
  if (Array.isArray(arr) && arr.length >= 6 && arr.slice(0, 6).every((x) => asNum(x) != null)) return arr.slice(0, 6).map(Number);
  return null;
}
function looksLikeMon(o: Rec): boolean {
  const lvl = firstNum(o, ["level", "lvl", "currentLevel"]);
  const named = firstStr(o, ["name", "species", "pokemonName", "nickname", "speciesName"]) != null;
  const ided = firstNum(o, ["pokeId", "pokemonId", "dexId", "speciesId", "looktype", "number", "dexNumber"]) != null;
  return lvl != null && (named || ided);
}

// Coleta recursiva de candidatos a pokemon no JSON (limite pra nao explodir).
function collect(node: unknown, out: Rec[], depth = 0) {
  if (out.length >= 500 || depth > 8 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const v of node) collect(v, out, depth + 1); return; }
  const o = node as Rec;
  if (looksLikeMon(o)) out.push(o);
  for (const v of Object.values(o)) if (v && typeof v === "object") collect(v, out, depth + 1);
}

const basesOf = (c: Creature) => [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];

export function normalizeAccount(raw: unknown, creatures: Creature[]): AccountMon[] {
  const byId = new Map<number, Creature>();
  const byLook = new Map<number, Creature>();
  const byName = new Map<string, Creature>();
  for (const c of creatures) {
    byId.set(c.pokeId, c);
    if (!byLook.has(c.looktype)) byLook.set(c.looktype, c);
    byName.set(c.name.toLowerCase(), c);
  }

  const cands: Rec[] = [];
  collect(raw, cands);

  const mons: AccountMon[] = [];
  for (const o of cands) {
    const name = firstStr(o, ["nickname", "name", "species", "pokemonName", "speciesName"]) ?? "?";
    const pokeId = firstNum(o, ["pokeId", "pokemonId", "dexId", "speciesId", "number", "dexNumber"]);
    const look = firstNum(o, ["looktype", "look"]);
    const level = firstNum(o, ["level", "lvl", "currentLevel"]);
    const quality = firstNum(o, ["quality", "growth", "growthMult", "qualityMult"]);
    const shiny = Boolean(o.shiny ?? o.isShiny ?? false);

    const species =
      (pokeId != null ? byId.get(pokeId) : undefined) ??
      (look != null ? byLook.get(look) : undefined) ??
      byName.get(name.toLowerCase());

    let power: number | null = null;
    let ivTotal: number | null = null;
    let ivs: number[] | null = ivsOf(o);
    const stats = statsOf(o);

    if (species && quality != null) {
      const bases = basesOf(species);
      if (stats && level != null) {
        power = powerOf(stats, quality);
        const e = estimateIvs(bases, stats, level, quality);
        ivs = e.ivs.map((v) => Math.round(v));
        ivTotal = Math.round(e.total);
      } else if (ivs) {
        ivTotal = ivs.reduce((a, b) => a + b, 0);
        if (level != null) power = projectAll(bases, ivs, level, quality).power;
      }
    } else if (ivs) {
      ivTotal = ivs.reduce((a, b) => a + b, 0);
    }

    mons.push({ pokeId: species?.pokeId ?? pokeId, name: species?.name ?? name, level, quality, shiny, power, ivTotal, ivs });
  }
  return mons;
}
