"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { useT } from "./locale-provider";

export interface DropRow {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  huntLevel: number;
  chancePct: number;
  minCount: number;
  maxCount: number;
}

const PAGE_SIZE = 20;

function pctLabel(p: number): string {
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  return `${p.toFixed(4)}%`;
}

export function DropSourcesTable({ sources }: { sources: DropRow[] }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(sources.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = sources.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { setPage(0); }, [sources]);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.62rem] uppercase tracking-wide text-text-dim">
              <th className="pb-2 font-medium">{t("col.pokemon")}</th>
              <th className="pb-2 font-medium">{t("col.types")}</th>
              <th className="pb-2 text-right font-medium">{t("col.huntLvl")}</th>
              <th className="pb-2 text-right font-medium">{t("col.qty")}</th>
              <th className="pb-2 text-right font-medium">{t("col.chance")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr key={s.pokeId} className="group cursor-pointer border-t border-border hover:bg-surface-2">
                <td className="py-1.5">
                  <Link href={`/dex/${s.pokeId}`} className="flex items-center gap-2 text-cyan group-hover:underline">
                    <Sprite src={spriteUrl(s.pokeId)} alt="" size={30} />
                    <span>{s.name}</span>
                    <span className="text-[0.6rem] text-text-dim opacity-0 transition group-hover:opacity-100">›</span>
                  </Link>
                </td>
                <td className="py-1.5"><TypeBadges t1={s.type1} t2={s.type2} /></td>
                <td className="py-1.5 text-right tabular-nums">{s.huntLevel}</td>
                <td className="py-1.5 text-right text-text-dim">{s.minCount === s.maxCount ? s.minCount : `${s.minCount}–${s.maxCount}`}</td>
                <td className="py-1.5 text-right tabular-nums">{s.chancePct === 0 ? t("special") : pctLabel(s.chancePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button type="button" className="btn btn-ghost !py-1.5 disabled:opacity-40" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
          <span className="text-[0.7rem] uppercase tracking-wide text-text-dim">{t("hunt.page", { a: safePage + 1, b: pageCount })}</span>
          <button type="button" className="btn btn-ghost !py-1.5 disabled:opacity-40" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>›</button>
        </div>
      )}
    </div>
  );
}
