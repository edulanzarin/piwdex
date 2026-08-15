"use client";

import { useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { STAT_LABELS, estimateIvs, projectAll } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { useT } from "./locale-provider";

export interface EvoNode {
  pokeId: number;
  name: string;
  t1: PokeType;
  t2: PokeType | null;
  bases: number[];
  stoneName: string | null;
  stoneIcon: string | null;
}

interface EvoResult extends EvoNode {
  power: number;
  stats: number[];
}

// Posicoes dos 5 pontos da estrela (pentagon, ponta pra cima) em %.
const POS = [
  { x: 50, y: 9 },
  { x: 88, y: 37 },
  { x: 72, y: 85 },
  { x: 28, y: 85 },
  { x: 12, y: 37 },
];

const numF = (s: string) => parseFloat(String(s).replace(",", "."));
const numI = (s: string) => parseInt(s, 10);

function StatIn({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.52rem] uppercase tracking-wide text-text-dim">{label}</span>
      <input className="input !py-1.5 text-sm" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function EvoNodeCard({ evo, compact }: { evo: EvoResult; compact?: boolean }) {
  const maxIdx = evo.stats.indexOf(Math.max(...evo.stats));
  return (
    <div className="card flex flex-col items-center gap-1.5 p-3 text-center" style={compact ? undefined : { width: 168 }}>
      <div className="flex h-14 w-14 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
        <Sprite src={spriteUrl(evo.pokeId)} alt={evo.name} size={48} />
      </div>
      <div className="text-sm text-text">{evo.name}</div>
      <TypeBadges t1={evo.t1} t2={evo.t2} />
      {evo.stoneName && (
        <span className="inline-flex items-center gap-1 text-[0.58rem] text-text-dim">
          {evo.stoneIcon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={evo.stoneIcon} alt="" width={14} height={14} className="[image-rendering:pixelated]" />
          )}
          {evo.stoneName}
        </span>
      )}
      {/* Stats projetados — o maior (o "forte" da evolucao) fica destacado. */}
      <div className="mt-1 grid w-full grid-cols-2 gap-x-3 gap-y-0.5">
        {STAT_LABELS.map((lb, i) => (
          <div key={lb} className="flex justify-between text-[0.56rem]">
            <span className="text-text-dim">{lb}</span>
            <span className={`tabular-nums ${i === maxIdx ? "font-bold text-green" : "text-text"}`}>{evo.stats[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EeveeLab({ eevee, evos }: { eevee: { pokeId: number; name: string; bases: number[] }; evos: EvoNode[] }) {
  const t = useT();
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [level, setLevel] = useState("");
  const [quality, setQuality] = useState("1");
  const [target, setTarget] = useState("100");

  const lvl = numI(level);
  const qual = Number.isFinite(numF(quality)) && numF(quality) > 0 ? numF(quality) : 1;
  const tgt = Number.isFinite(numI(target)) && numI(target) > 0 ? numI(target) : 100;
  const statVals = stats.map(numF);
  const ready = Number.isFinite(lvl) && lvl > 0 && statVals.every((v) => Number.isFinite(v) && v > 0);

  const iv = useMemo(() => (ready ? estimateIvs(eevee.bases, statVals, lvl, qual) : null), [ready, eevee.bases, statVals, lvl, qual]);

  const results = useMemo<{ arr: EvoResult[] } | null>(() => {
    if (!iv) return null;
    const arr = evos.map((e) => {
      const p = projectAll(e.bases, iv.ivs, tgt, qual);
      return { ...e, power: p.power, stats: p.stats };
    });
    return { arr };
  }, [iv, evos, tgt, qual]);

  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));

  return (
    <div className="flex flex-col gap-6">
      {/* Entradas */}
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("eevee.level")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 54" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("eevee.quality")}</span>
            <input className="input" inputMode="decimal" placeholder="ex: 1,8" value={quality} onChange={(e) => setQuality(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-cyan">{t("eevee.targetLevel")}</span>
            <input className="input" inputMode="numeric" placeholder="100" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("eevee.statsLabel")}</span>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {STAT_LABELS.map((lb, i) => (
              <StatIn key={lb} label={lb} value={stats[i]} onChange={(v) => setStat(i, v)} />
            ))}
          </div>
          {iv && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">
                {t("eevee.ivTotal")} <span className="pixel ml-1 text-[0.7rem] text-green">{iv.total.toFixed(1)}</span>
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.58rem] text-text-dim">
                {STAT_LABELS.map((lb, i) => (
                  <span key={lb}>{lb} <span className="text-text">{iv.ivs[i].toFixed(0)}</span></span>
                ))}
              </span>
            </div>
          )}
          <p className="mt-3 text-[0.62rem] leading-relaxed text-text-dim">{t("eevee.ivNote")}</p>
        </div>
      </div>

      {/* Estrela / grid */}
      {!results ? (
        <div className="card p-10 text-center text-text-dim">{t("eevee.fill")}</div>
      ) : (
        <>
          {/* Desktop: estrela radial */}
          <div className="relative mx-auto hidden aspect-square w-full max-w-[600px] sm:block">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
              {POS.map((p, i) => (
                <line key={i} x1={50} y1={50} x2={p.x} y2={p.y} stroke="var(--border-strong)" strokeWidth={0.4} />
              ))}
            </svg>
            {/* Eevee no centro */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="card flex flex-col items-center gap-1 p-3" style={{ width: 130 }}>
                <div className="flex h-16 w-16 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                  <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={54} />
                </div>
                <div className="text-sm text-text">{eevee.name}</div>
                <span className="text-[0.55rem] uppercase tracking-wide text-cyan">{t("eevee.atLevel", { n: tgt })}</span>
              </div>
            </div>
            {results.arr.slice(0, 5).map((evo, i) => (
              <div key={evo.pokeId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}>
                <EvoNodeCard evo={evo} />
              </div>
            ))}
          </div>

          {/* Mobile: grid */}
          <div className="grid grid-cols-2 gap-3 sm:hidden">
            <div className="card col-span-2 flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
                <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={48} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-text">{eevee.name}</span>
                <span className="text-[0.55rem] uppercase tracking-wide text-cyan">{t("eevee.atLevel", { n: tgt })}</span>
              </div>
            </div>
            {results.arr.map((evo) => (
              <EvoNodeCard key={evo.pokeId} evo={evo} compact />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
