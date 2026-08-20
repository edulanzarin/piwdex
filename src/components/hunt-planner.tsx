"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { TypeFilter } from "./type-filter";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { SelectMenu } from "./select-menu";
import { StatBar } from "./stat-bar";
import { Modal } from "./modal";
import { StatTile } from "./stat-tile";
import { Pagination } from "./pagination";
import { CloseButton } from "./icon-button";
import { Coin, Gold, Xp, ChevronRight } from "./icons";
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
  /** o alvo e do tipo premiado hoje: o `gold` da linha ja vem com o bonus aplicado */
  dayHit?: boolean;
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
        <div className="well flex h-20 w-20 shrink-0 items-center justify-center p-1">
          <Sprite src={spriteUrl(row.pokeId)} alt={row.name} size={72} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-text-dim">#{String(row.pokeId).padStart(3, "0")}</div>
          <h3 className="truncate pixel text-base text-text">{row.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TypeBadges t1={row.type1} t2={row.type2} />
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>lvl {row.huntLevel}</span>
          </div>
        </div>
        <CloseButton onClick={onClose} className="shrink-0 self-start" />
      </div>

      {/* Economia por kill */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label={t("hunt.col.xp")}
          value={row.xp.toLocaleString("pt-BR")}
          icon={<Xp size={14} className="text-yellow" />}
          accent="var(--yellow)"
        />
        <StatTile
          label={t("hunt.col.gold")}
          value={row.gold.toLocaleString("pt-BR")}
          icon={<Coin size={14} />}
          accent="var(--yellow)"
        />
        <StatTile
          label={t("hunt.col.sell")}
          value={row.sell > 0 ? row.sell.toLocaleString("pt-BR") : "—"}
          icon={<Coin size={14} />}
        />
      </div>

      {/* Stats base */}
      <div className="flex flex-col gap-2.5">
        <div className="section-title">{t("cr.statsBase")}</div>
        {STAT_LABELS.map((lb, i) => (
          <StatBar key={lb} iconIndex={i} label={lb} value={row.bases[i]} best={row.bases[i] === best} />
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="field-label">{t("cr.total")}</span>
          {/* enfase por cor (Jersey 10 nao tem bold) */}
          <span className="tabular-nums text-cyan">{total}</span>
        </div>
      </div>

      {/* Onde cacar + melhor drop */}
      <div className="flex flex-col gap-2 text-base">
        <div className="flex items-start gap-2">
          <span className="w-14 shrink-0 pt-0.5 field-label">{t("hunt.col.where")}</span>
          <span className="text-text">{row.areas.map(area).join(", ")} · {t("hunt.spots", { n: row.spotCount })}</span>
        </div>
        {/* linha sempre presente: sem drop o slot mostra "—" (modal nao muda de altura) */}
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 field-label">{t("hunt.col.drop")}</span>
          {row.topDrop ? (
            <span className="inline-flex items-center gap-2 text-text">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.topDrop.icon} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
              {row.topDrop.name}
            </span>
          ) : (
            <span className="slot-empty">—</span>
          )}
        </div>
      </div>

      <a href={`/dex/${row.pokeId}`} className="btn btn-cyan self-start">{t("hunt.viewDex")} <ChevronRight size={14} /></a>
    </Modal>
  );
}

export function EconomyTable({ rows, areas }: { rows: HuntRow[]; areas: string[] }) {
  const t = useT();
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [type, setType] = useState<PokeType | "">("");
  const [areaSel, setAreaSel] = useState("");
  const [maxLvl, setMaxLvl] = useState("");
  const [sort, setSort] = useState<Sort>("gold");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<HuntRow | null>(null);

  const lvlCap = num(maxLvl);

  // Lista pro combobox rico (sprite + badges de tipo), como no /calc e no Mercado.
  const comboList = useMemo<ComboCreature[]>(
    () =>
      rows
        .map((r) => ({ pokeId: r.pokeId, name: r.name, type1: r.type1, type2: r.type2 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (species && r.pokeId !== species.pokeId) return false;
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
  }, [rows, species, type, areaSel, lvlCap, sort]);

  useEffect(() => { setPage(0); }, [species, type, areaSel, maxLvl, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label className="col-span-2 flex flex-col gap-1 sm:w-64">
            <span className="field-label">{t("hunt.col.pokemon")}</span>
            <PokemonCombobox creatures={comboList} value={species} onSelect={setSpecies} placeholder={t("hunt.search")} />
          </label>
          <div className="flex flex-col gap-1 sm:w-52">
            <span className="field-label">{t("hunt.type")}</span>
            <TypeFilter value={type} onChange={setType} />
          </div>
          <div className="flex flex-col gap-1 sm:w-48">
            <span className="field-label">{t("hunt.allAreas")}</span>
            <SelectMenu
              value={areaSel}
              onChange={setAreaSel}
              options={[{ value: "", label: t("hunt.allAreas") }, ...areas.map((a) => ({ value: a, label: area(a) }))]}
            />
          </div>
          <label className="flex flex-col gap-1 sm:w-48">
            <span className="field-label">{t("hunt.maxLvl")}</span>
            <input
              className="input w-full"
              inputMode="numeric"
              placeholder="—"
              value={maxLvl}
              onChange={(e) => setMaxLvl(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1 sm:w-52">
            <span className="field-label">{t("hunt.sortBy")}</span>
            <SelectMenu
              value={sort}
              onChange={(v) => setSort(v as Sort)}
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

      <div className="text-base uppercase tracking-wide text-text-dim">{t("hunt.count", { n: filtered.length })}</div>

      {filtered.length === 0 ? (
        <div className="card flex min-h-[14rem] items-center justify-center p-10 text-center text-text-dim">{t("hunt.empty")}</div>
      ) : (
      <>
        <div className="card overflow-hidden p-0">
          {/* tabela larga rola DENTRO deste wrapper — a pagina nunca rola na horizontal */}
          <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-sm uppercase tracking-wide text-text-dim">
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
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
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
                      <span className="text-sm uppercase tracking-wide text-text-dim">
                        lvl {r.huntLevel} · {t("hunt.spots", { n: r.spotCount })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="tabular-nums text-text">{r.xp.toLocaleString("pt-BR")}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {/* com Tipo do Dia ligado o valor JA vem com o bonus (e com o teto de
                        chance); o selo diz que esta linha e uma das premiadas */}
                    <div className="inline-flex items-center justify-end gap-1.5 tabular-nums text-text">
                      <Gold value={r.gold} />
                      {r.dayHit && (
                        <span className="chip shrink-0" style={{ background: "var(--yellow)", color: "#2a2200" }} title={t("hunt.day.rowHint")}>
                          {t("hunt.day.chip")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.topDrop ? (
                      <span className="inline-flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.topDrop.icon} alt="" width={20} height={20} className="shrink-0 [image-rendering:pixelated]" />
                        <span className="text-base text-text-dim">{r.topDrop.name}</span>
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.sell > 0 ? (
                      <span className="inline-flex items-center gap-1 tabular-nums text-text-dim">
                        <Coin size={14} /> {r.sell.toLocaleString("pt-BR")}
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
        </div>
        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
      </>
      )}

      <p className="text-base leading-relaxed text-text-dim">{t("hunt.note")}</p>

      {sel && <HuntRowModal row={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
