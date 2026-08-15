"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { estimateIvs, powerOf, projectAll, STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { PokemonCombobox } from "./pokemon-combobox";
import { useT } from "./locale-provider";

const EEVEE_ID = 133;

export interface CalcCreature {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  bases: number[]; // hp, atk, def, spAtk, spDef, speed
}

const num = (s: string): number => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

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

  // Estima IVs a partir dos stats atuais.
  const iv = useMemo(() => {
    if (!baseReady || !statsReady) return null;
    return estimateIvs(creature!.bases, statVals, lvl, qual);
  }, [baseReady, statsReady, creature, statVals, lvl, qual]);

  const currentPower = baseReady && statsReady ? powerOf(statVals, qual) : null;

  // Projecao pro nivel alvo usando os IVs estimados.
  const tgt = num(target);
  const projection = useMemo(() => {
    if (!iv || !creature || !Number.isFinite(tgt) || tgt <= 0) return null;
    return projectAll(creature.bases, iv.ivs, tgt, qual);
  }, [iv, creature, tgt, qual]);

  const isEevee = creature?.pokeId === EEVEE_ID;

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
      </div>

      {/* Resultado: IVs estimados */}
      <div className="card p-5">
        <h2 className="pixel text-[0.72rem] text-green">{t("calc.ivEstimated")}</h2>
        {!baseReady ? (
          <p className="mt-3 text-sm text-text-dim">{t("calc.pickFirst")}</p>
        ) : !iv ? (
          <p className="mt-3 text-sm text-text-dim">{t("calc.fillStats")}</p>
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
            <div className="flex flex-wrap gap-6 border-t border-border pt-3">
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.ivTotal")}</div>
                <div className="pixel text-base text-green">{iv.total.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("calc.power")}</div>
                <div className="pixel text-base text-yellow">{currentPower?.toLocaleString("pt-BR")}</div>
              </div>
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
