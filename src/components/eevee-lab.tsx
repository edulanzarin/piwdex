"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

type NodeData = EvoNode & { stats?: number[] };

// Posicoes dos 5 pontos da estrela (pentagon, ponta pra cima) em %.
const POS = [
  { x: 50, y: 16 },
  { x: 90, y: 44 },
  { x: 73, y: 86 },
  { x: 27, y: 86 },
  { x: 10, y: 44 },
];
const CENTER = { x: 50, y: 52 };

const numF = (s: string) => parseFloat(String(s).replace(",", "."));
const numI = (s: string) => parseInt(s, 10);

// Gera 2 chevrons (">>") apontando do centro pra cada ponto, pra dar cara de estrela.
function chevrons(p: { x: number; y: number }): string[] {
  const dx = p.x - CENTER.x;
  const dy = p.y - CENTER.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const s = 2.2;
  return [0.44, 0.54].map((t) => {
    const mx = CENTER.x + dx * t;
    const my = CENTER.y + dy * t;
    const tipX = mx + s * ux;
    const tipY = my + s * uy;
    const a = `${mx - s * ux + s * px},${my - s * uy + s * py}`;
    const b = `${tipX},${tipY}`;
    const c = `${mx - s * ux - s * px},${my - s * uy - s * py}`;
    return `${a} ${b} ${c}`;
  });
}

function StatIn({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.52rem] uppercase tracking-wide text-text-dim">{label}</span>
      <input className="input !py-1.5 text-sm" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// Mesmo formato do card do Pokedex (sprite + #id + nome + tipos), com os extras
// do lab embaixo (pedra de evolucao e stats projetados).
function EvoNodeCard({ evo, compact }: { evo: NodeData; compact?: boolean }) {
  const maxIdx = evo.stats ? evo.stats.indexOf(Math.max(...evo.stats)) : -1;
  return (
    <Link href={`/dex/${evo.pokeId}`} className="card card-link flex flex-col items-center gap-2 p-3 text-center" style={compact ? undefined : { width: 168 }}>
      <Sprite src={spriteUrl(evo.pokeId)} alt={evo.name} size={56} />
      <div>
        <div className="text-[0.55rem] text-text-dim">#{String(evo.pokeId).padStart(3, "0")}</div>
        <div className="text-sm font-semibold leading-tight">{evo.name}</div>
      </div>
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
      {evo.stats && (
        <div className="mt-0.5 grid w-full grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/60 pt-2">
          {STAT_LABELS.map((lb, i) => (
            <div key={lb} className="flex justify-between text-[0.56rem]">
              <span className="text-text-dim">{lb}</span>
              <span className={`tabular-nums ${i === maxIdx ? "font-bold text-green" : "text-text"}`}>{evo.stats![i]}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

export function EeveeLab({ eevee, evos }: { eevee: { pokeId: number; name: string; t1: PokeType; t2: PokeType | null; bases: number[] }; evos: EvoNode[] }) {
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

  // A estrela existe SEMPRE; os stats projetados entram nos nos quando ha IV.
  const nodes = useMemo<NodeData[]>(
    () => (iv ? evos.map((e) => ({ ...e, stats: projectAll(e.bases, iv.ivs, tgt, qual).stats })) : evos),
    [iv, evos, tgt, qual],
  );

  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));

  return (
    <div className="flex flex-col gap-6">
      {/* A estrela — sempre visivel */}
      <div className="card p-4 sm:p-6">
        {/* Desktop: estrela radial */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-[620px] sm:block">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            {POS.map((p, i) => (
              <g key={i}>
                <line x1={CENTER.x} y1={CENTER.y} x2={p.x} y2={p.y} stroke="var(--border-strong)" strokeWidth={0.35} />
                {chevrons(p).map((pts, k) => (
                  <polyline key={k} points={pts} fill="none" stroke="var(--cyan)" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
                ))}
              </g>
            ))}
          </svg>
          {/* Eevee no centro */}
          <Link href={`/dex/${eevee.pokeId}`} className="card card-link absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 p-3 text-center" style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%`, width: 150 }}>
            <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={60} />
            <div>
              <div className="text-[0.55rem] text-text-dim">#{String(eevee.pokeId).padStart(3, "0")}</div>
              <div className="text-sm font-semibold leading-tight">{eevee.name}</div>
            </div>
            <TypeBadges t1={eevee.t1} t2={eevee.t2} />
            {iv && <span className="text-[0.55rem] uppercase tracking-wide text-cyan">{t("eevee.atLevel", { n: tgt })}</span>}
          </Link>
          {nodes.slice(0, 5).map((evo, i) => (
            <div key={evo.pokeId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}>
              <EvoNodeCard evo={evo} />
            </div>
          ))}
        </div>

        {/* Mobile: Eevee no topo + grid das evolucoes */}
        <div className="flex flex-col gap-3 sm:hidden">
          <Link href={`/dex/${eevee.pokeId}`} className="card card-link flex items-center gap-3 p-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.5)]">
              <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={48} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.55rem] text-text-dim">#{String(eevee.pokeId).padStart(3, "0")} · {eevee.name}</span>
              <TypeBadges t1={eevee.t1} t2={eevee.t2} />
              {iv && <span className="text-[0.55rem] uppercase tracking-wide text-cyan">{t("eevee.atLevel", { n: tgt })}</span>}
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-3">
            {nodes.map((evo) => (
              <EvoNodeCard key={evo.pokeId} evo={evo} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Entradas — preenche pra calcular os stats de cada evolucao */}
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
          {iv ? (
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
          ) : (
            <p className="mt-3 text-[0.62rem] text-text-dim">{t("eevee.fill")}</p>
          )}
          <p className="mt-3 text-[0.62rem] leading-relaxed text-text-dim">{t("eevee.ivNote")}</p>
        </div>
      </div>
    </div>
  );
}
