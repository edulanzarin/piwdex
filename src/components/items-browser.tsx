"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import { itemIconUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { Gold } from "./icons";
import { useT } from "./locale-provider";

export function ItemsBrowser({ items }: { items: Item[] }) {
  const t = useT();
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
          placeholder={t("items.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:max-w-[12rem]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("items.allCat")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="text-[0.7rem] text-text-dim uppercase tracking-wide">{t("items.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("items.empty")}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((i) => (
            <Link key={i.id} href={`/items/${i.id}`} className="card card-link flex items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
                <Sprite src={itemIconUrl(i)} alt={i.name} size={30} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.name}</div>
                <div className="text-[0.65rem] text-text-dim uppercase tracking-wide">
                  {i.category}
                  {i.rare ? <> · {t("items.rare")}</> : ""}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-yellow">
                  <Gold value={i.npcPrice} /> <span className="text-text-dim">{t("items.npc")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
