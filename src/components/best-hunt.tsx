"use client";

// MELHOR HUNT — a pergunta direta, sem formulario: "onde eu farmo mais?".
//
// A premissa que torna isso possivel sem saber nada do seu pokemon e a do proprio
// Eduardo: se voce INSTA-MATA em toda hunt, o tempo por abate e o mesmo em todas — sobra
// o spawn e a animacao. E se os abates por hora sao iguais, ranquear por HORA e ranquear
// por ABATE. Nao ha nada pra informar.
//
// O segundo por abate e o unico botao que sobra, e ele so ESCALA a lista (nao muda a
// ordem). O padrao, 3,3s, saiu de medicao numa conta real (Tyrogue 900 abates/h, Yanma
// 713, resolvendo ttk = HP/DPS + overhead).
//
// Tres metricas porque sao tres perguntas diferentes:
//   - loot        : exato, vem da tabela de drop do jogo;
//   - + captura   : soma a venda do bicho capturado, pela lei derivada (estimativa);
//   - XP          : upar.

import { useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { CATCH_LAW_FALLBACK, predictCatchRate } from "@/lib/catch-law";
import { BALLS } from "@/lib/balls";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { SelectMenu } from "./select-menu";
import { ToggleButton } from "./toggle-button";
import { Coin, Xp } from "./icons";
import { useT } from "./locale-provider";
import type { HuntRow } from "./hunt-planner";

type Metric = "gold" | "goldCatch" | "xp";

const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const TOP = 25;

export function BestHunt({ rows, areas }: { rows: HuntRow[]; areas: string[] }) {
  const t = useT();
  const [metric, setMetric] = useState<Metric>("gold");
  const [secs, setSecs] = useState("3.3");
  const [areaFilter, setAreaFilter] = useState("");
  const [ballKey, setBallKey] = useState("ultra");
  const [maxLvl, setMaxLvl] = useState("");

  const perKill = Math.max(0.3, Number(secs.replace(",", ".")) || 3.3);
  const kosH = 3600 / perKill;
  const ball = BALLS.find((b) => b.key === ballKey) ?? BALLS[0];

  const list = useMemo(() => {
    const lvl = Number(maxLvl);
    const hasLvl = Number.isFinite(lvl) && lvl > 0;
    return rows
      .filter((r) => (!areaFilter || r.areas.includes(areaFilter)) && (!hasLvl || r.huntLevel <= lvl))
      .map((r) => {
        // a lei preve a chance pela FAIXA DE VALOR do bicho: quanto mais caro, mais dificil
        const chance = predictCatchRate(CATCH_LAW_FALLBACK, r.sell, ball.catchRate);
        const catchGold = chance * r.sell;
        const value = metric === "xp" ? r.xp : metric === "gold" ? r.gold : r.gold + catchGold;
        return { r, chance, catchGold, perKill: value, perHour: value * kosH };
      })
      .sort((a, b) => b.perHour - a.perHour)
      .slice(0, TOP);
  }, [rows, areaFilter, maxLvl, metric, ball, kosH]);

  const isXp = metric === "xp";

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="field-label">{t("hunt.best.metric")}</span>
          <div className="flex flex-wrap gap-1.5">
            <ToggleButton active={metric === "gold"} onClick={() => setMetric("gold")} accent="yellow">
              <Coin size={16} /> {t("hunt.best.mGold")}
            </ToggleButton>
            <ToggleButton active={metric === "goldCatch"} onClick={() => setMetric("goldCatch")} accent="yellow">
              <Coin size={16} /> {t("hunt.best.mGoldCatch")}
            </ToggleButton>
            <ToggleButton active={metric === "xp"} onClick={() => setMetric("xp")} accent="green">
              <Xp size={16} /> {t("hunt.best.mXp")}
            </ToggleButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="field-label" title={t("hunt.best.secsHint")}>{t("hunt.best.secs")}</span>
            <input className="input" inputMode="decimal" value={secs} onChange={(e) => setSecs(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("hunt.best.maxLvl")}</span>
            <input className="input" inputMode="numeric" placeholder={t("hunt.best.any")} value={maxLvl} onChange={(e) => setMaxLvl(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("hunt.allAreas")}</span>
            <SelectMenu
              value={areaFilter}
              onChange={setAreaFilter}
              options={[{ value: "", label: t("hunt.allAreas") }, ...areas.map((a) => ({ value: a, label: area(a) }))]}
            />
          </label>
          {metric === "goldCatch" && (
            <label className="flex flex-col gap-1">
              <span className="field-label">{t("hunt.best.ball")}</span>
              <SelectMenu
                value={ballKey}
                onChange={setBallKey}
                options={BALLS.filter((b) => b.catchRate < 255).map((b) => ({ value: b.key, label: `${b.name} (x${b.catchRate})` }))}
              />
            </label>
          )}
        </div>

        <p className="text-sm leading-relaxed text-text-dim">
          {t("hunt.best.assume", { n: Math.round(kosH).toLocaleString("pt-BR") })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {list.map((x, i) => (
          <div key={x.r.pokeId} className="well flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="pixel w-6 shrink-0 text-sm text-text-dim">{i + 1}</span>
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--surface-2)]">
                <Sprite src={spriteUrl(x.r.pokeId)} alt={x.r.name} size={34} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-text">{x.r.name}</span>
                  <TypeBadges t1={x.r.type1} t2={x.r.type2} icon={false} />
                  {x.r.dayHit && (
                    <span className="chip shrink-0" style={{ background: "var(--yellow)", color: "#2a2200" }}>
                      {t("hunt.day.chip")}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs uppercase tracking-wide text-text-dim">
                  {x.r.areas.map(area).join(", ")} · lvl {x.r.huntLevel}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-0.5 sm:w-40">
              <span className={`pixel inline-flex items-center gap-1 tabular-nums text-base ${isXp ? "text-cyan" : "text-green"}`}>
                {isXp ? <Xp size={14} /> : <Coin size={14} />}{compact(x.perHour)}/h
              </span>
              <span className="whitespace-nowrap text-[0.68rem] tabular-nums text-text-dim">
                {metric === "goldCatch"
                  ? t("hunt.best.break", { loot: compact(x.r.gold), cap: compact(x.catchGold), pct: (x.chance * 100).toFixed(2) })
                  : t("hunt.best.perKill", { v: compact(x.perKill) })}
              </span>
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <div className="card flex min-h-24 items-center justify-center text-center text-text-dim">{t("hunt.empty")}</div>
        )}
      </div>

      <p className="text-sm leading-relaxed text-text-dim">
        {metric === "goldCatch" ? t("hunt.best.noteCatch") : t("hunt.best.note")}
      </p>
    </div>
  );
}
