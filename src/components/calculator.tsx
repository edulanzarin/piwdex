"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { estimateIvs, powerOf, projectAll, STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { LoadingBall } from "./loaders";
import { Coin } from "./icons";
import { PokemonCombobox } from "./pokemon-combobox";
import { useT } from "./locale-provider";

function MiniBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
      <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

const EEVEE_ID = 133;

export interface CalcCreature {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  bases: number[]; // hp, atk, def, spAtk, spDef, speed
  rarity: string;
  xp: number; // XP por kill
  goldEV: number; // ouro esperado por kill
}

const num = (s: string): number => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

const IV_MAX_TOTAL = 192; // 32 por stat x 6

// Perfil a partir dos stats base (chaves de traducao).
function analyze(bases: number[]) {
  const [hp, atk, def, spa, spd, spe] = bases;
  const roles: string[] = [];
  if (atk >= spa + 12) roles.push("calc.role.phys");
  else if (spa >= atk + 12) roles.push("calc.role.spec");
  else roles.push("calc.role.mixed");
  const bulk = hp + def + spd;
  if (bulk >= 300) roles.push("calc.role.tank");
  else if (bulk <= 210) roles.push("calc.role.frail");
  if (spe >= 105) roles.push("calc.role.fast");
  else if (spe <= 50) roles.push("calc.role.slow");
  const maxI = bases.indexOf(Math.max(...bases));
  const minI = bases.indexOf(Math.min(...bases));
  return { roles, maxI, minI, bst: bases.reduce((a, b) => a + b, 0) };
}

function Field({
  label, value, onChange, placeholder, iconIndex,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; iconIndex?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-wide text-text-dim">
        {iconIndex != null && <StatIcon index={iconIndex} size={12} />}{label}
      </span>
      <input className="input" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Calculator({ creatures }: { creatures: CalcCreature[] }) {
  const t = useT();
  const [creature, setCreature] = useState<CalcCreature | null>(null);
  const [level, setLevel] = useState("");
  const [quality, setQuality] = useState("");
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [target, setTarget] = useState("");

  const lvl = num(level);
  const qual = num(quality);
  const statVals = stats.map(num);
  const statsReady = statVals.every((v) => Number.isFinite(v) && v > 0);
  const baseReady = creature && Number.isFinite(lvl) && lvl > 0 && Number.isFinite(qual) && qual > 0;

  const canCalc = Boolean(baseReady) && statsReady;

  // Resultado (IVs + poder) so aparece ao clicar Calcular.
  const [computing, setComputing] = useState(false);
  const [res, setRes] = useState<{ ivs: number[]; total: number; power: number } | null>(null);
  const statsKey = stats.join(",");
  useEffect(() => { setRes(null); }, [statsKey, level, quality, creature?.pokeId]);

  const calc = () => {
    if (!canCalc || !creature) return;
    setComputing(true);
    window.setTimeout(() => {
      const e = estimateIvs(creature.bases, statVals, lvl, qual);
      setRes({ ivs: e.ivs, total: e.total, power: powerOf(statVals, qual) });
      setComputing(false);
    }, 400);
  };

  const iv = res ? { ivs: res.ivs, total: res.total } : null;
  const currentPower = res?.power ?? null;

  // Projecao pro nivel alvo, reativa a partir dos IVs ja calculados.
  const tgt = num(target);
  const projection = useMemo(() => {
    if (!res || !creature || !Number.isFinite(tgt) || tgt <= 0) return null;
    return projectAll(creature.bases, res.ivs, tgt, qual);
  }, [res, creature, tgt, qual]);

  const isEevee = creature?.pokeId === EEVEE_ID;
  const profile = creature ? analyze(creature.bases) : null;

  const setStat = (i: number, v: string) =>
    setStats((prev) => prev.map((s, j) => (j === i ? v : s)));

  return (
    <div className="flex flex-col gap-5">
      {/* Selecao + nivel + qualidade */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
              <Sprite src={creature ? spriteUrl(creature.pokeId) : null} alt={creature?.name ?? ""} size={80} />
            </div>
            {creature && <TypeBadges t1={creature.type1} t2={creature.type2} />}
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.pokemon")}</span>
              <PokemonCombobox creatures={creatures} value={creature} onSelect={setCreature} />
            </label>
            <Field label={t("calc.level")} value={level} onChange={setLevel} placeholder="ex: 58" />
            <Field label={t("calc.quality")} value={quality} onChange={setQuality} placeholder="ex: 1,8" />
          </div>
        </div>
      </div>

      {isEevee ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <p className="max-w-sm text-sm text-text-dim">{t("calc.eeveeHint")}</p>
          <Link href="/eevee" className="btn" style={{ background: "var(--cyan)", color: "#06131a" }}>
            {t("eevee.open")} ›
          </Link>
        </div>
      ) : (
      <>{/* resto da calculadora so quando nao for Eevee */}

      {/* Perfil / analise a partir do base */}
      {creature && profile && (
        <div className="card p-5">
          <h2 className="pixel mb-3 text-[0.72rem] text-yellow">{t("calc.profile")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {profile.roles.map((r) => (
              <span key={r} className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{t(r)}</span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniBox label={t("calc.strongStat")} value={<span className="inline-flex items-center gap-1 text-green"><StatIcon index={profile.maxI} size={12} />{STAT_LABELS[profile.maxI]}</span>} />
            <MiniBox label={t("calc.weakStat")} value={<span className="inline-flex items-center gap-1 text-red"><StatIcon index={profile.minI} size={12} />{STAT_LABELS[profile.minI]}</span>} />
            <MiniBox label={t("calc.xpKill")} value={<span className="text-cyan">{creature.xp.toLocaleString("pt-BR")}</span>} />
            <MiniBox label={t("calc.goldKill")} value={<span className="inline-flex items-center gap-1 text-yellow"><Coin />{creature.goldEV.toLocaleString("pt-BR")}</span>} />
          </div>
          <p className="mt-3 text-[0.62rem] text-text-dim">{t("calc.bst")} <span className="pixel ml-1 text-[0.7rem] text-cyan">{profile.bst}</span></p>
        </div>
      )}

      {/* Stats atuais */}
      <div className="card p-5">
        <h2 className="pixel mb-3 text-[0.72rem] text-cyan">{t("calc.currentStats")}</h2>
        <p className="mb-4 text-sm text-text-dim">
          {t("calc.currentHint")}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_LABELS.map((label, i) => (
            <Field key={label} iconIndex={i} label={label} value={stats[i]} onChange={(v) => setStat(i, v)} />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[0.62rem] leading-relaxed text-text-dim">{t("calc.ivExplain")}</p>
          <button
            type="button"
            onClick={calc}
            disabled={!canCalc || computing}
            className="btn shrink-0 self-start disabled:opacity-40 sm:self-auto"
            style={{ background: "var(--cyan)", color: "#06131a" }}
          >
            {computing ? `${t("calc.calcing")}...` : `${t("calc.calcBtn")} ›`}
          </button>
        </div>
      </div>

      {/* Resultado: IVs estimados */}
      <div className="card p-5">
        <h2 className="pixel text-[0.72rem] text-green">{t("calc.ivEstimated")}</h2>
        {computing ? (
          <LoadingBall label={t("calc.calcing")} />
        ) : !res || !iv ? (
          <p className="mt-3 text-sm text-text-dim">{canCalc ? t("calc.hitCalc") : t("calc.fillStats")}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STAT_LABELS.map((label, i) => (
                <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                  <div className="inline-flex items-center gap-1 text-[0.58rem] uppercase tracking-wide text-text-dim"><StatIcon index={i} size={11} />{label}</div>
                  <div className="tabular-nums text-lg font-bold text-text">{iv.ivs[i].toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.ivTotal")}</div>
                  <div className="pixel text-base text-green">{iv.total.toFixed(0)}<span className="text-text-dim">/{IV_MAX_TOTAL}</span></div>
                </div>
                <div>
                  <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.ivUsage")}</div>
                  <div className="pixel text-base text-cyan">{Math.round((iv.total / IV_MAX_TOTAL) * 100)}%</div>
                </div>
                <div>
                  <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.power")}</div>
                  <div className="pixel text-base text-yellow">{currentPower?.toLocaleString("pt-BR")}</div>
                </div>
              </div>
              {/* barra de aproveitamento */}
              <div className="statbar">
                <div className="statbar-fill" style={{ width: `${Math.min(100, (iv.total / IV_MAX_TOTAL) * 100)}%`, background: "var(--green)" }} />
              </div>
              <p className="text-[0.62rem] text-text-dim">{t("calc.ivMaxNote")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Projecao */}
      <div className="card p-5">
        <h2 className="pixel text-[0.72rem] text-cyan">{t("calc.project")}</h2>
        <p className="mb-4 mt-2 text-sm text-text-dim">
          {t("calc.projectHint")}
        </p>
        <div className="max-w-[10rem]">
          <Field label={t("calc.targetLevel")} value={target} onChange={setTarget} placeholder="ex: 100" />
        </div>
        {projection && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STAT_LABELS.map((label, i) => (
                <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                  <div className="inline-flex items-center gap-1 text-[0.58rem] uppercase tracking-wide text-text-dim"><StatIcon index={i} size={11} />{label}</div>
                  <div className="tabular-nums text-lg font-bold text-cyan">{projection.stats[i]}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.powerAt", { n: tgt })}</span>
              <div className="pixel text-base text-yellow">{projection.power.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
