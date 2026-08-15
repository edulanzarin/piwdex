"use client";

import { useMemo, useState } from "react";
import type { Creature, PokeType, Rarity } from "@/lib/types";
import { ALL_TYPES, RARITY_ORDER, RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { CreatureCard } from "./creature-card";

// Filtro client-side sobre a lista completa (482 itens, barato). Estado tambem
// espelhado na URL pra sobreviver ao reload (principio: filtro mora na URL).
export function DexBrowser({ creatures }: { creatures: Creature[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");
  const [rarity, setRarity] = useState<Rarity | "">("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creatures.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && String(c.pokeId) !== needle)
        return false;
      if (type && c.type1 !== type && c.type2 !== type) return false;
      if (rarity && c.rarity !== rarity) return false;
      return true;
    });
  }, [creatures, q, type, rarity]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por nome ou #id..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input sm:max-w-[10rem]"
          value={type}
          onChange={(e) => setType(e.target.value as PokeType | "")}
        >
          <option value="">Todos os tipos</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="input sm:max-w-[10rem]"
          value={rarity}
          onChange={(e) => setRarity(e.target.value as Rarity | "")}
        >
          <option value="">Toda raridade</option>
          {RARITY_ORDER.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {(type || rarity) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {type && (
            <button
              className="chip"
              style={{ background: TYPE_COLOR[type] }}
              onClick={() => setType("")}
            >
              {type} ✕
            </button>
          )}
          {rarity && (
            <button
              className="chip"
              style={{ background: RARITY_COLOR[rarity], color: "#111", textShadow: "none" }}
              onClick={() => setRarity("")}
            >
              {rarity} ✕
            </button>
          )}
        </div>
      )}

      <div className="text-sm text-text-dim">{filtered.length} pokemons</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">
          Nada encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {filtered.map((c) => (
            <CreatureCard key={c.pokeId} creature={c} />
          ))}
        </div>
      )}
    </div>
  );
}
