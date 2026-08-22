"use client";

import { useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import {
  boostRoi,
  lootMultiplier,
  nextStreakCost,
  paybackKills,
  streakCostRange,
  streakPointsUnlocked,
  TYPE_DAY_BONUS,
  type LootBonuses,
  type PricedDrop,
} from "@/lib/boost";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { SelectMenu } from "./select-menu";
import { TypeFilter } from "./type-filter";
import { TypeBadge } from "./badges";
import { ToggleButton } from "./toggle-button";
import { Pagination } from "./pagination";
import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { Coin, Loot, Chart, Target } from "./icons";
import { useT } from "./locale-provider";

// Uma linha = um pokemon cacavel com os drops ja precificados. O cenario (quais
// bonus estao ligados) e do cliente: a mesma lista responde a qualquer combinacao
// sem ida ao servidor.
export interface BoostRow {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  huntLevel: number;
  areas: string[];
  drops: PricedDrop[];
}

type Sort = "delta" | "efficiency" | "base" | "lvl";

const PAGE_SIZE = 25;
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const int = (s: string): number => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// Barra de aproveitamento: verde captura quase tudo, vermelho bate no teto. A cor
// E o dado aqui — e a unica coluna que responde "vale a pena?" de relance.
function EfficiencyBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = pct >= 70 ? "var(--green)" : pct >= 35 ? "var(--yellow)" : "var(--red)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-10 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-11 shrink-0 text-right tabular-nums text-xs" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function Field({
  label, value, onChange, hint, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1" title={hint}>
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          className="input w-full"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="shrink-0 text-xs text-text-dim">{suffix}</span>}
      </div>
    </label>
  );
}

export function BoostTool({ rows, areas }: { rows: BoostRow[]; areas: string[] }) {
  const t = useT();
  // quanto o Tipo do Dia paga, em % — sai da constante do motor pra tela nunca discordar
  // do calculo (o "+50%" chumbado aqui sobreviveu ao valor real por um patch inteiro)
  const dayPct = Math.round(TYPE_DAY_BONUS * 100);

  // Cenario de bonus
  const [streakLoot, setStreakLoot] = useState("10");
  const [lootBoost, setLootBoost] = useState(true);
  const [eventPct, setEventPct] = useState("0");
  const [typeDay, setTypeDay] = useState<PokeType | "">("");
  // Streak
  const [totalKills, setTotalKills] = useState("12000");
  const [spent, setSpent] = useState("12");
  // Filtros
  const [q, setQ] = useState("");
  const [areaSel, setAreaSel] = useState("");
  const [maxLvl, setMaxLvl] = useState("");
  const [sort, setSort] = useState<Sort>("delta");
  const [kpm, setKpm] = useState("12");
  const [page, setPage] = useState(0);

  const bonuses: LootBonuses = useMemo(
    () => ({
      streakLoot: int(streakLoot),
      lootBoost,
      eventPct: int(eventPct),
      typeDay: typeDay || null,
    }),
    [streakLoot, lootBoost, eventPct, typeDay],
  );
  // Dois multiplicadores: o de FUNDO (vale em qualquer alvo) e o do tipo premiado.
  // Mostrar um numero só escondia que o segundo nao vale no catalogo inteiro.
  const mult = lootMultiplier(bonuses);
  const multTypeDay = typeDay ? lootMultiplier(bonuses, [typeDay]) : null;

  // ROI de cada alvo sob o cenario atual.
  const scored = useMemo(
    () => rows.map((r) => ({ row: r, roi: boostRoi(r.drops, bonuses, [r.type1, r.type2]) })),
    [rows, bonuses],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const lvl = maxLvl.trim() === "" ? Infinity : int(maxLvl);
    const out = scored.filter(({ row }) => {
      if (needle && !row.name.toLowerCase().includes(needle)) return false;
      if (areaSel && !row.areas.includes(areaSel)) return false;
      if (row.huntLevel > lvl) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === "delta") return b.roi.delta - a.roi.delta;
      if (sort === "efficiency") return b.roi.efficiency - a.roi.efficiency;
      if (sort === "base") return b.roi.base - a.roi.base;
      return a.row.huntLevel - b.row.huntLevel;
    });
    return out;
  }, [scored, q, areaSel, maxLvl, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const killsPerHour = int(kpm) * 60;

  // Streak: o melhor alvo da lista filtrada e a referencia de payback — investir um
  // ponto so se paga se voce for cacar em algum lugar.
  const best = filtered[0];
  const unlocked = streakPointsUnlocked(int(totalKills));
  const available = Math.max(0, unlocked - int(spent));
  const nextCost = nextStreakCost(int(spent));
  const costTo10 = streakCostRange(int(spent), int(spent) + 10);
  // Quanto UM ponto a mais (+0,1%) adiciona no melhor alvo, sobre o cenario atual.
  const bestTypes = best ? [best.row.type1, best.row.type2] : [];
  const oneMoreDelta = best
    ? boostRoi(best.row.drops, { ...bonuses, streakLoot: bonuses.streakLoot + 1 }, bestTypes).boosted -
      boostRoi(best.row.drops, bonuses, bestTypes).boosted
    : 0;
  const payback = paybackKills(nextCost, oneMoreDelta);

  const sortOptions = [
    { value: "delta", label: t("boost.sort.delta") },
    { value: "efficiency", label: t("boost.sort.eff") },
    { value: "base", label: t("boost.sort.base") },
    { value: "lvl", label: t("boost.sort.lvl") },
  ];
  const areaOptions = [
    { value: "", label: t("hunt.allAreas") },
    ...areas.map((a) => ({ value: a, label: area(a) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel icon={<Loot />} title={t("boost.scenario")} accent="var(--cyan)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label={t("boost.streakLoot")}
            value={streakLoot}
            onChange={setStreakLoot}
            hint={t("boost.streakLootHint")}
            suffix="pts"
          />
          <Field label={t("boost.event")} value={eventPct} onChange={setEventPct} suffix="%" />
          <label className="flex flex-col gap-1" title={t("boost.typeDayHint", { pct: dayPct })}>
            <span className="field-label">{t("boost.typeDay")}</span>
            <TypeFilter value={typeDay} onChange={setTypeDay} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("boost.lootBoost")}</span>
            <ToggleButton active={lootBoost} onClick={() => setLootBoost((v) => !v)} accent="cyan">
              {lootBoost ? t("boost.on") : t("boost.off")}
            </ToggleButton>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label={t("boost.multiplier")}
            value={
              multTypeDay ? (
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span>x{mult.toFixed(3)}</span>
                  <span className="inline-flex items-center gap-1 text-sm text-text-dim">
                    <TypeBadge type={typeDay as PokeType} icon={false} />
                    x{multTypeDay.toFixed(3)}
                  </span>
                </span>
              ) : (
                `x${mult.toFixed(3)}`
              )
            }
            accent="var(--cyan)"
            icon={<Chart />}
          />
          <StatTile
            label={t("boost.bestTarget")}
            value={best ? best.row.name : "—"}
            accent="var(--green)"
            icon={<Target />}
          />
          <StatTile
            label={t("boost.bestDelta")}
            value={best ? `+${fmt(best.roi.delta)}` : "—"}
            accent="var(--yellow)"
            icon={<Coin />}
          />
          <StatTile
            label={t("boost.bestEff")}
            value={best ? `${(best.roi.efficiency * 100).toFixed(0)}%` : "—"}
            accent="var(--green)"
          />
        </div>
        <p className="text-sm text-text-dim">{t("boost.capNote")}</p>
        <p className="text-sm text-text-dim">{t("boost.typeDayNote", { pct: dayPct })}</p>
      </Panel>

      <Panel icon={<Coin />} title={t("boost.streakTitle")} accent="var(--yellow)" collapsible defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("boost.totalKills")} value={totalKills} onChange={setTotalKills} />
          <Field label={t("boost.spent")} value={spent} onChange={setSpent} suffix="pts" />
          <StatTile label={t("boost.unlocked")} value={fmt(unlocked)} accent="var(--cyan)" />
          <StatTile
            label={t("boost.available")}
            value={fmt(available)}
            accent={available > 0 ? "var(--green)" : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile label={t("boost.nextCost")} value={fmt(nextCost)} accent="var(--yellow)" />
          <StatTile label={t("boost.costTo10")} value={fmt(costTo10)} accent="var(--yellow)" />
          <StatTile
            label={t("boost.payback")}
            value={Number.isFinite(payback) ? `${fmt(payback)} ${t("boost.kills")}` : "—"}
            accent="var(--green)"
          />
        </div>
        <p className="text-sm text-text-dim">{t("boost.streakNote")}</p>
      </Panel>

      <Panel icon={<Chart />} title={t("boost.rankTitle")} accent="var(--cyan)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="field-label">{t("boost.search")}</span>
            <input
              className="input"
              value={q}
              placeholder={t("hunt.search")}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("boost.area")}</span>
            <SelectMenu value={areaSel} onChange={(v) => { setAreaSel(v); setPage(0); }} options={areaOptions} />
          </label>
          <Field label={t("hunt.maxLvl")} value={maxLvl} onChange={(v) => { setMaxLvl(v); setPage(0); }} />
          <Field label={t("hunt.kpm")} value={kpm} onChange={setKpm} hint={t("hunt.kpmHint")} />
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("hunt.sortBy")}</span>
            <SelectMenu value={sort} onChange={(v) => { setSort(v as Sort); setPage(0); }} options={sortOptions} />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-2 field-label">{t("boost.col.target")}</th>
                <th className="py-2 px-2 field-label text-right">{t("boost.col.lvl")}</th>
                <th className="py-2 px-2 field-label text-right">{t("boost.col.base")}</th>
                <th className="py-2 px-2 field-label text-right">{t("boost.col.delta")}</th>
                <th className="py-2 px-2 field-label text-right">{t("boost.col.perHour")}</th>
                <th className="py-2 pl-2 field-label min-w-[8rem]">{t("boost.col.eff")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ row, roi }) => (
                <tr key={`${row.pokeId}-${row.huntLevel}`} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <Sprite src={spriteUrl(row.pokeId)} alt={row.name} size={32} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-text">{row.name}</span>
                          {roi.typeDayHits && (
                            <span className="chip" style={{ background: "var(--yellow)", color: "#2a2200" }} title={t("boost.typeDayHint", { pct: dayPct })}>
                              +{dayPct}%
                            </span>
                          )}
                        </div>
                        <TypeBadges t1={row.type1} t2={row.type2} />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-text-dim">{row.huntLevel}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-text-dim">{fmt(roi.base)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-yellow">+{fmt(roi.delta)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-green">
                    +{fmt(roi.delta * killsPerHour)}
                  </td>
                  <td className="py-2 pl-2">
                    <EfficiencyBar value={roi.efficiency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <p className="py-6 text-center text-text-dim">{t("hunt.empty")}</p>}

        <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
        <p className="text-sm text-text-dim">{t("boost.rankNote")}</p>
      </Panel>
    </div>
  );
}
