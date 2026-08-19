"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { STAT_LABELS, estimateIvs, projectAll } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { StatCompareRow, CMP_SLOT } from "./stat-bar";
import { Star, ChevronRight } from "./icons";
import { Tabs } from "./tabs";
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
// Margem folgada nas bordas pra o hover (glow) nao ultrapassar o container.
const POS = [
  { x: 50, y: 15 },
  { x: 85, y: 44 },
  { x: 76, y: 85 },
  { x: 24, y: 85 },
  { x: 15, y: 44 },
];
const CENTER = { x: 50, y: 52 };
const NODE_W = 148;
const STAR = 760; // tamanho FIXO do container (px) — cards altos precisam de espaco

const numF = (s: string) => parseFloat(String(s).replace(",", "."));
const numI = (s: string) => parseInt(s, 10);

// 2 chevrons (">>") apontando do centro pra cada ponto — cara de estrela.
function chevrons(p: { x: number; y: number }): string[] {
  const dx = p.x - CENTER.x;
  const dy = p.y - CENTER.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const s = 2.2;
  return [0.34, 0.46].map((t) => {
    const mx = CENTER.x + dx * t;
    const my = CENTER.y + dy * t;
    const a = `${mx - s * ux + s * px},${my - s * uy + s * py}`;
    const b = `${mx + s * ux},${my + s * uy}`;
    const c = `${mx - s * ux - s * px},${my - s * uy - s * py}`;
    return `${a} ${b} ${c}`;
  });
}

function StatIn({ label, value, onChange, iconIndex }: { label: string; value: string; onChange: (v: string) => void; iconIndex: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="field-label inline-flex items-center gap-1">
        <StatIcon index={iconIndex} size={14} />{label}
      </span>
      <input className="input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const IV_MAX = 32;
const ivColor = (v: number) => (v > IV_MAX ? "text-red" : v >= 26 ? "text-green" : v >= 14 ? "text-yellow" : "text-red");

// Linha de comparacao vazia: MESMAS larguras/altura da StatCompareRow, valores em
// placeholder — o resultado preenche sem mudar nada de lugar.
function CompareRowEmpty({ label, iconIndex }: { label: string; iconIndex: number }) {
  return (
    <div className="flex items-center gap-2 text-base">
      <span className={`inline-flex ${CMP_SLOT.label} shrink-0 items-center gap-1 text-text-dim`}>
        <StatIcon index={iconIndex} size={16} />{label}
      </span>
      <div className="statbar flex-1" />
      <span className={`slot-empty ${CMP_SLOT.value} shrink-0 text-right tabular-nums`}>—</span>
      <span className={`slot-empty ${CMP_SLOT.iv} shrink-0 text-right tabular-nums`}>—</span>
    </div>
  );
}

// Card no formato do Pokedex (sprite + #id + nome + tipos) + pedra + stats.
// Os stats aparecem SEMPRE (com ??? antes de calcular) pro card nao mudar de tamanho.
// A grade de stats fica SEMPRE em 1 coluna: o card tem 148px fixos na estrela e ~140px
// na grade de 2 colunas de um celular de 360px — duas colunas de stat nao cabem em
// nenhum dos dois. Material .well: ele mora dentro do card de vidro do painel.
function EvoNodeCard({ evo, compact }: { evo: NodeData; compact?: boolean }) {
  const maxIdx = evo.stats ? evo.stats.indexOf(Math.max(...evo.stats)) : -1;
  return (
    <Link href={`/dex/${evo.pokeId}`} className="well well-hover flex flex-col items-center gap-2 p-3 text-center" style={compact ? undefined : { width: NODE_W }}>
      <Sprite src={spriteUrl(evo.pokeId)} alt={evo.name} size={56} />
      <div>
        <div className="text-xs text-text-dim">#{String(evo.pokeId).padStart(3, "0")}</div>
        <div className="text-sm leading-tight">{evo.name}</div>
      </div>
      <TypeBadges t1={evo.t1} t2={evo.t2} />
      {evo.stoneName && (
        <span className="inline-flex flex-wrap items-center justify-center gap-1 text-xs leading-tight text-text-dim">
          {evo.stoneIcon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={evo.stoneIcon} alt="" width={14} height={14} className="[image-rendering:pixelated]" />
          )}
          {evo.stoneName}
        </span>
      )}
      <div className="mt-0.5 grid w-full grid-cols-1 gap-y-0.5 border-t border-border/60 pt-2">
        {STAT_LABELS.map((lb, i) => (
          <div key={lb} className="flex items-center justify-between gap-1 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1 text-text-dim"><StatIcon index={i} size={14} />{lb}</span>
            <span className={`shrink-0 tabular-nums ${evo.stats ? (i === maxIdx ? "text-green" : "text-text") : "text-text-dim"}`}>
              {evo.stats ? evo.stats[i] : "???"}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}

interface Result {
  ivs: number[];
  ivTotal: number;
  target: number;
  eeveeStats: number[];
  nodes: NodeData[];
}

export function EeveeLab({ eevee, evos }: { eevee: { pokeId: number; name: string; t1: PokeType; t2: PokeType | null; bases: number[] }; evos: EvoNode[] }) {
  const t = useT();
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [level, setLevel] = useState("");
  const [quality, setQuality] = useState("1");
  const [target, setTarget] = useState("100");
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<"estrela" | "comparar">("estrela");
  const [selEvo, setSelEvo] = useState<number>(evos[0]?.pokeId ?? 0);

  const lvl = numI(level);
  const qual = Number.isFinite(numF(quality)) && numF(quality) > 0 ? numF(quality) : 1;
  const tgt = Number.isFinite(numI(target)) && numI(target) > 0 ? numI(target) : 100;
  const statVals = stats.map(numF);
  const ready = Number.isFinite(lvl) && lvl > 0 && statVals.every((v) => Number.isFinite(v) && v > 0);

  // Muda qualquer entrada -> some o resultado (obriga recalcular, mantem os ???).
  const statsKey = stats.join(",");
  useEffect(() => { setResult(null); }, [statsKey, level, quality, target]);

  const calc = () => {
    if (!ready) return;
    setComputing(true);
    window.setTimeout(() => {
      const e = estimateIvs(eevee.bases, statVals, lvl, qual);
      const nodes: NodeData[] = evos.map((ev) => ({ ...ev, stats: projectAll(ev.bases, e.ivs, tgt, qual).stats }));
      const eeveeStats = projectAll(eevee.bases, e.ivs, tgt, qual).stats;
      setResult({ ivs: e.ivs, ivTotal: e.total, target: tgt, eeveeStats, nodes });
      setComputing(false);
    }, 500);
  };

  const nodes: NodeData[] = result ? result.nodes : evos;
  const eStats = result?.eeveeStats;
  const eMax = eStats ? eStats.indexOf(Math.max(...eStats)) : -1;
  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));

  // Comparacao da evolucao escolhida: seu (IVs estimados) vs perfeito (IV 32).
  const cmp = useMemo(() => {
    if (!result) return null;
    const evo = evos.find((e) => e.pokeId === selEvo) ?? evos[0];
    if (!evo) return null;
    const seu = projectAll(evo.bases, result.ivs, result.target, qual);
    const perf = projectAll(evo.bases, Array<number>(6).fill(IV_MAX), result.target, qual);
    return { evo, seu, perf };
  }, [result, selEvo, evos, qual]);

  // evolucao escolhida (independe do resultado — o cabecalho do card usa sempre)
  const evoSel = evos.find((e) => e.pokeId === selEvo) ?? evos[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Formulario em cima */}
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("eevee.level")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 54" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("eevee.quality")}</span>
            <input className="input" inputMode="decimal" placeholder="ex: 1,8" value={quality} onChange={(e) => setQuality(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label text-cyan">{t("eevee.targetLevel")}</span>
            <input className="input" inputMode="numeric" placeholder="100" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <span className="field-label">{t("eevee.statsLabel")}</span>
          <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {STAT_LABELS.map((lb, i) => (
              <StatIn key={lb} iconIndex={i} label={lb} value={stats[i]} onChange={(v) => setStat(i, v)} />
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* IVs por stat: slots permanentes — placeholder ate calcular */}
            {/* grade fixa de 3/6 colunas: quando o "—" vira numero a fila nao reflui
                nem muda a altura do bloco (era flex-wrap) */}
            <span className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-text-dim sm:grid-cols-3 lg:grid-cols-6">
              {STAT_LABELS.map((lb, i) => (
                <span key={lb} className="inline-flex min-w-0 items-center gap-1">
                  <StatIcon index={i} size={14} />{lb}{" "}
                  <span className={result ? (result.ivs[i] > IV_MAX ? "text-red" : "text-text") : "slot-empty"}>{result ? result.ivs[i].toFixed(0) : "—"}</span>
                </span>
              ))}
            </span>
            <button
              type="button"
              onClick={calc}
              disabled={!ready || computing}
              className="btn btn-cyan self-start disabled:opacity-40 sm:self-auto"
            >
              {computing ? `${t("eevee.calcing")}...` : <>{t("eevee.calc")} <ChevronRight size={14} /></>}
            </button>
          </div>
          {/* IV total + aproveitamento: bloco fixo, valores em placeholder ate calcular */}
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="field-label">
                {t("eevee.ivTotal")} <span className={`pixel ml-1 text-base ${result ? "text-green" : "slot-empty"}`}>{result ? <>{result.ivTotal.toFixed(0)}<span className="text-text-dim">/192</span></> : "—/192"}</span>
              </span>
              <span className="field-label">
                {t("calc.ivUsage")} <span className={`pixel ml-1 text-base ${result ? "text-cyan" : "slot-empty"}`}>{result ? `${Math.round((result.ivTotal / 192) * 100)}%` : "—"}</span>
              </span>
            </div>
            <div className="statbar">
              <div className="statbar-fill" style={{ width: `${result ? Math.min(100, (result.ivTotal / 192) * 100) : 0}%`, background: "var(--green)" }} />
            </div>
          </div>
          {result && result.ivs.some((v) => v > 32) && (
            <p className="mt-2 text-sm leading-relaxed text-red">{t("eevee.ivOver")}</p>
          )}
          {Number.isFinite(lvl) && lvl > 0 && lvl < 20 && (
            <p className="mt-2 text-sm leading-relaxed text-yellow">{t("calc.lowLevel")}</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-text-dim">{t("eevee.ivNote")}</p>
        </div>
      </div>

      {/* Abas: estrela (projecao) e comparar (seu vs perfeito por evolucao) */}
      <Tabs
        accent="var(--cyan)"
        active={tab}
        onChange={(k) => setTab(k as "estrela" | "comparar")}
        tabs={[
          { key: "estrela", label: t("eevee.tab.star"), icon: <Star size={16} /> },
          { key: "comparar", label: t("eevee.tab.compare"), icon: <StatIcon index={0} size={16} /> },
        ]}
      />

      {tab === "comparar" ? (
        <div className="card p-5">
          <h2 className="section-title mb-1 text-yellow">{t("calc.compare")}</h2>
          {/* dica ou pedido de calculo: um estado por vez no mesmo slot */}
          <p className="mb-3 min-h-[1.35rem] text-sm leading-relaxed text-text-dim">
            {cmp ? t("eevee.compareHint") : t("eevee.compareEmpty")}
          </p>
          <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {evos.map((e) => (
              <button key={e.pokeId} type="button" onClick={() => setSelEvo(e.pokeId)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded border px-2.5 text-base transition ${selEvo === e.pokeId ? "border-[color:var(--cyan)] bg-surface-2 text-cyan" : "border-border text-text-dim hover:text-text"}`}>
                <Sprite src={spriteUrl(e.pokeId)} alt={e.name} size={18} /> {e.name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Seu {evo} — linhas em placeholder ate calcular */}
            <div className="well p-3 sm:p-4" style={{ borderColor: "var(--cyan)" }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="pixel inline-flex min-w-0 items-center gap-1.5 text-sm text-cyan" title={evoSel?.name ?? undefined}>
                  {evoSel && <Sprite src={spriteUrl(evoSel.pokeId)} alt="" size={18} />}
                  <span className="truncate">{t("calc.compareYou", { name: evoSel?.name ?? "—" })}</span>
                </span>
                <span className={`shrink-0 text-sm tabular-nums ${result ? "text-text-dim" : "slot-empty"}`}>{result ? `${result.ivTotal.toFixed(0)}/192 · ${Math.round((result.ivTotal / 192) * 100)}%` : "—/192"}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {STAT_LABELS.map((lb, i) => (
                  cmp && result
                    ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={cmp.seu.stats[i]} max={cmp.perf.stats[i]} iv={result.ivs[i]} ivClass={ivColor(result.ivs[i])} />
                    : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.power")} <span className={`pixel ml-1 text-base ${cmp ? "text-yellow" : "slot-empty"}`}>{cmp ? cmp.seu.power.toLocaleString("pt-BR") : "—"}</span></div>
            </div>
            {/* Perfeito {evo} */}
            <div className="well p-3 sm:p-4" style={{ borderColor: "var(--green)" }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="pixel inline-flex min-w-0 items-center gap-1.5 text-sm text-green">
                  {evoSel && <Sprite src={spriteUrl(evoSel.pokeId)} alt="" size={18} />}
                  <span className="truncate">{t("calc.comparePerfect")}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-text-dim">192/192 · 100%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {STAT_LABELS.map((lb, i) => (
                  cmp
                    ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={cmp.perf.stats[i]} max={cmp.perf.stats[i]} iv={IV_MAX} ivClass="text-green" />
                    : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.power")} <span className={`pixel ml-1 text-base ${cmp ? "text-yellow" : "slot-empty"}`}>{cmp ? cmp.perf.power.toLocaleString("pt-BR") : "—"}</span></div>
            </div>
          </div>
        </div>
      ) : (
      /* Aba Estrela — sempre visivel (stats como ??? ate calcular; o card e o skeleton) */
      <div className="card overflow-x-auto p-4 md:p-8">
        {/* Desktop grande: estrela radial (tamanho fixo; abaixo de lg vai pro grid) */}
        <div className="relative mx-auto hidden lg:block" style={{ width: STAR, height: STAR }}>
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
          <Link href={`/dex/${eevee.pokeId}`} className="well well-hover absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 p-3 text-center ring-1 ring-[color:var(--border-strong)]" style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%`, width: NODE_W }}>
            <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={56} />
            <div>
              <div className="text-xs text-text-dim">#{String(eevee.pokeId).padStart(3, "0")}</div>
              <div className="text-sm leading-tight">{eevee.name}</div>
            </div>
            <TypeBadges t1={eevee.t1} t2={eevee.t2} />
            {/* nivel projetado: slot permanente pro card nao mudar de altura */}
            <span className={`text-xs uppercase tracking-wide ${result ? "text-cyan" : "slot-empty"}`}>{result ? t("eevee.atLevel", { n: result.target }) : "—"}</span>
            <div className="mt-0.5 grid w-full grid-cols-1 gap-y-0.5 border-t border-border/60 pt-2">
              {STAT_LABELS.map((lb, i) => (
                <div key={lb} className="flex items-center justify-between gap-1 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-1 text-text-dim"><StatIcon index={i} size={14} />{lb}</span>
                  <span className={`shrink-0 tabular-nums ${eStats ? (i === eMax ? "text-green" : "text-text") : "text-text-dim"}`}>{eStats ? eStats[i] : "???"}</span>
                </div>
              ))}
            </div>
          </Link>
          {nodes.slice(0, 5).map((evo, i) => (
            <div key={evo.pokeId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%` }}>
              <EvoNodeCard evo={evo} />
            </div>
          ))}
        </div>

        {/* Telas menores: Eevee no topo + grid de 2 colunas (cabe em 360px: ~140px por
            card, com a linha de stat em text-xs) que vira 3 no tablet */}
        <div className="flex flex-col gap-3 lg:hidden">
          <Link href={`/dex/${eevee.pokeId}`} className="well well-hover flex flex-col items-center gap-2 p-3 text-center ring-1 ring-[color:var(--border-strong)]">
            <Sprite src={spriteUrl(eevee.pokeId)} alt={eevee.name} size={48} />
            <div>
              <div className="text-xs text-text-dim">#{String(eevee.pokeId).padStart(3, "0")}</div>
              <div className="text-sm leading-tight">{eevee.name}</div>
            </div>
            <TypeBadges t1={eevee.t1} t2={eevee.t2} />
            <span className={`text-xs uppercase tracking-wide ${result ? "text-cyan" : "slot-empty"}`}>{result ? t("eevee.atLevel", { n: result.target }) : "—"}</span>
            <div className="mt-0.5 grid w-full max-w-[240px] grid-cols-1 gap-y-0.5 border-t border-border/60 pt-2">
              {STAT_LABELS.map((lb, i) => (
                <div key={lb} className="flex items-center justify-between gap-1 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-1 text-text-dim"><StatIcon index={i} size={14} />{lb}</span>
                  <span className={`shrink-0 tabular-nums ${eStats ? (i === eMax ? "text-green" : "text-text") : "text-text-dim"}`}>{eStats ? eStats[i] : "???"}</span>
                </div>
              ))}
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
            {nodes.map((evo) => (
              <EvoNodeCard key={evo.pokeId} evo={evo} compact />
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
