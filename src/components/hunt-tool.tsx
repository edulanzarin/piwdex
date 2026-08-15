"use client";

import { useState } from "react";
import { EconomyTable, type HuntRow } from "./hunt-planner";
import { RouteGenerator } from "./route-generator";
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
      <div className="flex gap-2">
        {(["route", "table"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`btn !py-2 ${mode === m ? "" : "btn-ghost"}`}
            style={mode === m ? { background: "var(--cyan)", color: "#06131a" } : undefined}
          >
            {t(m === "route" ? "hunt.mode.route" : "hunt.mode.table")}
          </button>
        ))}
      </div>

      {mode === "route" ? (
        <RouteGenerator species={species} enemies={enemies} />
      ) : (
        <EconomyTable rows={rows} areas={areas} />
      )}
    </div>
  );
}
