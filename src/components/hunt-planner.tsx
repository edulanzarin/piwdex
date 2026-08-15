"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { TypeFilter } from "./type-filter";
import { Coin, Gold } from "./icons";
import { useT } from "./locale-provider";

// Uma linha = um pokemon cacavel, com a economia por kill ja calculada no server.
export interface HuntRow {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  xp: number;
  gold: number; // ouro esperado do loot por kill (EV)
  sell: number; // sellValue do pokemon
  huntLevel: number;
  areas: string[];
  spotCount: number;
  topDrop: { name: string; icon: string } | null;
}

type Sort = "gold" | "xp" | "lvl" | "name";

const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const num = (s: string): number => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : NaN;
};
const PAGE_SIZE = 25;

export function EconomyTable({ rows, areas }: { rows: HuntRow[]; areas: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");
  const [areaSel, setAreaSel] = useState("");
  const [maxLvl, setMaxLvl] = useState("");
  const [sort, setSort] = useState<Sort>("gold");
  const [page, setPage] = useState(0);

  const lvlCap = num(maxLvl);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (needle && !r.name.toLowerCase().includes(needle) && String(r.pokeId) !== needle) return false;
      if (type && r.type1 !== type && r.type2 !== type) return false;
      if (areaSel && !r.areas.includes(areaSel)) return false;
      if (Number.isFinite(lvlCap) && r.huntLevel > lvlCap) return false;
      return true;
    });
    const by: Record<Sort, (a: HuntRow, b: HuntRow) => number> = {
      gold: (a, b) => b.gold - a.gold,
      xp: (a, b) => b.xp - a.xp,
      lvl: (a, b) => a.huntLevel - b.huntLevel || b.gold - a.gold,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [rows, q, type, areaSel, lvlCap, sort]);

  useEffect(() => { setPage(0); }, [q, type, areaSel, maxLvl, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <input
            className="input sm:max-w-[16rem]"
            placeholder={t("hunt.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <TypeFilter value={type} onChange={setType} />
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.allAreas")}</span>
            <select className="input cursor-pointer pr-8" value={areaSel} onChange={(e) => setAreaSel(e.target.value)}>
              <option value="">{t("hunt.allAreas")}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{area(a)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.maxLvl")}</span>
            <input
              className="input w-24"
              inputMode="numeric"
              placeholder="—"
              value={maxLvl}
              onChange={(e) => setMaxLvl(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.sortBy")}</span>
            <select className="input cursor-pointer pr-8" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="gold">{t("hunt.sort.gold")}</option>
              <option value="xp">{t("hunt.sort.xp")}</option>
              <option value="lvl">{t("hunt.sort.lvl")}</option>
              <option value="name">{t("hunt.sort.name")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="text-[0.7rem] uppercase tracking-wide text-text-dim">{t("hunt.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("hunt.empty")}</div>
      ) : (
      <>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.6rem] uppercase tracking-wide text-text-dim">
                <th className="px-4 py-3">{t("hunt.col.pokemon")}</th>
                <th className="px-4 py-3">{t("hunt.col.where")}</th>
                <th className="px-4 py-3 text-right">{t("hunt.col.xp")}</th>
                <th className="px-4 py-3 text-right">{t("hunt.col.gold")}</th>
                <th className="px-4 py-3">{t("hunt.col.drop")}</th>
                <th className="px-4 py-3 text-right">{t("hunt.col.sell")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.pokeId} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link href={`/dex/${r.pokeId}`} className="group flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                        <Sprite src={spriteUrl(r.pokeId)} alt={r.name} size={34} />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-text group-hover:text-cyan">{r.name}</span>
                        <TypeBadges t1={r.type1} t2={r.type2} />
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text">{r.areas.map(area).join(", ")}</span>
                      <span className="text-[0.64rem] uppercase tracking-wide text-text-dim">
                        lvl {r.huntLevel} · {t("hunt.spots", { n: r.spotCount })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="tabular-nums font-bold text-text">{r.xp.toLocaleString("pt-BR")}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center justify-end gap-1 tabular-nums font-bold text-text">
                      <Gold value={r.gold} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.topDrop ? (
                      <span className="inline-flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.topDrop.icon} alt="" width={20} height={20} className="shrink-0 [image-rendering:pixelated]" />
                        <span className="text-[0.78rem] text-text-dim">{r.topDrop.name}</span>
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.sell > 0 ? (
                      <span className="inline-flex items-center gap-1 tabular-nums text-text-dim">
                        <Coin /> {r.sell.toLocaleString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              className="btn btn-ghost !py-1.5 disabled:opacity-40"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ‹
            </button>
            <span className="text-[0.7rem] uppercase tracking-wide text-text-dim">
              {t("hunt.page", { a: safePage + 1, b: pageCount })}
            </span>
            <button
              type="button"
              className="btn btn-ghost !py-1.5 disabled:opacity-40"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              ›
            </button>
          </div>
        )}
      </>
      )}

      <p className="text-[0.66rem] leading-relaxed text-text-dim">{t("hunt.note")}</p>
    </div>
  );
}
