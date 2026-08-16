"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { TypeFilter } from "./type-filter";
import { SelectMenu } from "./select-menu";
import { StatBar } from "./stat-bar";
import { Modal } from "./modal";
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
  bases: number[]; // hp, atk, def, spAtk, spDef, speed — pro peek de stats
}

type Sort = "gold" | "xp" | "lvl" | "name";

const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const num = (s: string): number => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : NaN;
};
const PAGE_SIZE = 25;

// Peek de um alvo de hunt: sprite, tipos, stats base (mesmas barras da dex/mercado)
// e a economia por kill — sem sair da lista filtrada.
function HuntRowModal({ row, onClose }: { row: HuntRow; onClose: () => void }) {
  const t = useT();
  const total = row.bases.reduce((a, b) => a + b, 0);
  const best = Math.max(...row.bases);
  return (
    <Modal onClose={onClose} className="w-full max-w-md gap-5 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={spriteUrl(row.pokeId)} alt={row.name} size={72} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.55rem] text-text-dim">#{String(row.pokeId).padStart(3, "0")}</div>
          <h3 className="truncate pixel text-[0.9rem] text-text">{row.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TypeBadges t1={row.type1} t2={row.type2} />
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>lvl {row.huntLevel}</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="fechar" className="shrink-0 self-start rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text">✕</button>
      </div>

      {/* Economia por kill */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
          <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.col.xp")}</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-text">{row.xp.toLocaleString("pt-BR")}</div>
        </div>
        <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
          <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.col.gold")}</div>
          <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-yellow"><Gold value={row.gold} /></div>
        </div>
        <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
          <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.col.sell")}</div>
          <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-text-dim">
            {row.sell > 0 ? <><Coin />{row.sell.toLocaleString("pt-BR")}</> : "—"}
          </div>
        </div>
      </div>

      {/* Stats base */}
      <div className="flex flex-col gap-2.5">
        <div className="pixel text-[0.62rem] text-cyan">{t("cr.statsBase")}</div>
        {STAT_LABELS.map((lb, i) => (
          <StatBar key={lb} iconIndex={i} label={lb} value={row.bases[i]} best={row.bases[i] === best} />
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("cr.total")}</span>
          <strong className="tabular-nums text-cyan">{total}</strong>
        </div>
      </div>

      {/* Onde cacar + melhor drop */}
      <div className="flex flex-col gap-2 text-[0.72rem]">
        <div className="flex items-start gap-2">
          <span className="w-14 shrink-0 pt-0.5 text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.col.where")}</span>
          <span className="text-text">{row.areas.map(area).join(", ")} · {t("hunt.spots", { n: row.spotCount })}</span>
        </div>
        {row.topDrop && (
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.col.drop")}</span>
            <span className="inline-flex items-center gap-2 text-text">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.topDrop.icon} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
              {row.topDrop.name}
            </span>
          </div>
        )}
      </div>

      <a href={`/dex/${row.pokeId}`} className="btn btn-cyan self-start">{t("hunt.viewDex")} ›</a>
    </Modal>
  );
}

export function EconomyTable({ rows, areas }: { rows: HuntRow[]; areas: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");
  const [areaSel, setAreaSel] = useState("");
  const [maxLvl, setMaxLvl] = useState("");
  const [sort, setSort] = useState<Sort>("gold");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<HuntRow | null>(null);

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
          <div className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.allAreas")}</span>
            <SelectMenu
              value={areaSel}
              onChange={setAreaSel}
              className="sm:max-w-[12rem]"
              options={[{ value: "", label: t("hunt.allAreas") }, ...areas.map((a) => ({ value: a, label: area(a) }))]}
            />
          </div>
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
          <div className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("hunt.sortBy")}</span>
            <SelectMenu
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              className="sm:max-w-[13rem]"
              options={[
                { value: "gold", label: t("hunt.sort.gold") },
                { value: "xp", label: t("hunt.sort.xp") },
                { value: "lvl", label: t("hunt.sort.lvl") },
                { value: "name", label: t("hunt.sort.name") },
              ]}
            />
          </div>
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
                <tr
                  key={r.pokeId}
                  onClick={() => setSel(r)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setSel(r); }}
                  className="group cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                        <Sprite src={spriteUrl(r.pokeId)} alt={r.name} size={34} />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-text group-hover:text-cyan">{r.name}</span>
                        <TypeBadges t1={r.type1} t2={r.type2} />
                      </span>
                    </span>
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

      {sel && <HuntRowModal row={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
