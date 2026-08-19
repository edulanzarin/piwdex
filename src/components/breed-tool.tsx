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
  tiersFor,
} from "@/lib/breeding";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { Star, Plus, Minus, Close, ChevronRight } from "./icons";
import { StatTile } from "./stat-tile";
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
        <span className="pixel text-sm" style={{ color: accent }}>{label}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onSave} disabled={!complete} className="btn btn-ghost btn-sm disabled:opacity-30">{t("breed.form.save")}</button>
          <button type="button" onClick={onClear} className="btn btn-ghost btn-sm">{t("breed.form.clear")}</button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="well relative flex h-16 w-16 shrink-0 items-center justify-center p-0">
          <Sprite src={draft.species ? spriteUrl(draft.species.pokeId, draft.shiny) : null} alt={draft.species?.name ?? ""} size={52} />
          {draft.shiny && draft.species && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={14} /></span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PokemonCombobox creatures={creatures} value={draft.species} onSelect={(c) => set({ species: c })} placeholder={t("breed.form.pickSpecies")} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" value={draft.name} placeholder={draft.species?.name ?? t("breed.form.name")} onChange={(e) => set({ name: e.target.value })} />
            <input className="input" inputMode="decimal" value={draft.quality} placeholder={t("breed.form.quality")} onChange={(e) => set({ quality: e.target.value })} />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="field-label">{t("breed.form.ivs")}</span>
          {/* slot permanente: total incompleto vira placeholder, nao some */}
          <span className="text-xs text-text-dim">
            {t("breed.ivLabel")} <span className={`pixel text-sm ${total != null ? "text-green" : "slot-empty"}`}>{total ?? "—"}</span>/{IV_MAX_TOTAL}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {STAT_LABELS.map((lb, i) => (
            <label key={lb} className="flex flex-col items-center gap-0.5" title={lb}>
              <StatIcon index={i} size={14} />
              <input className="input input-sm text-center" inputMode="numeric" value={draft.ivs[i]} placeholder="0" onChange={(e) => setIv(i, e.target.value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-base text-text-dim">
          <input type="checkbox" checked={draft.shiny} onChange={(e) => set({ shiny: e.target.checked })} className="h-4 w-4 accent-[color:var(--yellow)]" />
          <span className="inline-flex items-center gap-1"><span className="text-yellow"><Star size={16} /></span>{t("breed.form.shiny")}</span>
        </label>
        {/* slot permanente dos tipos: sem especie escolhida fica o placeholder, a
            linha nao muda de altura quando o dado chega */}
        <div className="flex min-h-[1.35rem] items-center justify-end">
          {draft.species ? <TypeBadges t1={draft.species.type1} t2={draft.species.type2} /> : <span className="slot-empty text-sm">—</span>}
        </div>
      </div>
    </div>
  );
}

// ---------- Barra de distribuição de Quality ----------
// quality null = sem ovo ainda: a barra e as probabilidades sao constantes do modo,
// entao a linha rende igual e so o Q vira placeholder (mesmas dimensoes).
function OutcomeBars({ outcomes }: { outcomes: { gain: number; prob: number; quality: number | null; capped: boolean }[] }) {
  const t = useT();
  const maxProb = Math.max(...outcomes.map((o) => o.prob));
  return (
    <div className="flex flex-col gap-1.5">
      {outcomes.map((o) => (
        <div key={o.gain} className="flex items-center gap-2 text-base sm:gap-2.5">
          <span className="pixel w-14 shrink-0 text-sm text-green sm:w-16">+{o.gain.toFixed(3)}</span>
          <div className="statbar h-2.5 flex-1">
            <div className="statbar-fill" style={{ width: `${(o.prob / maxProb) * 100}%`, background: "var(--cyan)" }} />
          </div>
          <span className="w-11 shrink-0 text-right tabular-nums text-text-dim">{(o.prob * 100).toFixed(0)}%</span>
          <span className="w-20 shrink-0 text-right tabular-nums sm:w-24">
            {o.quality != null ? (
              <>
                <span className={o.capped ? "text-red" : "text-text"}>Q {q3(o.quality)}</span>
                {o.capped && <span className="ml-1 hidden text-xs text-red sm:inline">{t("breed.egg.capped")}</span>}
              </>
            ) : (
              <span className="slot-empty">Q —</span>
            )}
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

  // por que ainda nao ha ovo (fica invisivel quando o ovo existe, reservando a altura)
  const compatMsg = !compat.ok && compat.reasons[0] !== "breed.invalid.fill"
    ? compat.reasons.map((r) => t(r.replace("invalid", "compat"))).join(" ")
    : t("breed.compat.fill");

  // IVs herdados: sem ovo a grade fica com placeholder no mesmo formato
  const eggIvs: (number | null)[] = egg ? egg.ivs : Array<number | null>(6).fill(null);

  // distribuicao: sem ovo, monta as linhas so com as constantes do modo escolhido
  const outcomeRows = egg
    ? egg.outcomes
    : tiersFor(mode).map((tier) => ({ gain: tier.gain, prob: tier.prob, quality: null, capped: false }));

  // linha de status do planejador: um estado por vez, sempre no mesmo slot
  const planStatus = !plan
    ? { text: t("breed.plan.needParent"), cls: "text-text-dim" }
    : plan.reached
    ? { text: t("breed.plan.reached"), cls: "text-green" }
    : plan.cap != null && plan.effectiveTarget < plan.target - 1e-9
    ? { text: t("breed.plan.overCap", { cap: q3(plan.cap) }), cls: "text-red" }
    : { text: t("breed.plan.estimate"), cls: "italic text-text-dim" };

  return (
    <div className="flex flex-col gap-5">
      {/* ---- 1. Os dois pais ---- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title text-green">{t("breed.parents.title")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.parents.desc")}</p>
          </div>
          <button type="button" onClick={() => setRulesOpen((o) => !o)} className="btn btn-ghost btn-sm">
            {t("breed.rules.toggle")} {rulesOpen ? <Minus size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {rulesOpen && (
          <div className="card grid gap-2.5 p-4 sm:grid-cols-2">
            {["r1", "r2", "r3", "r4", "r5"].map((k) => (
              <p key={k} className="flex gap-2 text-base leading-relaxed text-text-dim">
                <span className="mt-0.5 shrink-0 text-cyan"><ChevronRight size={16} /></span>
                <span>{t(`breed.rules.${k}`)}</span>
              </p>
            ))}
            <p className="text-sm italic text-text-dim sm:col-span-2">{t("breed.rules.note")}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <ParentPanel label={t("breed.parentA")} accent="var(--cyan)" creatures={creatures} draft={a} onChange={setA} onSave={() => saveDraft(a)} onClear={() => setA(emptyDraft())} />
          <ParentPanel label={t("breed.parentB")} accent="var(--purple)" creatures={creatures} draft={b} onChange={setB} onSave={() => saveDraft(b)} onClear={() => setB(emptyDraft())} />
        </div>

        {/* colecao salva: card sempre presente; sem itens o trilho mostra placeholder */}
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="pixel text-sm text-text-dim">{t("breed.saved.title")}</span>
            <span className="text-xs tabular-nums text-text-dim">{saved.length}</span>
          </div>
          {/* trilho rolavel de altura fixa: chips nao quebram linha nem mudam a altura */}
          <div className="flex min-h-[3.4rem] flex-nowrap items-center gap-2 overflow-x-auto">
            {loaded && saved.length > 0 ? (
              saved.map((m) => (
                <div key={m.id} className="well flex shrink-0 items-center gap-2 px-2 py-1">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <Sprite src={spriteUrl(m.pokeId, m.shiny)} alt={m.name} size={30} />
                    {m.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={14} /></span>}
                  </div>
                  <div className="min-w-0 text-sm leading-tight">
                    <div className="max-w-[7rem] truncate" title={m.name}>{m.name}</div>
                    <div className="text-text-dim">Q{q3(m.quality)} · IV{ivTotal(m.ivs)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => loadInto("a", m)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-sm text-cyan transition hover:brightness-125" title={t("breed.saved.toA")}>1</button>
                    <button type="button" onClick={() => loadInto("b", m)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-sm text-purple transition hover:brightness-125" title={t("breed.saved.toB")}>2</button>
                    <button type="button" onClick={() => removeSaved(m.id)} className="icon-btn h-10 w-10 shrink-0 hover:text-red" title={t("breed.delete")}><Close size={16} /></button>
                  </div>
                </div>
              ))
            ) : (
              <span className="slot-empty text-sm">—</span>
            )}
          </div>
        </div>
      </section>

      {/* ---- 2. O ovo (resultado) ---- */}
      <section className="flex flex-col gap-4">
        <h2 className="section-title text-cyan">{t("breed.egg.title")}</h2>

        {/* modo + double stones */}
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          {([["free", t("breed.mode.free"), t("breed.mode.freeDesc"), evFree], ["pheromone", t("breed.mode.pheromone"), t("breed.mode.pheromoneDesc"), evPhero]] as const).map(([m, title, desc, ev]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`card p-3 text-left transition ${mode === m ? "border-[color:var(--cyan)] bg-surface-2" : "border-border hover:border-[color:var(--border-strong)]"}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full border ${mode === m ? "border-cyan bg-cyan" : "border-text-dim"}`} />
                  <span className="pixel text-sm">{title}</span>
                </span>
                <span className="text-xs text-text-dim">~{ev.toFixed(4)}</span>
              </div>
              <p className="mt-1.5 pl-5 text-sm leading-relaxed text-text-dim">{desc}</p>
            </button>
          ))}
          <label className={`card flex cursor-pointer items-start gap-2 p-3 transition ${doubleStones ? "border-[color:var(--yellow)] bg-[color:var(--yellow)]/10" : "border-border hover:border-[color:var(--border-strong)]"}`}>
            <input type="checkbox" checked={doubleStones} onChange={(e) => setDoubleStones(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--yellow)]" />
            <span>
              <span className="pixel text-sm text-yellow">{t("breed.double")}</span>
              <p className="mt-1 text-sm leading-relaxed text-text-dim">{t("breed.double.desc")}</p>
            </span>
          </label>
        </div>

        {/* card do ovo SEMPRE renderizado: sem ovo cada slot vira placeholder — o
            resultado preenche os mesmos lugares, nada empurra o formulario */}
        <div className="card flex flex-col gap-5 p-5">
          {/* motivo de nao haver ovo: invisivel quando o ovo existe (altura reservada) */}
          <p className={`text-sm text-text-dim ${egg ? "invisible" : ""}`}>{compatMsg}</p>

          {/* topo: ovo + Quality */}
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <div className="well flex flex-col items-center justify-center gap-2 p-4 lg:min-w-[190px]" style={{ borderColor: egg ? "var(--green)" : undefined }}>
              <div className="relative flex h-24 w-24 items-center justify-center rounded border border-border bg-[var(--well-bg)]">
                <Sprite src={monA ? spriteUrl(monA.pokeId, egg?.shinyGuaranteed ?? false) : null} alt={monA?.species ?? ""} size={84} />
                {egg?.shinyGuaranteed && <span className="absolute right-1 top-1 text-yellow"><Star size={16} /></span>}
              </div>
              <div className="text-center">
                <div className={`text-sm ${monA ? "" : "slot-empty"}`}>{monA ? monA.species : "—"}</div>
                <div className="flex min-h-[1.35rem] items-center justify-center">
                  {monA ? <TypeBadges t1={monA.type1} t2={monA.type2} /> : <span className="slot-empty text-sm">—</span>}
                </div>
              </div>
              {/* selo de shiny: um estado por vez, sempre no mesmo slot */}
              <span className="flex h-7 items-center">
                {egg?.shinyGuaranteed ? (
                  <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}><Star size={14} />{t("breed.egg.shinyGuar")}</span>
                ) : egg && egg.spontaneousShinyChance > 0 ? (
                  <span className="text-sm text-yellow">{t("breed.egg.shinyChance")}</span>
                ) : (
                  <span className={`text-sm ${egg ? "text-text-dim" : "slot-empty"}`}>{egg ? t("breed.egg.normal") : "—"}</span>
                )}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label={t("breed.egg.range")} accent="var(--cyan)" value={egg ? <>{q3(egg.minQuality)}–{q3(egg.maxQuality)}</> : <span className="slot-empty">—</span>} />
                <StatTile label={t("breed.egg.avg")} accent="var(--yellow)" value={egg ? q3(egg.expectedQuality) : <span className="slot-empty">—</span>} />
                <StatTile label={t("breed.egg.ivTotal")} accent="var(--green)" value={egg ? <>{egg.ivTotal}<span className="text-text-dim">/{IV_MAX_TOTAL}</span></> : <span className="slot-empty">—/{IV_MAX_TOTAL}</span>} />
              </div>
              {/* IVs herdados */}
              <div>
                <div className="field-label mb-2">{t("breed.egg.inherits", { name: egg ? (egg.fromParent === "a" ? monA! : monB!).name : "—" })}</div>
                <div className="grid grid-cols-6 gap-1 sm:gap-2">
                  {eggIvs.map((v, i) => {
                    const boosted = egg?.doubleStoneEligible.includes(i) ?? false;
                    return (
                      <div key={i} className={`well flex flex-col items-center px-0.5 py-1.5 ${boosted ? "border-yellow bg-[color:var(--yellow)]/10" : ""}`} title={STAT_LABELS[i]}>
                        <StatIcon index={i} size={14} />
                        <span className={`text-sm tabular-nums ${v != null ? ivColor(v) : "slot-empty"}`}>{v != null ? `${v}${boosted ? "+" : ""}` : "—"}</span>
                      </div>
                    );
                  })}
                </div>
                {/* nota do Double Stones: aparece pela escolha do usuario; valor em slot */}
                {doubleStones && (
                  <p className={`mt-2 text-sm ${egg && egg.doubleStoneEligible.length > 0 ? "text-text-dim" : "slot-empty"}`}>
                    {egg && egg.doubleStoneEligible.length > 0 ? t("breed.egg.doubleBoost", { stats: egg.doubleStoneEligible.map((i) => STAT_LABELS[i]).join(", ") }) : "—"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* distribuição de Quality */}
          <div className="border-t border-border pt-4">
            <h4 className="pixel mb-3 text-sm text-cyan">{t("breed.egg.roll")}</h4>
            <OutcomeBars outcomes={outcomeRows} />
            <p className={`mt-2.5 text-sm ${egg?.anyCapped ? "text-red" : "slot-empty"}`}>{egg?.anyCapped ? t("breed.egg.capWarn") : "—"}</p>
          </div>

          {/* STATS REAIS DO OVO — feature nossa (liga na engine de stats) */}
          <div className="border-t border-border pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="pixel text-sm text-green">{t("breed.egg.stats")}</h4>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-text-dim">
                {t("breed.egg.level")}
                <input className="input input-sm w-20 text-center" inputMode="numeric" value={projLevel} onChange={(e) => setProjLevel(e.target.value)} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STAT_LABELS.map((lb, i) => (
                <div key={lb} className="well px-1.5 text-center sm:px-3">
                  <div className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-text-dim"><StatIcon index={i} size={14} />{lb}</div>
                  <div className={`pixel mt-0.5 text-base ${eggStats ? "text-text" : "slot-empty"}`}>{eggStats ? eggStats.stats[i] : "—"}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide text-text-dim">{t("breed.egg.power")}</span>
              <span className={`pixel text-base ${eggStats ? "text-yellow" : "slot-empty"}`}>{eggStats ? eggStats.power.toLocaleString("pt-BR") : "—"}</span>
            </div>
            <p className="mt-2 text-sm text-text-dim">{egg && !eggStats ? t("breed.egg.statsNeedLevel") : t("breed.egg.statsHint")}</p>
          </div>

          {/* custo de um breed: tres tiles fixos (o de Pheromones fica em placeholder
              no modo Free) — valor grande nao reflui a linha nem muda a altura */}
          <div className="border-t border-border pt-4">
            <div className="field-label mb-2">{t("breed.egg.cost")}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <StatTile label={t("breed.egg.money")} accent="var(--yellow)" value={egg ? `R$ ${egg.cost.money.toLocaleString("pt-BR")}` : undefined} />
              <StatTile
                label={t("breed.egg.stones")}
                accent="var(--cyan)"
                value={egg ? <>{egg.cost.stones}{egg.cost.types === 2 ? <span className="text-sm text-text-dim"> ({egg.cost.stonesPerType}+{egg.cost.stonesPerType})</span> : null}</> : undefined}
              />
              <StatTile label={t("breed.egg.pheromones")} accent="var(--purple)" value={egg && mode === "pheromone" ? egg.cost.pheromones : undefined} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- 3. Planejador de Quality (feature nossa) ---- */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="section-title text-purple">{t("breed.plan.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.plan.desc")}</p>
        </div>
        <div className="card flex flex-col gap-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="well">
              <div className="field-label">{t("breed.plan.base")}</div>
              {planBase ? (
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  <Sprite src={spriteUrl(planBase.pokeId, planBase.shiny)} alt="" size={22} />
                  <span className="pixel shrink-0 text-base text-cyan">{q3(planBase.quality)}</span>
                  <span className="truncate text-sm text-text-dim" title={planBase.name}>{planBase.name}</span>
                </div>
              ) : (
                <div className="pixel mt-0.5 text-base slot-empty">—</div>
              )}
              <div className="mt-1 text-xs text-text-dim">{t("breed.plan.baseHint")}</div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="field-label">{t("breed.plan.target")}</span>
              <input className="input" inputMode="decimal" value={targetQ} placeholder="ex: 2.200" onChange={(e) => setTargetQ(e.target.value)} />
            </label>
          </div>

          {/* linha de status do plano: um estado por vez, mesmo slot */}
          <p className={`min-h-[1.35rem] text-sm ${planStatus.cls}`}>{planStatus.text}</p>

          {/* os dois modos SEMPRE renderizados: sem plano os numeros viram placeholder */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(["free", "pheromone"] as const).map((m) => {
              const line = plan && !plan.reached ? (m === "free" ? plan.free : plan.pheromone) : null;
              const color = m === "free" ? "var(--cyan)" : "var(--purple)";
              const tiers = tiersFor(m);
              const maxStep = line ? line.maxStepGain : tiers[tiers.length - 1].gain;
              return (
                <div key={m} className="well p-3 sm:p-4" style={{ borderColor: color }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="pixel min-w-0 truncate text-sm" style={{ color }}>{m === "free" ? t("breed.mode.free") : t("breed.mode.pheromone")}</span>
                    <span className="shrink-0 text-xs text-text-dim">{t("breed.plan.perStep")} +{maxStep.toFixed(3)}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`pixel text-lg ${line ? "" : "slot-empty"}`} style={line ? { color } : undefined}>{line ? line.breeds : "—"}</span>
                    <span className="field-label">{t("breed.plan.breeds")}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-sm text-text-dim">
                    <span>{t("breed.plan.money")} <span className={`pixel text-base ${line ? "text-yellow" : "slot-empty"}`}>{line ? `R$ ${line.money.toLocaleString("pt-BR")}` : "—"}</span></span>
                    <span>{t("breed.egg.stones")} <span className={`pixel text-base ${line ? "text-cyan" : "slot-empty"}`}>{line ? line.stones.toLocaleString("pt-BR") : "—"}</span></span>
                    {m === "pheromone" && <span>{t("breed.egg.pheromones")} <span className={`pixel text-base ${line ? "text-purple" : "slot-empty"}`}>{line ? line.pheromones.toLocaleString("pt-BR") : "—"}</span></span>}
                  </div>
                  {/* riscos: sempre renderizados; invisiveis quando nao se aplicam (altura reservada) */}
                  <div className="mt-3 flex flex-col gap-1.5">
                    <p className={`rounded border-l-2 border-yellow bg-[color:var(--yellow)]/10 px-2 py-1.5 text-sm leading-relaxed text-text-dim ${line?.orphanRisk ? "" : "invisible"}`}>{t("breed.plan.orphan")}</p>
                    <p className={`rounded border-l-2 border-red bg-[color:var(--red)]/10 px-2 py-1.5 text-sm leading-relaxed text-text-dim ${line?.capWaste ? "" : "invisible"}`}>{t("breed.plan.capWaste")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
