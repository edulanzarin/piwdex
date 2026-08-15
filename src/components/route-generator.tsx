"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges } from "./badges";
import { TypeIcon } from "./type-icon";
import { Coin } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABELS, estimateIvs, powerOf, projectAll } from "@/lib/stats";
import { buildChain, buildRoute, SIM_IV, type Species, type EnemyCombat, type RouteStep, type RouteMode } from "@/lib/combat";

const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};
const numI = (s: string) => parseInt(s, 10);
const numF = (s: string) => parseFloat(String(s).replace(",", "."));
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const effLabel = (m: number) => (Number.isInteger(m) ? `${m}x` : `${+m.toFixed(2)}x`);
const SIM_IVS = Array<number>(6).fill(SIM_IV);

function StatIn({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.52rem] uppercase tracking-wide text-text-dim">{label}</span>
      <input className="input !py-1.5 text-sm" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function RouteGenerator({ species, enemies }: { species: Species[]; enemies: EnemyCombat[] }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [pick, setPick] = useState<ComboCreature | null>(null);
  const [level, setLevel] = useState("");
  const [target, setTarget] = useState("");
  const [quality, setQuality] = useState("1");
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [vip, setVip] = useState(false);
  const [mode, setMode] = useState<RouteMode>("xp");
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<RouteStep[] | null>(null);

  const byId = useMemo(() => {
    const m = new Map<number, Species>();
    for (const s of species) m.set(s.pokeId, s);
    return m;
  }, [species]);
  const combo: ComboCreature[] = useMemo(
    () => species.map((s) => ({ pokeId: s.pokeId, name: s.name, type1: s.t1, type2: s.t2 })).sort((a, b) => a.name.localeCompare(b.name)),
    [species],
  );

  const picked = pick ? byId.get(pick.pokeId) ?? null : null;
  const lvl = numI(level);
  const tgt = numI(target);
  const qual = Number.isFinite(numF(quality)) && numF(quality) > 0 ? numF(quality) : 1;
  const statVals = stats.map(numF);
  const statsReady = picked != null && Number.isFinite(lvl) && lvl > 0 && statVals.every((v) => Number.isFinite(v) && v > 0);
  const canCalc = picked != null && Number.isFinite(lvl) && lvl > 0 && Number.isFinite(tgt) && tgt > lvl;

  const ivInfo = useMemo(() => {
    if (statsReady && picked) {
      const e = estimateIvs(picked.bases, statVals, lvl, qual);
      return { ivs: e.ivs, total: e.total as number | null, power: powerOf(statVals, qual) as number | null };
    }
    if (picked && Number.isFinite(lvl) && lvl > 0) {
      return { ivs: SIM_IVS, total: null as number | null, power: projectAll(picked.bases, SIM_IVS, lvl, qual).power as number | null };
    }
    return { ivs: SIM_IVS, total: null as number | null, power: null as number | null };
  }, [statsReady, picked, statVals, lvl, qual]);

  // Muda qualquer entrada -> some o resultado (forca recalcular).
  const statsKey = stats.join(",");
  useEffect(() => { setResult(null); }, [pick, level, target, quality, statsKey, vip, mode]);

  const calc = () => {
    if (!canCalc || !picked) return;
    setComputing(true);
    // pequeno atraso pra mostrar o loader (o calculo em si e instantaneo).
    window.setTimeout(() => {
      const chain = buildChain(byId, picked);
      setResult(buildRoute(chain, lvl, tgt, enemies, qual, ivInfo.ivs, mode));
      setComputing(false);
    }, 650);
  };

  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));
  const fillBase = () => { if (picked) setStats(picked.bases.map(String)); };

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.pokemon")}</span>
            <PokemonCombobox creatures={combo} value={pick} onSelect={setPick} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.level")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 54" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-cyan">{t("hunt.route.target")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 200" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.quality")}</span>
            <input className="input" inputMode="decimal" placeholder="ex: 1,8" value={quality} onChange={(e) => setQuality(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.statsOpt")}</span>
            {picked && <button type="button" className="btn btn-ghost !py-1 !text-[0.5rem]" onClick={fillBase}>{t("hunt.route.useBase")}</button>}
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {STAT_LABELS.map((lb, i) => (
              <StatIn key={lb} label={lb} value={stats[i]} onChange={(v) => setStat(i, v)} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {ivInfo.total != null && (
              <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("hunt.route.ivTotal")} <span className="pixel ml-1 text-[0.7rem] text-green">{ivInfo.total.toFixed(1)}</span></span>
            )}
            {ivInfo.power != null && (
              <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("hunt.route.power")} <span className="pixel ml-1 text-[0.7rem] text-yellow">{ivInfo.power.toLocaleString("pt-BR")}</span></span>
            )}
            <span className="text-[0.62rem] text-text-dim">{t("hunt.route.ivNote")}</span>
          </div>
        </div>

        {/* Objetivo + calcular */}
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {(["xp", "money"] as RouteMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`btn !py-1.5 !text-[0.55rem] ${mode === m ? "" : "btn-ghost"}`}
                  style={mode === m ? { background: m === "money" ? "var(--yellow)" : "var(--green)", color: "#06131a" } : undefined}
                >
                  {t(m === "xp" ? "hunt.route.modeXp" : "hunt.route.modeMoney")}
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-dim">
              <input type="checkbox" className="accent-[color:var(--green)]" checked={vip} onChange={(e) => setVip(e.target.checked)} />
              {t("hunt.vip")}
            </label>
          </div>
          <button
            type="button"
            onClick={calc}
            disabled={!canCalc || computing}
            className="btn self-start disabled:opacity-40 sm:self-auto"
            style={{ background: "var(--cyan)", color: "#06131a" }}
          >
            {computing ? `${t("hunt.route.calcing")}...` : `${t("hunt.route.calc")} ›`}
          </button>
        </div>
      </div>

      <p className="rounded border border-cyan/30 bg-[rgba(55,211,230,0.06)] px-4 py-3 text-[0.7rem] leading-relaxed text-text-dim">{t("hunt.route.note")}</p>

      {computing ? (
        <div className="card"><LoadingBall label={t("hunt.route.calcing")} /></div>
      ) : !result ? (
        <div className="card p-10 text-center text-text-dim">{canCalc ? t("hunt.route.hitCalc") : t("hunt.route.pick")}</div>
      ) : result.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("hunt.route.empty")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {result.map((step, i) => {
            const p = step.pick;
            const evolved = i > 0 && result[i - 1].stageId !== step.stageId;
            const xp = p.enemy.xp * (vip ? 1.5 : 1);
            return (
              <div key={`${step.from}-${step.stageId}-${p.enemy.pokeId}`} className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3 lg:w-52 lg:shrink-0">
                  <span className="pixel text-[0.62rem] text-cyan">{t("hunt.route.band", { a: step.from, b: step.to })}</span>
                  <span className="flex items-center gap-1.5">
                    <Sprite src={spriteUrl(step.stageId)} alt={step.stageName} size={28} />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[0.78rem] text-text">{step.stageName}</span>
                      {evolved && <span className="text-[0.52rem] uppercase tracking-wide text-green">▲ evo</span>}
                    </span>
                  </span>
                </div>

                <div className="flex flex-1 items-center gap-3 border-t border-border/50 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{t("hunt.route.hunt")}</span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                    <Sprite src={spriteUrl(p.enemy.pokeId)} alt={p.enemy.name} size={34} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-text">{p.enemy.name}</span>
                      <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{p.enemy.areas.map(area).join(", ")} · lvl {p.enemy.huntLevel}</span>
                    </span>
                    <TypeBadges t1={p.enemy.t1} t2={p.enemy.t2} />
                  </span>
                </div>

                <div className="flex items-center gap-2 lg:w-36 lg:shrink-0">
                  <span className="chip inline-flex items-center gap-1" style={{ background: TYPE_COLOR[p.moveName], color: "#fff" }}>
                    <TypeIcon type={p.moveName} size={11} /> {typeLabel(p.moveName)}
                  </span>
                  <span className={`pixel text-[0.7rem] ${p.eff >= 2 ? "text-green" : p.eff > 1 ? "text-cyan" : "text-text-dim"}`}>{effLabel(p.eff)}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-border/50 pt-3 text-right lg:w-52 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("hunt.col.hits")}</span>
                    <span className="tabular-nums text-sm font-bold text-text">≈{p.hits}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("hunt.col.xp")}</span>
                    <span className="tabular-nums text-sm font-bold text-green">{compact(xp)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("hunt.col.gold")}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-bold text-yellow"><Coin />{compact(p.enemy.goldEV)}</span>
                  </div>
                </div>

                <span className={`chip self-start lg:self-center ${p.safe === "safe" ? "text-green" : "text-yellow"}`} style={{ background: "var(--surface-2)" }}>
                  {t(p.safe === "safe" ? "hunt.route.safe" : "hunt.route.risky")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
