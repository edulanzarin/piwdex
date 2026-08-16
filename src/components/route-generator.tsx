"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges } from "./badges";
import { TypeIcon } from "./type-icon";
import { ToggleButton } from "./toggle-button";
import { Coin, Diamond } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABELS, estimateIvs, powerOf } from "@/lib/stats";
import { StatIcon } from "./stat-icons";
import { buildRoute, SIM_IV, type Species, type EnemyCombat, type RouteStep, type RouteMode } from "@/lib/combat";

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

function StatIn({ label, value, onChange, iconIndex }: { label: string; value: string; onChange: (v: string) => void; iconIndex: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[0.52rem] uppercase tracking-wide text-text-dim">
        <StatIcon index={iconIndex} size={10} />{label}
      </span>
      <input className="input !py-1.5 text-sm" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// Seta pra cima (upar/XP), herda a cor.
const XP_ROWS = [
  ".....##.....", "....####....", "...######...", "..########..",
  ".##########.", "....####....", "....####....", "....####....",
  "....####....", "............", "............", "............",
];
function XpIcon({ size = 12 }: { size?: number }) {
  const rects: React.ReactNode[] = [];
  XP_ROWS.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === "#") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />); });
  return <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }} aria-hidden="true">{rects}</svg>;
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
  // Stats sao obrigatorios: sem eles nao da pra medir a forca real do pokemon.
  const canCalc = statsReady && Number.isFinite(tgt) && tgt > lvl;

  const ivInfo = useMemo(() => {
    if (statsReady && picked) {
      const e = estimateIvs(picked.bases, statVals, lvl, qual);
      return { ivs: e.ivs, total: e.total as number | null, power: powerOf(statVals, qual) as number | null };
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
      setResult(buildRoute(picked, lvl, tgt, enemies, qual, ivInfo.ivs, mode, vip));
      setComputing(false);
    }, 650);
  };

  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));
  const fillBase = () => { if (picked) setStats(picked.bases.map(String)); };

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.pokemon")}</span>
            <PokemonCombobox creatures={combo} value={pick} onSelect={setPick} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.level")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 54" value={level} onChange={(e) => setLevel(e.target.value)} />
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
          <div className="grid grid-cols-3 gap-2.5">
            {STAT_LABELS.map((lb, i) => (
              <StatIn key={lb} iconIndex={i} label={lb} value={stats[i]} onChange={(v) => setStat(i, v)} />
            ))}
          </div>
          {(ivInfo.total != null || ivInfo.power != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              {ivInfo.total != null && (
                <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("hunt.route.ivTotal")} <span className="pixel ml-1 text-[0.7rem] text-green">{ivInfo.total.toFixed(1)}</span></span>
              )}
              {ivInfo.power != null && (
                <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("hunt.route.power")} <span className="pixel ml-1 text-[0.7rem] text-yellow">{ivInfo.power.toLocaleString("pt-BR")}</span></span>
              )}
            </div>
          )}
        </div>

        {/* Nivel alvo + prioridade + VIP + calcular */}
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-[0.6rem] uppercase tracking-wide text-cyan">{t("hunt.route.target")}</span>
              <input className="input w-28" inputMode="numeric" placeholder="ex: 200" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("hunt.route.priority")}</span>
              <div className="flex gap-1.5">
                <ToggleButton active={mode === "xp"} onClick={() => setMode("xp")} accent="green">
                  <XpIcon size={12} /> {t("hunt.route.priorityXp")}
                </ToggleButton>
                <ToggleButton active={mode === "gold"} onClick={() => setMode("gold")} accent="yellow">
                  <Coin /> {t("hunt.route.priorityGold")}
                </ToggleButton>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">VIP</span>
              <ToggleButton active={vip} onClick={() => setVip((v) => !v)} accent="cyan">
                <Diamond size={14} /> {t("hunt.vip")}
              </ToggleButton>
            </div>
          </div>

          <button
            type="button"
            onClick={calc}
            disabled={!canCalc || computing}
            className="btn self-start disabled:opacity-40 lg:self-auto"
            style={{ background: "var(--cyan)", color: "#06131a" }}
          >
            {computing ? `${t("hunt.route.calcing")}...` : `${t("hunt.route.calc")} ›`}
          </button>
        </div>
      </div>

      {computing ? (
        <div className="card"><LoadingBall label={t("hunt.route.calcing")} /></div>
      ) : !result ? (
        <div className="card p-10 text-center text-text-dim">{canCalc ? t("hunt.route.hitCalc") : t("hunt.route.pick")}</div>
      ) : result.length === 0 ? (
        <div className="card p-10 text-center text-text-dim">{t("hunt.route.empty")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {result.map((step) => {
            const e = step.enemy;
            const est = step.est;
            return (
              <div key={`${step.from}-${e.pokeId}`} className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <span className="pixel text-[0.62rem] text-cyan lg:w-24 lg:shrink-0">{t("hunt.route.band", { a: step.from, b: step.to })}</span>

                <div className="flex flex-1 items-center gap-3 border-t border-border/50 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{t("hunt.route.hunt")}</span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                    <Sprite src={spriteUrl(e.pokeId)} alt={e.name} size={34} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-text">{e.name}</span>
                      <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{e.areas.map(area).join(", ")} · lvl {e.huntLevel}</span>
                    </span>
                    <TypeBadges t1={e.t1} t2={e.t2} />
                  </span>
                </div>

                <div className="flex items-center gap-2 lg:w-32 lg:shrink-0" title={t("hunt.effHint")}>
                  <span className="chip inline-flex items-center gap-1" style={{ background: TYPE_COLOR[est.moveName], color: "#fff" }}>
                    <TypeIcon type={est.moveName} size={11} /> {typeLabel(est.moveName)}
                  </span>
                  <span className={`pixel text-[0.7rem] ${est.eff >= 2 ? "text-green" : est.eff > 1 ? "text-cyan" : "text-text-dim"}`}>{effLabel(est.eff)}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-border/50 pt-3 text-right lg:w-56 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("hunt.col.kosh")}</span>
                    <span className="tabular-nums text-sm font-bold text-cyan">{compact(est.kosH)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[0.5rem] uppercase tracking-wide text-text-dim"><StatIcon index={0} size={9} />{t("hunt.col.xph")}</span>
                    <span className="tabular-nums text-sm font-bold text-green">{compact(est.xpH)}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("hunt.col.goldh")}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm font-bold text-yellow"><Coin />{compact(est.goldH)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="mt-1 text-[0.62rem] leading-relaxed text-text-dim">{t("hunt.route.estimate")}</p>
        </div>
      )}
    </div>
  );
}
