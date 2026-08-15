"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { STAT_LABELS, projectAll } from "@/lib/stats";
import {
  type BreedMode,
  type BreedMon,
  checkCompat,
  expectedGain,
  ivTotal,
  IV_MAX,
  IV_MAX_TOTAL,
  planQuality,
  projectEgg,
  round3,
} from "@/lib/breeding";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";

// Espécie com stats base — precisamos das bases pra projetar os stats reais do ovo.
export interface BreedCreature extends ComboCreature {
  bases: number[];
}

const STORE_KEY = "piwdex.breed.v1";

const q3 = (n: number) => n.toFixed(3);
const numInt = (s: string) => {
  const v = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(v) ? v : NaN;
};
const numDec = (s: string) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};
const clampIv = (v: number) => Math.max(0, Math.min(IV_MAX, Math.round(v)));
const ivColor = (v: number) => (v >= 26 ? "text-green" : v >= 14 ? "text-yellow" : "text-red");

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadSaved(): BreedMon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const arr = raw ? (JSON.parse(raw) as BreedMon[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Estrela Shiny pixel.
function ShinyStar({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }} aria-hidden="true">
      {["....##....", "....##....", "...####...", ".########.", "..######..", ".########.", "..##..##..", ".##....##."].map((r, y) =>
        [...r].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y + 1} width={1} height={1} /> : null)),
      )}
    </svg>
  );
}

// ---- rascunho editável de um dos pais ----
interface Draft {
  species: BreedCreature | null;
  name: string;
  quality: string;
  ivs: string[];
  shiny: boolean;
}
const emptyDraft = (): Draft => ({ species: null, name: "", quality: "", ivs: ["", "", "", "", "", ""], shiny: false });

function draftToMon(d: Draft, id: string): BreedMon | null {
  const qual = numDec(d.quality);
  const ivVals = d.ivs.map(numInt);
  if (!d.species || !Number.isFinite(qual) || qual <= 0 || !ivVals.every((v) => Number.isFinite(v) && v >= 0)) return null;
  return {
    id,
    pokeId: d.species.pokeId,
    name: d.name.trim() || d.species.name,
    species: d.species.name,
    type1: d.species.type1,
    type2: d.species.type2,
    quality: round3(qual),
    ivs: ivVals.map(clampIv),
    shiny: d.shiny,
    createdAt: Date.now(),
  };
}
function monToDraft(m: BreedMon, creatures: BreedCreature[]): Draft {
  return {
    species: creatures.find((c) => c.pokeId === m.pokeId) ?? null,
    name: m.name === m.species ? "" : m.name,
    quality: q3(m.quality),
    ivs: m.ivs.map(String),
    shiny: m.shiny,
  };
}

// ---------- Painel de um dos pais ----------
function ParentPanel({
  label,
  accent,
  creatures,
  draft,
  onChange,
  onSave,
  onClear,
}: {
  label: string;
  accent: string;
  creatures: BreedCreature[];
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setIv = (i: number, v: string) => set({ ivs: draft.ivs.map((s, j) => (j === i ? v : s)) });
  const ivVals = draft.ivs.map(numInt);
  const total = ivVals.every((v) => Number.isFinite(v)) ? ivVals.map(clampIv).reduce((a, b) => a + b, 0) : null;
  const complete = draftToMon(draft, "x") != null;

  return (
    <div className="card flex flex-col gap-3 p-4" style={{ borderColor: draft.species ? accent : undefined }}>
      <div className="flex items-center justify-between">
        <span className="pixel text-[0.62rem]" style={{ color: accent }}>{label}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onSave} disabled={!complete} className="rounded border border-border px-2 py-1 text-[0.52rem] uppercase tracking-wide text-text-dim transition enabled:hover:border-[color:var(--green)] enabled:hover:text-green disabled:opacity-30">{t("breed.form.save")}</button>
          <button type="button" onClick={onClear} className="rounded border border-border px-2 py-1 text-[0.52rem] uppercase tracking-wide text-text-dim transition hover:border-[color:var(--red)] hover:text-red">{t("breed.form.clear")}</button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={draft.species ? spriteUrl(draft.species.pokeId, draft.shiny) : null} alt={draft.species?.name ?? ""} size={52} />
          {draft.shiny && draft.species && <span className="absolute right-0.5 top-0.5 text-yellow"><ShinyStar size={11} /></span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PokemonCombobox creatures={creatures} value={draft.species} onSelect={(c) => set({ species: c })} placeholder={t("breed.form.pickSpecies")} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input !py-1.5 text-sm" value={draft.name} placeholder={draft.species?.name ?? t("breed.form.name")} onChange={(e) => set({ name: e.target.value })} />
            <input className="input !py-1.5 text-sm" inputMode="decimal" value={draft.quality} placeholder={t("breed.form.quality")} onChange={(e) => set({ quality: e.target.value })} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.form.ivs")}</span>
          {total != null && <span className="text-[0.55rem] text-text-dim">{t("breed.ivLabel")} <span className="pixel text-[0.62rem] text-green">{total}</span>/{IV_MAX_TOTAL}</span>}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {STAT_LABELS.map((lb, i) => (
            <label key={lb} className="flex flex-col items-center gap-0.5" title={lb}>
              <StatIcon index={i} size={10} />
              <input className="input !px-1 !py-1 text-center text-[0.72rem]" inputMode="numeric" value={draft.ivs[i]} placeholder="0" onChange={(e) => setIv(i, e.target.value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[0.68rem] text-text-dim">
          <input type="checkbox" checked={draft.shiny} onChange={(e) => set({ shiny: e.target.checked })} className="h-3.5 w-3.5 accent-[color:var(--yellow)]" />
          <span className="inline-flex items-center gap-1"><span className="text-yellow"><ShinyStar size={10} /></span>{t("breed.form.shiny")}</span>
        </label>
        {draft.species && <TypeBadges t1={draft.species.type1} t2={draft.species.type2} />}
      </div>
    </div>
  );
}

// ---------- Barra de distribuição de Quality ----------
function OutcomeBars({ outcomes }: { outcomes: { gain: number; prob: number; quality: number; capped: boolean }[] }) {
  const t = useT();
  const maxProb = Math.max(...outcomes.map((o) => o.prob));
  return (
    <div className="flex flex-col gap-1.5">
      {outcomes.map((o) => (
        <div key={o.gain} className="flex items-center gap-2.5 text-[0.66rem]">
          <span className="w-14 shrink-0 pixel text-[0.58rem] text-green">+{o.gain.toFixed(3)}</span>
          <div className="statbar h-2.5 flex-1">
            <div className="statbar-fill" style={{ width: `${(o.prob / maxProb) * 100}%`, background: "var(--cyan)" }} />
          </div>
          <span className="w-9 shrink-0 text-right tabular-nums text-text-dim">{(o.prob * 100).toFixed(0)}%</span>
          <span className="w-24 shrink-0 text-right tabular-nums">
            <span className="text-text">Q {q3(o.quality)}</span>
            {o.capped && <span className="ml-1 text-[0.5rem] text-red">{t("breed.egg.capped")}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BreedTool({ creatures }: { creatures: BreedCreature[] }) {
  const t = useT();
  const [saved, setSaved] = useState<BreedMon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [a, setA] = useState<Draft>(emptyDraft());
  const [b, setB] = useState<Draft>(emptyDraft());
  const [mode, setMode] = useState<BreedMode>("free");
  const [doubleStones, setDoubleStones] = useState(false);
  const [projLevel, setProjLevel] = useState("100");
  const [targetQ, setTargetQ] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => { setSaved(loadSaved()); setLoaded(true); }, []);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved, loaded]);

  const monA = useMemo(() => draftToMon(a, "A"), [a]);
  const monB = useMemo(() => draftToMon(b, "B"), [b]);
  const compat = checkCompat(monA, monB);
  const egg = compat.ok && monA && monB ? projectEgg(monA, monB, mode, doubleStones) : null;

  const speciesBases = monA ? creatures.find((c) => c.pokeId === monA.pokeId)?.bases ?? null : null;
  const level = numInt(projLevel);
  const eggStats = egg && speciesBases && Number.isFinite(level) && level > 0
    ? projectAll(speciesBases, egg.ivs, level, egg.expectedQuality)
    : null;

  // base do planejador = pai de maior Quality entre os preenchidos
  const planBase = useMemo(() => {
    const cands = [monA, monB].filter(Boolean) as BreedMon[];
    if (cands.length === 0) return null;
    return cands.reduce((best, m) => (m.quality > best.quality ? m : best));
  }, [monA, monB]);
  const tgt = numDec(targetQ);
  const plan = planBase && Number.isFinite(tgt) && tgt > 0 ? planQuality(planBase.quality, tgt, planBase.shiny) : null;

  const saveDraft = (d: Draft) => {
    const mon = draftToMon(d, uid());
    if (!mon) return;
    setSaved((prev) => {
      // atualiza se mesma especie+nome+Q, senão adiciona
      const i = prev.findIndex((m) => m.pokeId === mon.pokeId && m.name === mon.name && Math.abs(m.quality - mon.quality) < 1e-9);
      if (i >= 0) { const c = [...prev]; c[i] = { ...mon, id: prev[i].id }; return c; }
      return [mon, ...prev];
    });
  };
  const loadInto = (side: "a" | "b", m: BreedMon) => {
    const d = monToDraft(m, creatures);
    if (side === "a") setA(d); else setB(d);
  };
  const removeSaved = (id: string) => setSaved((prev) => prev.filter((m) => m.id !== id));

  const evFree = expectedGain("free");
  const evPhero = expectedGain("pheromone");

  return (
    <div className="flex flex-col gap-8">
      {/* ---- 1. Os dois pais ---- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="pixel text-[0.8rem] text-green">{t("breed.parents.title")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.parents.desc")}</p>
          </div>
          <button type="button" onClick={() => setRulesOpen((o) => !o)} className="rounded border border-border px-3 py-1.5 pixel text-[0.55rem] uppercase tracking-wide text-text-dim transition hover:border-[color:var(--border-strong)] hover:text-cyan">
            {t("breed.rules.toggle")} {rulesOpen ? "−" : "+"}
          </button>
        </div>

        {rulesOpen && (
          <div className="card grid gap-2.5 p-4 sm:grid-cols-2">
            {["r1", "r2", "r3", "r4", "r5"].map((k) => (
              <p key={k} className="flex gap-2 text-[0.72rem] leading-relaxed text-text-dim">
                <span className="text-cyan">›</span>
                <span>{t(`breed.rules.${k}`)}</span>
              </p>
            ))}
            <p className="text-[0.6rem] italic text-text-dim sm:col-span-2">{t("breed.rules.note")}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <ParentPanel label={t("breed.parentA")} accent="var(--cyan)" creatures={creatures} draft={a} onChange={setA} onSave={() => saveDraft(a)} onClear={() => setA(emptyDraft())} />
          <ParentPanel label={t("breed.parentB")} accent="var(--purple)" creatures={creatures} draft={b} onChange={setB} onSave={() => saveDraft(b)} onClear={() => setB(emptyDraft())} />
        </div>

        {/* coleção salva */}
        {loaded && saved.length > 0 && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="pixel text-[0.58rem] text-text-dim">{t("breed.saved.title")}</span>
              <span className="text-[0.55rem] text-text-dim">{saved.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {saved.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded border border-border bg-[rgba(8,14,28,0.5)] px-2 py-1.5">
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <Sprite src={spriteUrl(m.pokeId, m.shiny)} alt={m.name} size={30} />
                    {m.shiny && <span className="absolute -right-0.5 -top-0.5 text-yellow"><ShinyStar size={8} /></span>}
                  </div>
                  <div className="text-[0.62rem] leading-tight">
                    <div className="max-w-[9rem] truncate font-semibold">{m.name}</div>
                    <div className="text-text-dim">Q{q3(m.quality)} · IV{ivTotal(m.ivs)}</div>
                  </div>
                  <div className="ml-1 flex flex-col gap-0.5">
                    <div className="flex gap-0.5">
                      <button type="button" onClick={() => loadInto("a", m)} className="rounded bg-surface-2 px-1.5 text-[0.5rem] text-cyan transition hover:brightness-125" title={t("breed.saved.toA")}>1</button>
                      <button type="button" onClick={() => loadInto("b", m)} className="rounded bg-surface-2 px-1.5 text-[0.5rem] text-purple transition hover:brightness-125" title={t("breed.saved.toB")}>2</button>
                    </div>
                    <button type="button" onClick={() => removeSaved(m.id)} className="rounded px-1.5 text-[0.5rem] text-text-dim transition hover:text-red" title={t("breed.delete")}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- 2. O ovo (resultado) ---- */}
      <section className="flex flex-col gap-4">
        <h2 className="pixel text-[0.8rem] text-cyan">{t("breed.egg.title")}</h2>

        {/* modo + double stones */}
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          {([["free", t("breed.mode.free"), t("breed.mode.freeDesc"), evFree], ["pheromone", t("breed.mode.pheromone"), t("breed.mode.pheromoneDesc"), evPhero]] as const).map(([m, title, desc, ev]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg border p-3 text-left transition ${mode === m ? "border-[color:var(--cyan)] bg-surface-2" : "border-border hover:border-[color:var(--border-strong)]"}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full border ${mode === m ? "border-cyan bg-cyan" : "border-text-dim"}`} />
                  <span className="pixel text-[0.58rem]">{title}</span>
                </span>
                <span className="text-[0.55rem] text-text-dim">~{ev.toFixed(4)}</span>
              </div>
              <p className="mt-1.5 pl-5 text-[0.62rem] leading-relaxed text-text-dim">{desc}</p>
            </button>
          ))}
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${doubleStones ? "border-[color:var(--yellow)] bg-[rgba(244,210,74,0.06)]" : "border-border hover:border-[color:var(--border-strong)]"}`}>
            <input type="checkbox" checked={doubleStones} onChange={(e) => setDoubleStones(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--yellow)]" />
            <span>
              <span className="pixel text-[0.58rem] text-yellow">{t("breed.double")}</span>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-text-dim">{t("breed.double.desc")}</p>
            </span>
          </label>
        </div>

        {!egg || !monA || !monB ? (
          <div className="card p-6 text-center text-sm text-text-dim">
            {!compat.ok && compat.reasons[0] === "breed.invalid.fill"
              ? t("breed.compat.fill")
              : compat.reasons.map((r) => t(r.replace("invalid", "compat"))).join(" ")}
          </div>
        ) : (
          <div className="card fadein flex flex-col gap-5 p-5">
            {/* topo: ovo + Quality */}
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[color:var(--green)] p-4 sm:min-w-[190px]">
                <div className="relative flex h-24 w-24 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
                  <Sprite src={spriteUrl(monA.pokeId, egg.shinyGuaranteed)} alt={monA.species} size={84} />
                  {egg.shinyGuaranteed && <span className="absolute right-1 top-1 text-yellow"><ShinyStar size={15} /></span>}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">{monA.species}</div>
                  <TypeBadges t1={monA.type1} t2={monA.type2} />
                </div>
                {egg.shinyGuaranteed ? (
                  <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}><ShinyStar size={10} />{t("breed.egg.shinyGuar")}</span>
                ) : egg.spontaneousShinyChance > 0 ? (
                  <span className="text-[0.6rem] text-yellow">{t("breed.egg.shinyChance")}</span>
                ) : (
                  <span className="text-[0.6rem] text-text-dim">{t("breed.egg.normal")}</span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                    <div className="text-[0.52rem] uppercase tracking-wide text-text-dim">{t("breed.egg.range")}</div>
                    <div className="pixel mt-0.5 text-[0.7rem] text-cyan">{q3(egg.minQuality)}–{q3(egg.maxQuality)}</div>
                  </div>
                  <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                    <div className="text-[0.52rem] uppercase tracking-wide text-text-dim">{t("breed.egg.avg")}</div>
                    <div className="pixel mt-0.5 text-[0.7rem] text-yellow">{q3(egg.expectedQuality)}</div>
                  </div>
                  <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                    <div className="text-[0.52rem] uppercase tracking-wide text-text-dim">{t("breed.egg.ivTotal")}</div>
                    <div className="pixel mt-0.5 text-[0.7rem] text-green">{egg.ivTotal}<span className="text-text-dim">/{IV_MAX_TOTAL}</span></div>
                  </div>
                </div>
                {/* IVs herdados */}
                <div>
                  <div className="mb-2 text-[0.58rem] uppercase tracking-wide text-text-dim">{t("breed.egg.inherits", { name: (egg.fromParent === "a" ? monA : monB).name })}</div>
                  <div className="grid grid-cols-6 gap-2">
                    {egg.ivs.map((v, i) => {
                      const boosted = egg.doubleStoneEligible.includes(i);
                      return (
                        <div key={i} className={`flex flex-col items-center rounded border py-1.5 ${boosted ? "border-yellow bg-[rgba(244,210,74,0.06)]" : "border-border bg-[rgba(8,14,28,0.5)]"}`} title={STAT_LABELS[i]}>
                          <StatIcon index={i} size={10} />
                          <span className={`text-[0.64rem] tabular-nums ${ivColor(v)}`}>{v}{boosted ? "+" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                  {egg.doubleStoneEligible.length > 0 && <p className="mt-2 text-[0.6rem] text-text-dim">{t("breed.egg.doubleBoost", { stats: egg.doubleStoneEligible.map((i) => STAT_LABELS[i]).join(", ") })}</p>}
                </div>
              </div>
            </div>

            {/* distribuição de Quality */}
            <div className="border-t border-border pt-4">
              <h4 className="pixel mb-3 text-[0.58rem] text-cyan">{t("breed.egg.roll")}</h4>
              <OutcomeBars outcomes={egg.outcomes} />
              {egg.anyCapped && <p className="mt-2.5 text-[0.62rem] text-red">{t("breed.egg.capWarn")}</p>}
            </div>

            {/* STATS REAIS DO OVO — feature nossa (liga na engine de stats) */}
            <div className="border-t border-border pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="pixel text-[0.58rem] text-green">{t("breed.egg.stats")}</h4>
                <label className="inline-flex items-center gap-2 text-[0.6rem] text-text-dim">
                  {t("breed.egg.level")}
                  <input className="input !w-20 !py-1 text-center text-sm" inputMode="numeric" value={projLevel} onChange={(e) => setProjLevel(e.target.value)} />
                </label>
              </div>
              {eggStats ? (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {STAT_LABELS.map((lb, i) => (
                      <div key={lb} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1 text-[0.5rem] uppercase tracking-wide text-text-dim"><StatIcon index={i} size={9} />{lb}</div>
                        <div className="pixel mt-0.5 text-[0.72rem] text-text">{eggStats.stats[i]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{t("breed.egg.power")}</span>
                    <span className="pixel text-[0.8rem] text-yellow">{eggStats.power.toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-2 text-[0.6rem] text-text-dim">{t("breed.egg.statsHint")}</p>
                </>
              ) : (
                <p className="text-[0.68rem] text-text-dim">{t("breed.egg.statsNeedLevel")}</p>
              )}
            </div>

            {/* custo de um breed */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-[0.66rem]">
              <span className="text-text-dim">{t("breed.egg.cost")}:</span>
              <span className="text-text-dim">{t("breed.egg.money")} <span className="pixel text-[0.68rem] text-yellow">R$ {egg.cost.money.toLocaleString("pt-BR")}</span></span>
              <span className="text-text-dim">{t("breed.egg.stones")} <span className="pixel text-[0.68rem] text-cyan">{egg.cost.stones}</span>{egg.cost.types === 2 ? <span className="text-text-dim"> ({egg.cost.stonesPerType}+{egg.cost.stonesPerType})</span> : null}</span>
              {egg.cost.pheromones > 0 && <span className="text-text-dim">{t("breed.egg.pheromones")} <span className="pixel text-[0.68rem] text-purple">{egg.cost.pheromones}</span></span>}
            </div>
          </div>
        )}
      </section>

      {/* ---- 3. Planejador de Quality (feature nossa) ---- */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="pixel text-[0.8rem] text-purple">{t("breed.plan.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.plan.desc")}</p>
        </div>
        <div className="card flex flex-col gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2.5">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.plan.base")}</div>
              {planBase ? (
                <div className="mt-0.5 flex items-center gap-2">
                  <Sprite src={spriteUrl(planBase.pokeId, planBase.shiny)} alt="" size={22} />
                  <span className="pixel text-[0.72rem] text-cyan">{q3(planBase.quality)}</span>
                  <span className="truncate text-[0.6rem] text-text-dim">{planBase.name}</span>
                </div>
              ) : (
                <div className="pixel mt-0.5 text-[0.72rem] text-text-dim">—</div>
              )}
              <div className="mt-1 text-[0.55rem] text-text-dim">{t("breed.plan.baseHint")}</div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.plan.target")}</span>
              <input className="input" inputMode="decimal" value={targetQ} placeholder="ex: 2.200" onChange={(e) => setTargetQ(e.target.value)} />
            </label>
          </div>

          {!plan ? (
            <p className="text-[0.68rem] text-text-dim">{t("breed.plan.needParent")}</p>
          ) : plan.reached ? (
            <p className="text-[0.72rem] text-green">{t("breed.plan.reached")}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[plan.free, plan.pheromone].map((line) => {
                  const isFree = line.mode === "free";
                  const color = isFree ? "var(--cyan)" : "var(--purple)";
                  return (
                    <div key={line.mode} className="rounded-lg border p-4" style={{ borderColor: color }}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="pixel text-[0.6rem]" style={{ color }}>{isFree ? t("breed.mode.free") : t("breed.mode.pheromone")}</span>
                        <span className="text-[0.55rem] text-text-dim">{t("breed.plan.perStep")} +{line.maxStepGain.toFixed(3)}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="pixel text-lg" style={{ color }}>{line.breeds}</span>
                        <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.plan.breeds")}</span>
                      </div>
                      <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-[0.64rem] text-text-dim">
                        <span>{t("breed.plan.money")} <span className="pixel text-[0.66rem] text-yellow">R$ {line.money.toLocaleString("pt-BR")}</span></span>
                        <span>{t("breed.egg.stones")} <span className="pixel text-[0.66rem] text-cyan">{line.stones.toLocaleString("pt-BR")}</span></span>
                        {line.pheromones > 0 && <span>{t("breed.egg.pheromones")} <span className="pixel text-[0.66rem] text-purple">{line.pheromones.toLocaleString("pt-BR")}</span></span>}
                      </div>
                      {(line.orphanRisk || line.capWaste) && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          {line.orphanRisk && <p className="rounded border-l-2 border-yellow bg-[rgba(244,210,74,0.06)] px-2 py-1.5 text-[0.6rem] leading-relaxed text-text-dim">{t("breed.plan.orphan")}</p>}
                          {line.capWaste && <p className="rounded border-l-2 border-red bg-[rgba(255,90,90,0.06)] px-2 py-1.5 text-[0.6rem] leading-relaxed text-text-dim">{t("breed.plan.capWaste")}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {plan.cap != null && plan.effectiveTarget < plan.target - 1e-9 && (
                <p className="text-[0.62rem] text-red">{t("breed.plan.overCap", { cap: q3(plan.cap) })}</p>
              )}
              <p className="text-[0.6rem] italic text-text-dim">{t("breed.plan.estimate")}</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
