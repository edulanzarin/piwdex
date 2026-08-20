"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import {
  metaTable, playableSet, TIERS, tierFloor,
  type MetaEntry, type MetaMon, type MovePool, type Tier,
} from "@/lib/meta";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { Tabs } from "./tabs";
import { TypeFilter } from "./type-filter";
import { TierBadge, AxisBar, MonCell, fmtDps } from "./meta-badges";
import { MetaProfile } from "./meta-profile";
import { MetaTypes } from "./meta-types";
import { MetaStadium } from "./meta-stadium";
import { useT } from "./locale-provider";

type View = "tiers" | "rankings" | "profile" | "types" | "stadium";

const ACCENT = "var(--pink)";

export function MetaTool({ mons }: { mons: MetaMon[] }) {
  const t = useT();
  const [view, setView] = useState<View>("tiers");
  const [pool, setPool] = useState<MovePool>("natural");
  const [focus, setFocus] = useState<MetaMon | null>(null);

  const playable = useMemo(() => playableSet(mons), [mons]);
  const table = useMemo(() => metaTable(mons, pool), [mons, pool]);
  const byId = useMemo(() => new Map(table.map((e) => [e.creature.pokeId, e])), [table]);

  // Abrir o perfil de alguem e o gesto mais comum da ferramenta: qualquer linha de
  // qualquer aba chama isto e a aba troca junto, em vez de mandar o usuario voltar
  // no topo e procurar o nome de novo.
  const openProfile = (m: MetaMon) => { setFocus(m); setView("profile"); };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Tabs
        active={view}
        onChange={(k) => setView(k as View)}
        accent={ACCENT}
        tabs={[
          { key: "tiers", label: t("meta.tab.tiers") },
          { key: "rankings", label: t("meta.tab.rankings") },
          { key: "profile", label: t("meta.tab.profile") },
          { key: "types", label: t("meta.tab.types") },
          { key: "stadium", label: t("meta.tab.stadium") },
        ]}
      />

      {/* O pool vale pra ferramenta inteira: trocar de aba nao pode mudar em silencio
          o que conta como golpe disponivel. */}
      {view !== "types" && <PoolSwitch pool={pool} onChange={setPool} />}

      {view === "tiers" && <TierList table={table} pool={pool} onOpen={openProfile} />}
      {view === "rankings" && <Rankings table={table} onOpen={openProfile} />}
      {view === "profile" && (
        <MetaProfile
          mons={playable} all={mons} pool={pool} entry={focus ? byId.get(focus.pokeId) ?? null : null}
          focus={focus} onFocus={setFocus} table={table}
        />
      )}
      {view === "types" && <MetaTypes mons={mons} onOpen={openProfile} />}
      {view === "stadium" && <MetaStadium mons={playable} pool={pool} />}
    </div>
  );
}

/** Natural x com TM. Nao e detalhe de configuracao: todo golpe de poder 600 do jogo e
 *  TM, entao o pool troca o ranking inteiro — por isso fica visivel e explicado, e nao
 *  escondido num menu. */
function PoolSwitch({ pool, onChange }: { pool: MovePool; onChange: (p: MovePool) => void }) {
  const t = useT();
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="field-label">{t("meta.pool")}</p>
        <p className="mt-1 text-xs text-text-dim">{t(pool === "tm" ? "meta.pool.tmHint" : "meta.pool.naturalHint")}</p>
      </div>
      <div className="flex shrink-0 rounded border border-border p-1">
        {(["natural", "tm"] as MovePool[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
              pool === p ? "text-[color:var(--bg)]" : "text-text-dim hover:text-text"
            }`}
            style={pool === p ? { background: ACCENT } : undefined}
          >
            {t(p === "tm" ? "meta.pool.tm" : "meta.pool.natural")}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Filtros compartilhados por tier list e rankings. */
function useFilters(table: MetaEntry[]) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<PokeType | "">("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return table.filter((e) => {
      if (needle && !e.creature.name.toLowerCase().includes(needle)) return false;
      if (type && e.creature.type1 !== type && e.creature.type2 !== type) return false;
      return true;
    });
  }, [table, q, type]);
  return { q, setQ, type, setType, filtered };
}

function FilterBar({
  q, setQ, type, setType, children,
}: {
  q: string; setQ: (v: string) => void;
  type: PokeType | ""; setType: (v: PokeType | "") => void;
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="field-label">{t("meta.search")}</span>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("meta.searchPlaceholder")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label">{t("meta.type")}</span>
        <TypeFilter value={type} onChange={setType} />
      </label>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ tier list

function TierList({ table, pool, onOpen }: { table: MetaEntry[]; pool: MovePool; onOpen: (m: MetaMon) => void }) {
  const t = useT();
  const { q, setQ, type, setType, filtered } = useFilters(table);
  const [only, setOnly] = useState<Tier[]>([]);

  const shown = only.length ? filtered.filter((e) => only.includes(e.tier)) : filtered;
  const groups = TIERS.map((tier) => ({ tier, rows: shown.filter((e) => e.tier === tier) }))
    .filter((g) => g.rows.length > 0);

  const toggle = (tier: Tier) =>
    setOnly((cur) => (cur.includes(tier) ? cur.filter((x) => x !== tier) : [...cur, tier]));

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-4 sm:p-5">
        <FilterBar q={q} setQ={setQ} type={type} setType={setType}>
          <div className="flex flex-col gap-1">
            <span className="field-label">{t("meta.tierFilter")}</span>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => toggle(tier)}
                  className={`transition ${only.length && !only.includes(tier) ? "opacity-35" : ""}`}
                  title={t("meta.tierFloor", { n: tierFloor(tier, pool) })}
                >
                  <TierBadge tier={tier} />
                </button>
              ))}
            </div>
          </div>
        </FilterBar>
        <p className="text-xs leading-relaxed text-text-dim">{t("meta.tierNote")}</p>
      </div>

      {groups.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-dim">{t("meta.empty")}</div>
      ) : (
        groups.map(({ tier, rows }) => (
          <section key={tier} className="card p-4 sm:p-5">
            <header className="flex flex-wrap items-center gap-3">
              <TierBadge tier={tier} size="lg" />
              <div className="min-w-0">
                <p className="pixel text-lg text-text">{t(`meta.tier.${tier}`)}</p>
                <p className="text-xs text-text-dim">
                  {t("meta.tierCount", { n: rows.length })} · {t("meta.tierFloor", { n: tierFloor(tier, pool) })}
                </p>
              </div>
            </header>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((e) => (
                <button
                  key={e.creature.pokeId}
                  type="button"
                  onClick={() => onOpen(e.creature)}
                  className="well well-hover flex min-w-0 items-center gap-3 p-2.5 text-left"
                >
                  <Sprite src={spriteUrl(e.creature.pokeId)} alt={e.creature.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-text">{e.creature.name}</span>
                      <span className="pixel shrink-0 tabular-nums" style={{ color: ACCENT }}>{e.score.toFixed(1)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <TypeBadges t1={e.creature.type1} t2={e.creature.type2} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

// ------------------------------------------------------------------ rankings

type SortKey = "score" | "offense" | "bulk" | "power";

function Rankings({ table, onOpen }: { table: MetaEntry[]; onOpen: (m: MetaMon) => void }) {
  const t = useT();
  const { q, setQ, type, setType, filtered } = useFilters(table);
  const [sort, setSort] = useState<SortKey>("score");
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => {
    const key = (e: MetaEntry) =>
      sort === "offense" ? e.offense : sort === "bulk" ? e.bulk : sort === "power" ? e.basePower : e.score;
    return [...filtered].sort((a, b) => key(b) - key(a) || a.creature.name.localeCompare(b.creature.name));
  }, [filtered, sort]);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "score", label: t("meta.sort.score") },
    { key: "offense", label: t("meta.sort.offense") },
    { key: "bulk", label: t("meta.sort.bulk") },
    { key: "power", label: t("meta.sort.power") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-4 sm:p-5">
        <FilterBar q={q} setQ={setQ} type={type} setType={setType}>
          <div className="flex flex-col gap-1">
            <span className="field-label">{t("meta.sortBy")}</span>
            <div className="flex flex-wrap rounded border border-border p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                    sort === s.key ? "text-[color:var(--bg)]" : "text-text-dim hover:text-text"
                  }`}
                  style={sort === s.key ? { background: ACCENT } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </FilterBar>
        <p className="text-xs leading-relaxed text-text-dim">{t("meta.rankNote")}</p>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-[color:var(--surface-solid)] text-left text-text-dim">
              <tr>
                <th className="w-14 px-3 py-2.5 text-right">#</th>
                <th className="px-3 py-2.5">{t("meta.col.pokemon")}</th>
                <th className="w-24 px-3 py-2.5">{t("meta.col.tier")}</th>
                <th className="w-28 px-3 py-2.5 text-right">{t("meta.col.score")}</th>
                <th className="w-40 px-3 py-2.5">{t("meta.col.offense")}</th>
                <th className="w-40 px-3 py-2.5">{t("meta.col.bulk")}</th>
                <th className="w-32 px-3 py-2.5 text-right">{t("meta.col.bestMove")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((e, i) => (
                <tr key={e.creature.pokeId} className="border-t border-border/60">
                  <td className="px-3 py-2 text-right tabular-nums text-text-dim">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <MonCell mon={e.creature} onOpen={onOpen} />
                      <span className="hidden shrink-0 sm:flex">
                        <TypeBadges t1={e.creature.type1} t2={e.creature.type2} />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2"><TierBadge tier={e.tier} size="sm" /></td>
                  <td className="px-3 py-2 text-right">
                    <span className="pixel tabular-nums" style={{ color: ACCENT }}>{e.score.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <AxisBar value={e.offense} color="var(--red)" label={fmtDps(e.dps)} hint={t("meta.dpsHint")} />
                  </td>
                  <td className="px-3 py-2">
                    <AxisBar value={e.bulk} color="var(--cyan)" label={fmtDps(e.ehp)} hint={t("meta.ehpHint")} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.best ? (
                      <span className="inline-flex flex-col items-end gap-0.5">
                        <span className="truncate text-text">{e.best.attack.name}</span>
                        <span className="flex items-center gap-1">
                          {e.best.tm && <span className="chip" style={{ background: "var(--yellow)", color: "#2a2200" }}>TM</span>}
                          {e.best.stab && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>STAB</span>}
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="border-t border-border/60 p-3 text-center">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((n) => n + 50)}>
              {t("meta.loadMore", { n: rows.length - limit })}
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-text-dim">
        <Link href="/dex" className="underline decoration-dotted hover:text-cyan">{t("meta.toDex")}</Link>
      </p>
    </div>
  );
}
