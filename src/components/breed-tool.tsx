"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { STAT_LABELS } from "@/lib/stats";
import {
  type BreedMode,
  type BreedMon,
  type EggProjection,
  checkCompat,
  expectedGain,
  FREE_TIERS,
  ivTotal,
  IV_MAX,
  IV_MAX_TOTAL,
  PHEROMONE_TIERS,
  projectEgg,
  round3,
} from "@/lib/breeding";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";

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

function loadMons(): BreedMon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as BreedMon[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ---------- Icone de ovo (pixel) pro selo Shiny e cabecalhos ----------
function ShinyStar({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" style={{ imageRendering: "pixelated" }} aria-hidden="true">
      {["....##....", "....##....", "...####...", ".########.", "..######..", ".########.", "..##..##..", ".##....##."].map((r, y) =>
        [...r].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y + 1} width={1} height={1} /> : null)),
      )}
    </svg>
  );
}

function RuleCard({ badge, badgeColor, title, rules, accent }: { badge: string; badgeColor: string; title: string; rules: string[]; accent: string }) {
  return (
    <div className="card p-4" style={{ borderColor: accent }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="pixel text-[0.62rem]" style={{ color: accent }}>{title}</h3>
        <span className="chip shrink-0" style={{ background: badgeColor, color: "#06111a" }}>{badge}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-2 text-[0.72rem] leading-relaxed text-text-dim">
            <span style={{ color: accent }}>›</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonMini({ mon, size = 28 }: { mon: BreedMon; size?: number }) {
  return <Sprite src={spriteUrl(mon.pokeId, mon.shiny)} alt={mon.name} size={size} />;
}

// ---------- Formulario de criacao/edicao ----------
function CreateForm({
  creatures,
  editing,
  onSave,
  onCancel,
}: {
  creatures: ComboCreature[];
  editing: BreedMon | null;
  onSave: (mon: BreedMon) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const editCreature = editing ? creatures.find((c) => c.pokeId === editing.pokeId) ?? null : null;
  const [species, setSpecies] = useState<ComboCreature | null>(editCreature);
  const [name, setName] = useState(editing?.name ?? "");
  const [quality, setQuality] = useState(editing ? q3(editing.quality) : "");
  const [shiny, setShiny] = useState(editing?.shiny ?? false);
  const [ivs, setIvs] = useState<string[]>(editing ? editing.ivs.map(String) : ["", "", "", "", "", ""]);

  const qual = numDec(quality);
  const ivVals = ivs.map(numInt);
  const ready = Boolean(species) && Number.isFinite(qual) && qual > 0 && ivVals.every((v) => Number.isFinite(v) && v >= 0);

  const setIv = (i: number, v: string) => setIvs((prev) => prev.map((s, j) => (j === i ? v : s)));

  const save = () => {
    if (!ready || !species) return;
    const cleanIvs = ivVals.map(clampIv);
    onSave({
      id: editing?.id ?? uid(),
      pokeId: species.pokeId,
      name: name.trim() || species.name,
      species: species.name,
      type1: species.type1,
      type2: species.type2,
      quality: round3(qual),
      ivs: cleanIvs,
      shiny,
      createdAt: editing?.createdAt ?? Date.now(),
    });
  };

  const total = ivVals.every((v) => Number.isFinite(v)) ? ivVals.map(clampIv).reduce((a, b) => a + b, 0) : null;

  return (
    <div className="card p-5">
      <h3 className="pixel mb-4 text-[0.68rem] text-green">{editing ? t("breed.edit") : t("breed.create")}</h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative flex h-24 w-24 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
            <Sprite src={species ? spriteUrl(species.pokeId, shiny) : null} alt={species?.name ?? ""} size={80} />
            {shiny && <span className="absolute right-1 top-1 text-yellow"><ShinyStar size={13} /></span>}
          </div>
          {species && <TypeBadges t1={species.type1} t2={species.type2} />}
        </div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.form.species")}</span>
            <PokemonCombobox creatures={creatures} value={species} onSelect={setSpecies} placeholder={t("breed.form.pickSpecies")} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.form.name")}</span>
            <input className="input" value={name} placeholder={species?.name ?? ""} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.form.quality")}</span>
            <input className="input" inputMode="decimal" value={quality} placeholder="ex: 1.850" onChange={(e) => setQuality(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.form.ivs")}</span>
          {total != null && (
            <span className="text-[0.6rem] text-text-dim">
              {t("breed.result.ivTotal")} <span className="pixel text-[0.68rem] text-green">{total}</span>
              <span className="text-text-dim">/{IV_MAX_TOTAL}</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {STAT_LABELS.map((lb, i) => (
            <label key={lb} className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-1 text-[0.52rem] uppercase tracking-wide text-text-dim">
                <StatIcon index={i} size={11} />{lb}
              </span>
              <input className="input !py-1.5 text-sm" inputMode="numeric" value={ivs[i]} placeholder="0" onChange={(e) => setIv(i, e.target.value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-dim">
          <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} className="h-4 w-4 accent-[color:var(--yellow)]" />
          <span className="inline-flex items-center gap-1"><span className="text-yellow"><ShinyStar /></span>{t("breed.form.shiny")}</span>
        </label>
        <div className="flex gap-2">
          {editing && (
            <button type="button" onClick={onCancel} className="btn btn-ghost">{t("breed.form.cancel")}</button>
          )}
          <button type="button" onClick={save} disabled={!ready} className="btn btn-green disabled:opacity-40">
            {t("breed.form.save")} ›
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Card de Pokemon na colecao ----------
function MonCard({ mon, onEdit, onDelete }: { mon: BreedMon; onEdit: () => void; onDelete: () => void }) {
  const t = useT();
  const total = ivTotal(mon.ivs);
  return (
    <div className="card flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <MonMini mon={mon} size={48} />
          {mon.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><ShinyStar size={11} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{mon.name}</span>
            {mon.shiny && <span className="text-yellow"><ShinyStar size={10} /></span>}
          </div>
          {mon.name !== mon.species && <div className="truncate text-[0.6rem] text-text-dim">{mon.species}</div>}
          <div className="mt-1"><TypeBadges t1={mon.type1} t2={mon.type2} /></div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[0.62rem]">
        <span className="text-text-dim">{t("breed.qLabel")} <span className="pixel text-[0.68rem] text-cyan">{q3(mon.quality)}</span></span>
        <span className="text-text-dim">{t("breed.ivLabel")} <span className={`pixel text-[0.68rem] ${total >= 150 ? "text-green" : "text-text"}`}>{total}</span><span className="text-text-dim">/{IV_MAX_TOTAL}</span></span>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {mon.ivs.map((v, i) => (
          <div key={i} className="flex flex-col items-center rounded bg-[rgba(8,14,28,0.5)] py-1" title={STAT_LABELS[i]}>
            <StatIcon index={i} size={9} />
            <span className={`text-[0.56rem] tabular-nums ${ivColor(v)}`}>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className="flex-1 rounded border border-border py-1 text-[0.58rem] uppercase tracking-wide text-text-dim transition hover:border-[color:var(--border-strong)] hover:text-cyan">{t("breed.edit")}</button>
        <button type="button" onClick={onDelete} className="flex-1 rounded border border-border py-1 text-[0.58rem] uppercase tracking-wide text-text-dim transition hover:border-[color:var(--red)] hover:text-red">{t("breed.delete")}</button>
      </div>
    </div>
  );
}

// ---------- Slot do simulador ----------
function Slot({ label, mons, value, onChange }: { label: string; mons: BreedMon[]; value: string; onChange: (id: string) => void }) {
  const t = useT();
  const mon = mons.find((m) => m.id === value) ?? null;
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 pixel text-[0.6rem] text-cyan">{label}</div>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("breed.slotPick")}</option>
        {mons.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}{m.name !== m.species ? ` (${m.species})` : ""} · Q{q3(m.quality)} · IV{ivTotal(m.ivs)}{m.shiny ? " · Shiny" : ""}
          </option>
        ))}
      </select>
      <div className="mt-3 rounded border border-dashed border-border p-3">
        {mon ? (
          <div className="flex items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
              <MonMini mon={mon} size={48} />
              {mon.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><ShinyStar size={11} /></span>}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{mon.name}</div>
              <TypeBadges t1={mon.type1} t2={mon.type2} />
              <div className="mt-1 text-[0.6rem] text-text-dim">Q <span className="text-cyan">{q3(mon.quality)}</span> · IV <span className="text-text">{ivTotal(mon.ivs)}</span>/{IV_MAX_TOTAL}</div>
            </div>
          </div>
        ) : (
          <p className="text-center text-[0.68rem] text-text-dim">{t("breed.slotEmpty")}</p>
        )}
      </div>
    </div>
  );
}

export function BreedTool({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  const [mons, setMons] = useState<BreedMon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<BreedMon | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // filtros da colecao
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [shinyFilter, setShinyFilter] = useState<"all" | "shiny" | "normal">("all");
  const [sort, setSort] = useState<"quality" | "iv" | "name">("quality");

  // simulador
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [mode, setMode] = useState<BreedMode>("free");
  const [doubleStones, setDoubleStones] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [egg, setEgg] = useState<EggProjection | null>(null);

  useEffect(() => {
    setMons(loadMons());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(mons));
    } catch {
      /* quota/privado: ignora */
    }
  }, [mons, loaded]);

  const monA = mons.find((m) => m.id === slot1) ?? null;
  const monB = mons.find((m) => m.id === slot2) ?? null;
  const compat = checkCompat(monA, monB);

  // Qualquer mudanca no par -> some o resultado (obriga re-simular).
  useEffect(() => { setEgg(null); }, [slot1, slot2, mode, doubleStones]);

  const simulate = () => {
    if (!compat.ok || !monA || !monB) return;
    setSimulating(true);
    window.setTimeout(() => {
      setEgg(projectEgg(monA, monB, mode, doubleStones));
      setSimulating(false);
    }, 400);
  };

  const upsert = (mon: BreedMon) => {
    setMons((prev) => {
      const i = prev.findIndex((m) => m.id === mon.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = mon;
        return copy;
      }
      return [mon, ...prev];
    });
    setEditing(null);
    setFormOpen(false);
  };

  const remove = (id: string) => {
    setMons((prev) => prev.filter((m) => m.id !== id));
    if (slot1 === id) setSlot1("");
    if (slot2 === id) setSlot2("");
  };

  const speciesList = useMemo(() => {
    const set = new Map<number, string>();
    for (const m of mons) set.set(m.pokeId, m.species);
    return [...set.entries()].map(([pokeId, name]) => ({ pokeId, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [mons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = mons.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.species.toLowerCase().includes(q)) return false;
      if (speciesFilter && String(m.pokeId) !== speciesFilter) return false;
      if (shinyFilter === "shiny" && !m.shiny) return false;
      if (shinyFilter === "normal" && m.shiny) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "quality") return b.quality - a.quality;
      if (sort === "iv") return ivTotal(b.ivs) - ivTotal(a.ivs);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [mons, search, speciesFilter, shinyFilter, sort]);

  const evGain = expectedGain(mode);
  const tiers = mode === "free" ? FREE_TIERS : PHEROMONE_TIERS;

  const RULES_C = [t("breed.rule.c1"), t("breed.rule.c2"), t("breed.rule.c3"), t("breed.rule.c4"), t("breed.rule.c5"), t("breed.rule.c6")];
  const RULES_P = [t("breed.rule.p1"), t("breed.rule.p2"), t("breed.rule.p3")];
  const RULES_F = [t("breed.rule.f1"), t("breed.rule.f2"), t("breed.rule.f3")];

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Tutorial */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="pixel text-[0.8rem] text-yellow">{t("breed.tut.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-text-dim">{t("breed.tut.desc")}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <RuleCard badge={t("breed.confirmed")} badgeColor="var(--green)" title={t("breed.confirmed")} rules={RULES_C} accent="var(--green)" />
          <RuleCard badge={t("breed.provisional")} badgeColor="var(--yellow)" title={t("breed.provisional")} rules={RULES_P} accent="var(--yellow)" />
          <RuleCard badge={t("breed.future")} badgeColor="var(--pink)" title={t("breed.future")} rules={RULES_F} accent="var(--pink)" />
        </div>
        {/* Tabelas de ganho por modo */}
        <div className="grid gap-3 sm:grid-cols-2">
          {([["free", FREE_TIERS], ["pheromone", PHEROMONE_TIERS]] as const).map(([m, ts]) => (
            <div key={m} className="card p-4">
              <h4 className="pixel mb-3 text-[0.6rem] text-cyan">{m === "free" ? t("breed.freeBreeding") : t("breed.strangePheromone")}</h4>
              <div className="grid grid-cols-4 gap-2">
                {ts.map((tier) => (
                  <div key={tier.gain} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-2 py-2 text-center">
                    <div className="pixel text-[0.64rem] text-green">+{tier.gain.toFixed(3)}</div>
                    <div className="mt-0.5 text-[0.56rem] text-text-dim">{(tier.prob * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[0.6rem] text-text-dim">
                {t("breed.expectedGain")}: <span className="pixel text-[0.66rem] text-yellow">{expectedGain(m).toFixed(4)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded border-l-2 border-yellow bg-[rgba(244,210,74,0.06)] px-4 py-3 text-[0.72rem] leading-relaxed text-text-dim">
          {t("breed.recommend")}
        </div>
      </section>

      {/* 2. Colecao */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="pixel text-[0.8rem] text-green">{t("breed.collection.title")}</h2>
            <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.collection.desc")}</p>
          </div>
          {!formOpen && (
            <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="btn btn-green">
              + {t("breed.create")}
            </button>
          )}
        </div>

        {formOpen && (
          <CreateForm
            creatures={creatures}
            editing={editing}
            onSave={upsert}
            onCancel={() => { setEditing(null); setFormOpen(false); }}
          />
        )}

        {/* filtros */}
        {mons.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className="input" placeholder={t("breed.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input" value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}>
              <option value="">{t("breed.filter.allSpecies")}</option>
              {speciesList.map((s) => (
                <option key={s.pokeId} value={s.pokeId}>{s.name}</option>
              ))}
            </select>
            <select className="input" value={shinyFilter} onChange={(e) => setShinyFilter(e.target.value as typeof shinyFilter)}>
              <option value="all">{t("breed.filter.all")}</option>
              <option value="shiny">{t("breed.filter.shinyOnly")}</option>
              <option value="normal">{t("breed.filter.normalOnly")}</option>
            </select>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="quality">{t("breed.sort.quality")}</option>
              <option value="iv">{t("breed.sort.ivTotal")}</option>
              <option value="name">{t("breed.sort.name")}</option>
            </select>
          </div>
        )}

        {!loaded ? null : mons.length === 0 ? (
          <div className="card p-8 text-center text-sm text-text-dim">{t("breed.empty")}</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-text-dim">{t("breed.noMatch")}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MonCard key={m.id} mon={m} onEdit={() => { setEditing(m); setFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} onDelete={() => remove(m.id)} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Simulador */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="pixel text-[0.8rem] text-cyan">{t("breed.sim.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("breed.sim.desc")}</p>
        </div>

        <div className="card flex flex-col gap-5 p-5">
          <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Slot label={t("breed.slot1")} mons={mons} value={slot1} onChange={setSlot1} />
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => { setSlot1(slot2); setSlot2(slot1); }}
                className="btn btn-ghost !px-3"
                aria-label={t("breed.swap")}
                title={t("breed.swap")}
              >
                ⇄
              </button>
            </div>
            <Slot label={t("breed.slot2")} mons={mons} value={slot2} onChange={setSlot2} />
          </div>

          {/* status de compatibilidade */}
          {!compat.ok ? (
            <div className="rounded border-l-2 border-red bg-[rgba(255,90,90,0.06)] px-4 py-3">
              <div className="pixel mb-1 text-[0.6rem] text-red">{t("breed.invalid.title")}</div>
              <ul className="flex flex-col gap-1 text-[0.72rem] text-text-dim">
                {compat.reasons.map((r) => (
                  <li key={r}>› {t(r)}{r === "breed.invalid.quality" ? ` (${q3(compat.qualityDiff)})` : ""}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded border-l-2 border-green bg-[rgba(53,224,142,0.06)] px-4 py-2 text-[0.72rem] text-green">
              {t("breed.valid")} · Δ Q {q3(compat.qualityDiff)}
            </div>
          )}

          {/* modo + double stones */}
          <div className="grid gap-3 md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_auto]">
            {([["free", t("breed.freeBreeding"), t("breed.mode.freeDesc")], ["pheromone", t("breed.strangePheromone"), t("breed.mode.pheromoneDesc")]] as const).map(([m, title, desc]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg border p-3 text-left transition ${mode === m ? "border-[color:var(--cyan)] bg-surface-2" : "border-border hover:border-[color:var(--border-strong)]"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full border ${mode === m ? "border-cyan bg-cyan" : "border-text-dim"}`} />
                  <span className="pixel text-[0.6rem]">{title}</span>
                </div>
                <p className="mt-1.5 pl-5 text-[0.62rem] leading-relaxed text-text-dim">{desc}</p>
              </button>
            ))}
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${doubleStones ? "border-[color:var(--yellow)] bg-[rgba(244,210,74,0.06)]" : "border-border hover:border-[color:var(--border-strong)]"}`}>
              <input type="checkbox" checked={doubleStones} onChange={(e) => setDoubleStones(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--yellow)]" />
              <span>
                <span className="pixel text-[0.6rem] text-yellow">{t("breed.doubleStones")}</span>
                <p className="mt-1 text-[0.62rem] leading-relaxed text-text-dim">{t("breed.doubleStones.desc")}</p>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.6rem] text-text-dim">
              {t("breed.expectedGain")}: <span className="pixel text-[0.66rem] text-yellow">{evGain.toFixed(4)}</span>
            </span>
            <button type="button" onClick={simulate} disabled={!compat.ok || simulating} className="btn btn-cyan disabled:opacity-40">
              {simulating ? `${t("breed.simulating")}...` : `${t("breed.simulate")} ›`}
            </button>
          </div>
        </div>

        {/* resultado */}
        {simulating ? (
          <div className="card p-6"><LoadingBall label={t("breed.simulating")} /></div>
        ) : egg && monA && monB ? (
          <EggResult egg={egg} monA={monA} monB={monB} mode={mode} tiers={tiers} />
        ) : null}
      </section>
    </div>
  );
}

// ---------- Painel de resultado ----------
function EggResult({
  egg,
  monA,
  monB,
  tiers,
}: {
  egg: EggProjection;
  monA: BreedMon;
  monB: BreedMon;
  mode: BreedMode;
  tiers: { gain: number; prob: number }[];
}) {
  const t = useT();
  const parent = egg.fromParent === "a" ? monA : monB;
  const slotLabel = egg.fromParent === "a" ? t("breed.slot1") : t("breed.slot2");
  const maxProb = Math.max(...tiers.map((x) => x.prob));

  return (
    <div className="card fadein flex flex-col gap-5 p-5">
      <h3 className="pixel text-[0.72rem] text-green">{t("breed.result.title")}</h3>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        {/* Ovo */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[color:var(--green)] p-4 sm:min-w-[200px]">
          <div className="relative flex h-24 w-24 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
            <Sprite src={spriteUrl(monA.pokeId, egg.shinyGuaranteed)} alt={monA.species} size={84} />
            {egg.shinyGuaranteed && <span className="absolute right-1 top-1 text-yellow"><ShinyStar size={15} /></span>}
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold">{monA.species}</div>
            <TypeBadges t1={monA.type1} t2={monA.type2} />
          </div>
          {egg.shinyGuaranteed ? (
            <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}><ShinyStar size={10} />{t("breed.result.shinyGuaranteed")}</span>
          ) : egg.spontaneousShinyChance > 0 ? (
            <span className="text-[0.6rem] text-yellow">{t("breed.result.shinyChance")}</span>
          ) : (
            <span className="text-[0.6rem] text-text-dim">{t("breed.result.normal")}</span>
          )}
        </div>

        {/* Quality + heranca */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.qualityRange")}</div>
              <div className="pixel mt-0.5 text-[0.72rem] text-cyan">{q3(egg.minQuality)}–{q3(egg.maxQuality)}</div>
            </div>
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.expected")}</div>
              <div className="pixel mt-0.5 text-[0.72rem] text-yellow">{q3(egg.expectedQuality)}</div>
            </div>
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.ivTotal")}</div>
              <div className="pixel mt-0.5 text-[0.72rem] text-green">{egg.ivTotal}<span className="text-text-dim">/{IV_MAX_TOTAL}</span></div>
            </div>
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.inherits")}</div>
              <div className="pixel mt-0.5 inline-flex items-center gap-1 text-[0.68rem] text-text">{slotLabel}</div>
            </div>
          </div>

          {/* IVs herdados */}
          <div>
            <div className="mb-2 text-[0.6rem] uppercase tracking-wide text-text-dim">{t("breed.result.inheritsFrom", { name: parent.name })}</div>
            <div className="grid grid-cols-6 gap-2">
              {egg.ivs.map((v, i) => {
                const boosted = egg.doubleStoneEligible.includes(i);
                return (
                  <div key={i} className={`flex flex-col items-center rounded border py-1.5 ${boosted ? "border-yellow bg-[rgba(244,210,74,0.06)]" : "border-border bg-[rgba(8,14,28,0.5)]"}`} title={STAT_LABELS[i]}>
                    <StatIcon index={i} size={10} />
                    <span className={`text-[0.66rem] tabular-nums ${ivColor(v)}`}>{v}{boosted ? "+" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Chances de Quality */}
      <div>
        <h4 className="pixel mb-3 text-[0.6rem] text-cyan">{t("breed.result.outcomes")}</h4>
        <div className="flex flex-col gap-2">
          {egg.outcomes.map((o) => (
            <div key={o.gain} className="flex items-center gap-3 text-[0.68rem]">
              <span className="w-16 shrink-0 pixel text-[0.6rem] text-green">+{o.gain.toFixed(3)}</span>
              <div className="statbar h-2.5 flex-1">
                <div className="statbar-fill" style={{ width: `${(o.prob / maxProb) * 100}%`, background: "var(--cyan)" }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-text-dim">{(o.prob * 100).toFixed(0)}%</span>
              <span className="w-24 shrink-0 text-right tabular-nums">
                <span className="text-text">Q {q3(o.quality)}</span>
                {o.capped && <span className="ml-1 text-[0.52rem] text-red">{t("breed.result.capped")}</span>}
              </span>
            </div>
          ))}
        </div>
        {egg.anyCapped && <p className="mt-3 text-[0.62rem] text-red">{t("breed.result.capWarn")}</p>}
      </div>

      {/* Custo */}
      <div className="border-t border-border pt-4">
        <h4 className="pixel mb-3 text-[0.6rem] text-yellow">{t("breed.result.cost")}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
            <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.money")}</div>
            <div className="pixel mt-0.5 text-[0.7rem] text-yellow">R$ {egg.cost.money.toLocaleString("pt-BR")}</div>
          </div>
          <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
            <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.stones")}</div>
            <div className="pixel mt-0.5 text-[0.7rem] text-cyan">{egg.cost.stones}</div>
            {egg.cost.types === 2 && <div className="text-[0.55rem] text-text-dim">{t("breed.result.stonesSplit", { n: egg.cost.stonesPerType, t: egg.cost.types })}</div>}
          </div>
          {egg.cost.pheromones > 0 && (
            <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("breed.result.pheromones")}</div>
              <div className="pixel mt-0.5 text-[0.7rem] text-purple">{egg.cost.pheromones}</div>
            </div>
          )}
        </div>
        {egg.doubleStoneEligible.length > 0 ? (
          <p className="mt-3 text-[0.62rem] text-text-dim">{t("breed.result.doubleStoneNote", { stats: egg.doubleStoneEligible.map((i) => STAT_LABELS[i]).join(", ") })}</p>
        ) : egg.cost.stones === 40 ? (
          <p className="mt-3 text-[0.62rem] text-text-dim">{t("breed.result.doubleStoneNone")}</p>
        ) : null}
        <p className="mt-2 text-[0.62rem] text-text-dim">{t("breed.result.register")}</p>
      </div>
    </div>
  );
}
