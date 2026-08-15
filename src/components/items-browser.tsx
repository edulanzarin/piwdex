"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import { itemIconUrl } from "@/lib/sprites";

export function ItemsBrowser({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (needle && !i.name.toLowerCase().includes(needle)) return false;
      if (cat && i.category !== cat) return false;
      return true;
    });
  }, [items, q, cat]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar item..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:max-w-[12rem]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Toda categoria</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="text-sm text-text-dim">{filtered.length} itens</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">Nenhum item encontrado.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((i) => (
            <Link
              key={i.id}
              href={`/items/${i.id}`}
              className="card flex items-center gap-3 p-3 hover:border-accent transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={itemIconUrl(i)} alt="" width={28} height={28} className="pixelated" loading="lazy" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{i.name}</div>
                <div className="text-xs text-text-dim">
                  {i.category}
                  {i.rare ? " · raro" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
