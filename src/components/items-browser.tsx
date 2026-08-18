"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import { itemIconUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { SelectMenu } from "./select-menu";
import { Pagination } from "./pagination";
import { Gold } from "./icons";
import { useT } from "./locale-provider";

const PAGE_SIZE = 48;

export function ItemsBrowser({ items }: { items: Item[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [page, setPage] = useState(0);

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

  useEffect(() => { setPage(0); }, [q, cat]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input sm:max-w-xs"
          placeholder={t("items.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <SelectMenu
          value={cat}
          onChange={setCat}
          className="sm:max-w-[12rem]"
          options={[{ value: "", label: t("items.allCat") }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
      </div>

      <div className="text-base text-text-dim uppercase tracking-wide">{t("items.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("items.empty")}</div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {paged.map((i) => (
            <Link key={i.id} href={`/items/${i.id}`} className="card card-link flex items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                <Sprite src={itemIconUrl(i)} alt={i.name} size={30} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.name}</div>
                <div className="text-sm text-text-dim uppercase tracking-wide">
                  {i.category}
                  {i.rare ? <> · {t("items.rare")}</> : ""}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-base text-green">
                  <Gold value={i.npcPrice} />
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4"><Pagination page={safePage} pageCount={pageCount} onPage={setPage} /></div>
        </>
      )}
    </div>
  );
}
