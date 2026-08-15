"use client";

import { useMemo, useState } from "react";
import type { Creature, PokeType } from "@/lib/types";
import { ALL_TYPES, TYPE_COLOR } from "@/lib/typing";
import { CreatureCard } from "./creature-card";

// Filtro client-side sobre a lista completa (482 itens, barato).
export function DexBrowser({ creatures }: { creatures: Creature[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creatures.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && String(c.pokeId) !== needle)
        return false;
      if (type && c.type1 !== type && c.type2 !== type) return false;
      return true;
    });
  }, [creatures, q, type]);

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
          className="input sm:max-w-[12rem]"
          value={type}
          onChange={(e) => setType(e.target.value as PokeType | "")}
        >
          <option value="">Todos os tipos</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {type && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button className="chip" style={{ background: TYPE_COLOR[type], color: "#fff" }} onClick={() => setType("")}>
            {type} ×
          </button>
        </div>
      )}

      <div className="text-[0.7rem] text-text-dim uppercase tracking-wide">{filtered.length} pokemons</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">Nada encontrado com esses filtros.</div>
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
