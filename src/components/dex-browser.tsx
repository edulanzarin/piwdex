"use client";

import { useEffect, useMemo, useState } from "react";
import type { Acquisition, Creature, PokeType } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { CreatureCard } from "./creature-card";
import { TypeFilter } from "./type-filter";
import { SelectMenu } from "./select-menu";
import { TypeIcon } from "./type-icon";
import { Pagination } from "./pagination";
import { Close } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";

const PAGE_SIZE = 60;

// Filtro client-side sobre a lista completa (482 itens, barato).
export function DexBrowser({ creatures, acq }: { creatures: Creature[]; acq: Record<number, Acquisition> }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");
  const [origin, setOrigin] = useState<"" | Acquisition>("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return creatures.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && String(c.pokeId) !== needle)
        return false;
      if (type && c.type1 !== type && c.type2 !== type) return false;
      if (origin && acq[c.pokeId] !== origin) return false;
      return true;
    });
  }, [creatures, acq, q, type, origin]);

  useEffect(() => { setPage(0); }, [q, type, origin]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input sm:max-w-xs"
          placeholder={t("dex.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <TypeFilter value={type} onChange={setType} />
        <SelectMenu
          value={origin}
          onChange={(v) => setOrigin(v as "" | Acquisition)}
          className="sm:max-w-[12rem]"
          options={[
            { value: "", label: t("dex.acq.all") },
            { value: "hunt", label: t("dex.acq.hunt") },
            { value: "evo", label: t("dex.acq.evo") },
            { value: "special", label: t("dex.acq.special") },
          ]}
        />
      </div>

      {type && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button className="chip inline-flex items-center gap-1" style={{ background: TYPE_COLOR[type], color: "#fff" }} onClick={() => setType("")}>
            <TypeIcon type={type} size={11} /> {typeLabel(type)} <Close size={9} />
          </button>
        </div>
      )}

      <div className="text-[0.9rem] text-text-dim uppercase tracking-wide">{t("dex.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("dex.empty")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {paged.map((c) => (
              <CreatureCard key={c.pokeId} creature={c} acq={acq[c.pokeId]} />
            ))}
          </div>
          <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  );
}
