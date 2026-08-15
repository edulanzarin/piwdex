"use client";

import { useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import type { PokeType } from "@/lib/types";
import { estimateIvs, powerOf, projectAll, STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";

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
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{label}</span>
      <input className="input" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Calculator({ creatures }: { creatures: CalcCreature[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [quality, setQuality] = useState("");
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [target, setTarget] = useState("");

  const creature = useMemo(
    () => creatures.find((c) => c.name.toLowerCase() === query.trim().toLowerCase()) ?? null,
    [creatures, query],
  );

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

  const setStat = (i: number, v: string) =>
    setStats((prev) => prev.map((s, j) => (j === i ? v : s)));

  const fillBase = () => {
    if (creature) setStats(creature.bases.map(String));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Selecao + nivel + qualidade */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
            <Sprite src={creature ? spriteUrl(creature.pokeId) : null} alt={creature?.name ?? ""} size={80} />
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 sm:col-span-3">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">Pokemon</span>
              <input
                className="input"
                list="calc-pokes"
                placeholder="Digite e selecione..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <datalist id="calc-pokes">
                {creatures.map((c) => <option key={c.pokeId} value={c.name} />)}
              </datalist>
            </label>
            <Field label="Nivel" value={level} onChange={setLevel} placeholder="ex: 58" />
            <Field label="Qualidade" value={quality} onChange={setQuality} placeholder="ex: 1,8" />
            {creature && (
              <div className="flex items-end gap-1.5 sm:col-span-1">
                {[creature.type1, creature.type2].filter(Boolean).map((t) => (
                  <span key={t} className="chip" style={{ background: TYPE_COLOR[t as PokeType], color: "#fff" }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats atuais */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="pixel text-[0.72rem] text-cyan">Stats atuais no nivel</h2>
          {creature && (
            <button className="btn btn-ghost !py-1.5 !text-[0.55rem]" onClick={fillBase} type="button">
              usar stats base
            </button>
          )}
        </div>
        <p className="mb-4 text-sm text-text-dim">
          Informe os seis stats que o jogo mostra no nivel acima — a calculadora infere os IVs.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_LABELS.map((label, i) => (
            <Field key={label} label={label} value={stats[i]} onChange={(v) => setStat(i, v)} />
          ))}
        </div>
      </div>

      {/* Resultado: IVs estimados */}
      <div className="card p-5">
        <h2 className="pixel text-[0.72rem] text-green">IVs estimados</h2>
        {!baseReady ? (
          <p className="mt-3 text-sm text-text-dim">Escolha o pokemon e informe nivel e qualidade.</p>
        ) : !iv ? (
          <p className="mt-3 text-sm text-text-dim">Preencha os seis stats atuais (maiores que zero).</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STAT_LABELS.map((label, i) => (
                <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                  <div className="text-[0.58rem] uppercase tracking-wide text-text-dim">{label}</div>
                  <div className="tabular-nums text-lg font-bold text-text">{iv.ivs[i].toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6 border-t border-border pt-3">
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">IV Total</div>
                <div className="pixel text-base text-green">{iv.total.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">Poder</div>
                <div className="pixel text-base text-yellow">{currentPower?.toLocaleString("pt-BR")}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Projecao */}
      <div className="card p-5">
        <h2 className="pixel text-[0.72rem] text-cyan">Projetar stats para o nivel</h2>
        <p className="mb-4 mt-2 text-sm text-text-dim">
          Usa os IVs estimados acima pra projetar os stats e o poder em outro nivel.
        </p>
        <div className="max-w-[10rem]">
          <Field label="Nivel alvo" value={target} onChange={setTarget} placeholder="ex: 100" />
        </div>
        {projection && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STAT_LABELS.map((label, i) => (
                <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                  <div className="text-[0.58rem] uppercase tracking-wide text-text-dim">{label}</div>
                  <div className="tabular-nums text-lg font-bold text-cyan">{projection.stats[i]}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">Poder no nivel {tgt}</span>
              <div className="pixel text-base text-yellow">{projection.power.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
