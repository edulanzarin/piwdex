"use client";

import { useMemo, useState } from "react";
import type { Creature, PokeType } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { CreatureCard } from "./creature-card";
import { TypeFilter } from "./type-filter";
import { TypeIcon } from "./type-icon";
import { useT, useTypeLabel } from "./locale-provider";

// Filtro client-side sobre a lista completa (482 itens, barato).
export function DexBrowser({ creatures }: { creatures: Creature[] }) {
  const t = useT();
  const typeLabel = useTypeLabel();
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
          placeholder={t("dex.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <TypeFilter value={type} onChange={setType} />
      </div>

      {type && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button className="chip" style={{ background: TYPE_COLOR[type], color: "#fff" }} onClick={() => setType("")}>
            <TypeIcon type={type} size={11} /> {typeLabel(type)} ×
          </button>
        </div>
      )}

      <div className="text-[0.7rem] text-text-dim uppercase tracking-wide">{t("dex.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("dex.empty")}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((c) => (
            <CreatureCard key={c.pokeId} creature={c} />
          ))}
        </div>
      )}
    </div>
  );
}
