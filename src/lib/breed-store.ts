// A estante: os pokémon que a pessoa salvou pra não redigitar doze números.
//
// Mora no `localStorage` porque é PREFERÊNCIA PESSOAL, não estado de tela: não
// descreve a vista, não se compartilha por link e não faz sentido no servidor.
//
// Tudo que sai daqui é DESCONFIADO. `localStorage` é editável pela pessoa, herda
// formato de versão anterior e sobrevive a mudança de código — ler sem validar é
// como o site quebra numa máquina só, que é o defeito mais caro de achar. Toda
// entrada passa por `saneia`, e o que não passa é descartado em silêncio: uma
// entrada podre não pode derrubar a estante inteira.

import type { BreedMon } from "./breeding";
import { IV_MAX, round3 } from "./breeding";
import type { PokeType } from "./types";

const CHAVE = "piwdex.breed.v1";
const LIMITE = 60;

function saneia(x: unknown): BreedMon | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  const pokeId = Number(m.pokeId);
  const quality = Number(m.quality);
  const ivs = Array.isArray(m.ivs) ? m.ivs.map(Number) : null;
  if (!Number.isFinite(pokeId) || pokeId <= 0) return null;
  if (!Number.isFinite(quality) || quality <= 0) return null;
  if (!ivs || ivs.length !== 6 || ivs.some((v) => !Number.isFinite(v))) return null;
  if (typeof m.name !== "string" || typeof m.species !== "string") return null;
  return {
    id: typeof m.id === "string" && m.id ? m.id : uid(),
    pokeId,
    name: m.name.slice(0, 40),
    species: m.species.slice(0, 40),
    type1: m.type1 as PokeType,
    type2: (m.type2 ?? null) as PokeType | null,
    quality: round3(quality),
    ivs: ivs.map((v) => Math.min(IV_MAX, Math.max(0, Math.round(v)))),
    shiny: m.shiny === true,
    createdAt: Number.isFinite(Number(m.createdAt)) ? Number(m.createdAt) : 0,
  };
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function lerEstante(): BreedMon[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return [];
    const arr: unknown = JSON.parse(cru);
    if (!Array.isArray(arr)) return [];
    return arr.map(saneia).filter((m): m is BreedMon => m != null).slice(0, LIMITE);
  } catch {
    return [];
  }
}

export function gravarEstante(mons: BreedMon[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(mons.slice(0, LIMITE)));
  } catch {
    // Cota estourada ou modo privado: perder a estante é ruim, derrubar a
    // ferramenta por causa dela é pior.
  }
}
