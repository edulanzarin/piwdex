"use client";

import { useState } from "react";
import { EconomyTable, type HuntRow } from "./hunt-planner";
import { RouteGenerator } from "./route-generator";
import { Tabs } from "./tabs";
import { useT } from "./locale-provider";
import type { Species, EnemyCombat } from "@/lib/combat";

type Mode = "route" | "table";

export function HuntTool({
  rows,
  areas,
  species,
  enemies,
}: {
  rows: HuntRow[];
  areas: string[];
  species: Species[];
  enemies: EnemyCombat[];
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("route");

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        active={mode}
        onChange={(k) => setMode(k as Mode)}
        accent="var(--yellow)"
        tabs={[
          { key: "route", label: t("hunt.mode.route") },
          { key: "table", label: t("hunt.mode.table") },
        ]}
      />

      {mode === "route" ? (
        <RouteGenerator species={species} enemies={enemies} />
      ) : (
        <EconomyTable rows={rows} areas={areas} />
      )}
    </div>
  );
}
