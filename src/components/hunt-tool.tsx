"use client";

import { useMemo, useState } from "react";
import { EconomyTable, type HuntRow } from "./hunt-planner";
import { RouteGenerator } from "./route-generator";
import { Tabs } from "./tabs";
import { TypeFilter } from "./type-filter";
import { TypeIcon } from "./type-icon";
import { useT } from "./locale-provider";
import { TYPE_COLOR } from "@/lib/typing";
import { CHANCE_MAX, TYPE_DAY_BONUS } from "@/lib/boost";
import type { PokeType } from "@/lib/types";
import type { Species, EnemyCombat } from "@/lib/combat";

type Mode = "route" | "table";

/** [chance, quantidade media, preco] — o suficiente pra refazer o ouro por abate. */
export type PackedDrops = Record<number, [number, number, number][]>;

/** Ouro por abate sob um multiplicador de loot, com o TETO de chance. E a mesma conta do
 *  servidor; vive aqui porque o cenario (qual tipo esta premiado) e escolha do usuario. */
export function goldUnder(drops: [number, number, number][] | undefined, mult: number): number {
  if (!drops?.length) return 0;
  let g = 0;
  for (const [chance, qty, price] of drops) g += (Math.min(CHANCE_MAX, chance * mult) / CHANCE_MAX) * qty * price;
  return g;
}

export function HuntTool({
  rows,
  areas,
  species,
  enemies,
  drops,
  dayType,
  dayPct,
}: {
  rows: HuntRow[];
  areas: string[];
  species: Species[];
  enemies: EnemyCombat[];
  drops: PackedDrops;
  /** tipo premiado que o servidor viu por ultimo; null = ninguem leu ainda */
  dayType: PokeType | null;
  dayPct: number | null;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("route");
  // comeca no tipo do dia de verdade; o usuario pode trocar pra simular outro
  const [day, setDay] = useState<PokeType | "">(dayType ?? "");

  const pct = dayPct ?? TYPE_DAY_BONUS;
  const hits = (t1: PokeType, t2: PokeType | null) => !!day && (t1 === day || t2 === day);

  // Ouro por abate ja com o bonus do dia onde ele vale. Sem tipo escolhido, e o valor que
  // o servidor mandou (nenhuma conta refeita a toa).
  const dayRows: HuntRow[] = useMemo(() => {
    if (!day) return rows;
    return rows.map((r) =>
      hits(r.type1, r.type2)
        ? { ...r, gold: Math.round(goldUnder(drops[r.pokeId], 1 + pct)), dayHit: true }
        : { ...r, dayHit: false },
    );
  }, [rows, day, drops, pct]);

  const dayEnemies: EnemyCombat[] = useMemo(() => {
    if (!day) return enemies;
    return enemies.map((e) =>
      hits(e.t1, e.t2) ? { ...e, goldEV: Math.round(goldUnder(drops[e.pokeId], 1 + pct)) } : e,
    );
  }, [enemies, day, drops, pct]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Tabs
        active={mode}
        onChange={(k) => setMode(k as Mode)}
        accent="var(--yellow)"
        tabs={[
          { key: "route", label: t("hunt.mode.route") },
          { key: "table", label: t("hunt.mode.table") },
        ]}
      />

      {/* Tipo do Dia: vale pros DOIS modos, entao mora aqui em cima e nao dentro de um. */}
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="field-label">{t("hunt.day.label")}</span>
          <TypeFilter value={day} onChange={setDay} className="w-[13rem]" emptyLabel={t("hunt.day.none")} />
        </label>
        {day ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="chip" style={{ background: TYPE_COLOR[day], color: "#fff" }}>
              <TypeIcon type={day} size={14} /> +{Math.round(pct * 100)}%
            </span>
            <span className="text-sm text-text-dim">
              {dayType === day ? t("hunt.day.fromGame") : t("hunt.day.sim")}
            </span>
          </span>
        ) : (
          <span className="text-sm text-text-dim">{t("hunt.day.hint")}</span>
        )}
      </div>

      {mode === "route" ? (
        <RouteGenerator species={species} enemies={dayEnemies} />
      ) : (
        <EconomyTable rows={dayRows} areas={areas} />
      )}
    </div>
  );
}
