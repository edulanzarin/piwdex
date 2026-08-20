"use client";

import { useMemo } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import { defensiveDetailed, offensiveDetailed, TYPE_COLOR } from "@/lib/typing";
import {
  nemeses, preys, roleOf, scoredMoves, statStandings, STAT_KEYS,
  type Duel, type MetaEntry, type MetaMon, type MovePool, type StatKey,
} from "@/lib/meta";
import { STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges, TypeBadge } from "./badges";
import { StatIcon } from "./stat-icons";
import { PokemonCombobox } from "./pokemon-combobox";
import { TierBadge, AxisBar, MonCell, fmtDps } from "./meta-badges";
import { useT } from "./locale-provider";

const ACCENT = "var(--pink)";

/** Rotulo do stat na ordem canonica do site (hp, atk, def, spAtk, spDef, speed). */
const statLabel = (k: StatKey): string => STAT_LABELS[STAT_KEYS.indexOf(k)];

export function MetaProfile({
  mons, all, pool, entry, focus, onFocus, table,
}: {
  mons: MetaMon[];
  all: MetaMon[];
  pool: MovePool;
  entry: MetaEntry | null;
  focus: MetaMon | null;
  onFocus: (m: MetaMon | null) => void;
  table: MetaEntry[];
}) {
  const t = useT();
  const combo = useMemo(
    () => [...mons].sort((a, b) => a.name.localeCompare(b.name)),
    [mons],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-4 sm:p-5">
        <label className="flex flex-col gap-1">
          <span className="field-label">{t("meta.pickPokemon")}</span>
          <PokemonCombobox
            creatures={combo}
            value={focus}
            onSelect={onFocus}
            placeholder={t("meta.searchPlaceholder")}
          />
        </label>
      </div>

      {!focus || !entry ? (
        <div className="card p-6 text-center text-sm text-text-dim">{t("meta.profileEmpty")}</div>
      ) : (
        <ProfileBody mon={focus} entry={entry} all={all} pool={pool} table={table} onFocus={onFocus} />
      )}
    </div>
  );
}

function ProfileBody({
  mon, entry, all, pool, table, onFocus,
}: {
  mon: MetaMon; entry: MetaEntry; all: MetaMon[]; pool: MovePool;
  table: MetaEntry[]; onFocus: (m: MetaMon) => void;
}) {
  const t = useT();
  const standings = useMemo(() => statStandings(mon, all), [mon, all]);
  const role = useMemo(() => roleOf(standings), [standings]);
  const moves = useMemo(() => scoredMoves(mon, pool).slice(0, 6), [mon, pool]);
  const nem = useMemo(() => nemeses(mon, all, 6, pool), [mon, all, pool]);
  const prey = useMemo(() => preys(mon, all, 6, pool), [mon, all, pool]);
  const def = useMemo(() => defensiveDetailed(mon.type1, mon.type2), [mon]);
  const off = useMemo(() => offensiveDetailed(mon.type1, mon.type2), [mon]);
  const tierPeers = useMemo(
    () => table.filter((e) => e.tier === entry.tier).length,
    [table, entry.tier],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ---- cartao de identidade ---- */}
      <section className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <Sprite src={spriteUrl(mon.pokeId)} alt={mon.name} size={112} className="shrink-0 self-center" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="pixel text-2xl text-text">{mon.name}</h2>
            <TypeBadges t1={mon.type1} t2={mon.type2} />
            {mon.area === "orre" && <span className="chip" style={{ background: "var(--purple)", color: "#140a26" }}>Orre</span>}
          </div>
          <p className="mt-2 text-sm text-text-dim">
            {t(`meta.role.${role}`)} · {t("meta.huntLevel", { n: mon.huntLevel })}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AxisBar value={entry.offense} color="var(--red)" label={`${t("meta.col.offense")} · ${fmtDps(entry.dps)}`} hint={t("meta.dpsHint")} />
            <AxisBar value={entry.bulk} color="var(--cyan)" label={`${t("meta.col.bulk")} · ${fmtDps(entry.ehp)}`} hint={t("meta.ehpHint")} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2 self-center">
          <TierBadge tier={entry.tier} size="lg" />
          <span className="pixel text-2xl tabular-nums" style={{ color: ACCENT }}>{entry.score.toFixed(1)}</span>
          <span className="text-center text-xs text-text-dim">
            {t("meta.position", { n: entry.position, total: table.length })}
          </span>
          <span className="text-center text-xs text-text-dim">{t("meta.tierPeers", { n: tierPeers })}</span>
        </div>
      </section>

      {/* ---- destaques de stats ---- */}
      <section className="card p-4 sm:p-5">
        <h3 className="pixel text-lg text-text">{t("meta.statsTitle")}</h3>
        <p className="mt-1 text-xs text-text-dim">{t("meta.statsDesc")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_KEYS.map((k, i) => {
            const s = standings[k];
            const pct = s.percentile;
            const color = pct >= 0.85 ? "var(--green)" : pct >= 0.6 ? "var(--cyan)" : pct >= 0.35 ? "var(--yellow)" : "var(--red)";
            return (
              <div key={k} className="well flex items-center gap-3 p-3">
                <StatIcon index={i} size={18} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="field-label">{statLabel(k)}</span>
                    <span className="tabular-nums text-text">{s.value}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                  </div>
                  <p className="mt-1 text-xs text-text-dim">{t("meta.statPercentile", { n: Math.round(pct * 100) })}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- golpes ---- */}
      <section className="card p-4 sm:p-5">
        <h3 className="pixel text-lg text-text">{t("meta.movesTitle")}</h3>
        <p className="mt-1 text-xs text-text-dim">{t("meta.movesDesc")}</p>
        {moves.length === 0 ? (
          <p className="mt-4 text-sm text-text-dim">{t("meta.noMoves")}</p>
        ) : (
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-text-dim">
                <tr>
                  <th className="px-2 py-2">{t("meta.col.move")}</th>
                  <th className="w-28 px-2 py-2">{t("meta.col.type")}</th>
                  <th className="w-20 px-2 py-2 text-right">{t("meta.col.power")}</th>
                  <th className="w-24 px-2 py-2 text-right">{t("meta.col.dps")}</th>
                  <th className="w-20 px-2 py-2 text-right">{t("meta.col.learn")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.attack.name} className="border-t border-border/60">
                    <td className="px-2 py-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-text">{m.attack.name}</span>
                        {m.tm && <span className="chip" style={{ background: "var(--yellow)", color: "#2a2200" }}>TM</span>}
                        {m.stab && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>STAB</span>}
                      </span>
                    </td>
                    <td className="px-2 py-2"><TypeBadge type={m.attack.type} /></td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-dim">{m.attack.power}</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: ACCENT }}>{fmtDps(m.dps)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-dim">{m.attack.learnLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-text-dim">{t("meta.cdNote")}</p>
          </div>
        )}
      </section>

      {/* ---- tipagem ---- */}
      <section className="card p-4 sm:p-5">
        <h3 className="pixel text-lg text-text">{t("meta.typingTitle")}</h3>
        <p className="mt-1 text-xs text-text-dim">{t("meta.typingDesc")}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <TypeGroup title={t("meta.weakTo")} accent="var(--red)" items={def.weak.map((x) => ({ type: x.type, label: x.label }))} empty={t("meta.none")} />
          <TypeGroup title={t("meta.resists")} accent="var(--green)" items={def.resist.map((x) => ({ type: x.type, label: x.label }))} empty={t("meta.none")} />
          <TypeGroup title={t("meta.hitsHard")} accent="var(--yellow)" items={off.map((x) => ({ type: x.type, label: x.label }))} empty={t("meta.none")} />
        </div>
        {def.immune.length > 0 && (
          <p className="mt-3 text-xs text-text-dim">
            {t("meta.immuneTo")}: {def.immune.map((x) => x.type).join(", ")}
          </p>
        )}
        <p className="mt-3 text-xs text-text-dim">{t("meta.ampNote")}</p>
      </section>

      {/* ---- duelos ---- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <DuelList
          title={t("meta.nemesesTitle")} desc={t("meta.nemesesDesc")}
          duels={nem} accent="var(--red)" side="theirs" onFocus={onFocus} empty={t("meta.nemesesEmpty")}
        />
        <DuelList
          title={t("meta.preysTitle")} desc={t("meta.preysDesc")}
          duels={prey} accent="var(--green)" side="mine" onFocus={onFocus} empty={t("meta.preysEmpty")}
        />
      </div>

      <p className="text-center text-xs text-text-dim">
        <Link href={`/dex/${mon.pokeId}`} className="underline decoration-dotted hover:text-cyan">
          {t("meta.openDex", { name: mon.name })}
        </Link>
      </p>
    </div>
  );
}

function TypeGroup({
  title, accent, items, empty,
}: {
  title: string; accent: string; items: { type: string; label: string }[]; empty: string;
}) {
  return (
    <div className="well p-3">
      <p className="field-label" style={{ color: accent }}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-text-dim">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((x) => (
            <li key={x.type} className="flex items-center gap-1">
              <TypeBadge type={x.type} />
              <span className="text-xs tabular-nums" style={{ color: TYPE_COLOR[x.type as keyof typeof TYPE_COLOR] }}>{x.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nemesis e presa saem do MESMO duelo, mudando so o lado que a coluna mostra. */
function DuelList({
  title, desc, duels, accent, side, onFocus, empty,
}: {
  title: string; desc: string; duels: Duel[]; accent: string;
  side: "mine" | "theirs"; onFocus: (m: MetaMon) => void; empty: string;
}) {
  const t = useT();
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="pixel text-lg" style={{ color: accent }}>{title}</h3>
      <p className="mt-1 text-xs text-text-dim">{desc}</p>
      {duels.length === 0 ? (
        <p className="mt-4 text-sm text-text-dim">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {duels.map((d) => {
            const m = d[side];
            return (
              <li key={d.other.pokeId} className="well flex min-w-0 items-center gap-3 p-2.5">
                <MonCell mon={d.other} onOpen={onFocus} />
                <span className="ml-auto flex shrink-0 items-center gap-3 text-xs">
                  <span className="flex flex-col items-end">
                    <span className="text-text-dim">{m.move?.name ?? "—"}</span>
                    {m.move && <TypeBadge type={m.move.type} icon={false} />}
                  </span>
                  <span className="tabular-nums" style={{ color: accent }} title={t("meta.effHint")}>
                    {m.eff.toFixed(2)}x
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
