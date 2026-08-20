"use client";

// TIPO DO DIA — "com os pokemons que eu tenho, o que paga mais por hora hoje?".
//
// O jogo premia um tipo por dia (+X% de loot e de XP, so nos pokemons daquele tipo) e o
// painel le isso direto da conta. A lista NAO e "os alvos do tipo premiado": e o ranking
// de ouro/h do catalogo inteiro com o bonus ja aplicado onde ele vale — as vezes o dia
// nao muda quem paga mais, e esconder isso mandaria o Eduardo pro spot errado com cara de
// otimizacao. O `dayUse` de cada linha diz quanto do bonus aquele alvo consegue converter:
// drop que ja nasce perto de 100% de chance nao tem folga, e ali o bonus vira quase nada.
//
// Quem calcula e o servidor (/api/vip/money) — o roster individual so existe la.

import { useCallback, useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { RISK_COLOR, type RiskLevel } from "@/lib/combat";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { Panel } from "./ui/panel";
import { TypeBadges } from "./badges";
import { TypeIcon } from "./type-icon";
import { TypeFilter } from "./type-filter";
import { Coin, Clock, Xp, ChevronRight } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";

export interface MoneyPoke {
  id: string; speciesId: number; name: string; level: number;
  team: boolean; leader: boolean; shiny: boolean;
}

export interface MoneyRow {
  poke: MoneyPoke;
  targetId: number; targetName: string;
  t1: PokeType; t2: PokeType | null;
  slug: string; huntName: string; area: string; huntLevel: number;
  goldH: number; plainGoldH: number; goldPerKill: number;
  kosH: number; xpH: number; eff: number; moveType: PokeType;
  risk: RiskLevel; killsPerLife: number;
  typeDayHits: boolean; dayUse: number;
}

interface MoneyRes {
  live: boolean;
  pokes: number;
  typeDay: { type: PokeType | null; label: string; lootPct: number; xpPct: number; until: number | null } | null;
  applied: PokeType | null;
  source: "game" | "manual" | "off";
  mult: { streak: number; boost: number; day: number; background: number; withDay: number };
  rows: MoneyRow[];
}

const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};
const pct = (f: number) => `${(f * 100).toFixed(f * 100 >= 10 ? 0 : 1).replace(/\.0$/, "")}%`;
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);

/** Quanto falta pro bonus virar, em "3h 12m". Vazio quando ja passou. */
function left(until: number | null, now: number): string {
  if (!until) return "";
  const s = Math.floor((until - now) / 1000);
  if (s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TypeDayPanel({ onHunt }: { onHunt: (row: MoneyRow) => void }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [data, setData] = useState<MoneyRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // "" = o tipo real do dia; um tipo = simulacao; "NONE" = lista sem o bonus
  const [sim, setSim] = useState<PokeType | "">("");
  // relogio proprio so pra contagem regressiva (o resto do painel nao repinta a toa)
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async (type: PokeType | "", refresh = false) => {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      if (type) qs.set("type", type);
      if (refresh) qs.set("refresh", "1");
      const r = await fetch(`/api/vip/money${qs.size ? `?${qs}` : ""}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as (MoneyRes & { error?: string }) | null;
      if (!r.ok || !j) { setErr(j?.error ?? "fail"); setData(null); return; }
      setData(j);
    } catch {
      setErr("fail"); setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(sim); }, [load, sim]);

  const day = data?.typeDay ?? null;
  const applied = data?.applied ?? null;
  const ends = left(day?.until ?? null, now);

  const head = (() => {
    if (loading && !data) return <span className="slot-empty text-base">{t("robo.day.loading")}</span>;
    if (err) return <span className="text-base text-text-dim">{t(err === "not_connected" ? "robo.day.off" : "robo.day.fail")}</span>;
    if (!applied) {
      return <span className="text-base text-text-dim">{day && !day.type ? day.label : t("robo.day.none")}</span>;
    }
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="chip shrink-0" style={{ background: TYPE_COLOR[applied], color: "#fff" }}>
          <TypeIcon type={applied} size={14} /> {typeLabel(applied)}
        </span>
        <span className="pixel text-base text-yellow">
          +{Math.round((data?.mult.day ?? 0) * 100)}% <span className="text-text-dim">{t("robo.day.loot")}</span>
        </span>
        {day && day.xpPct > 0 && data?.source === "game" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-text-dim">
            <Xp size={14} />+{Math.round(day.xpPct * 100)}%
          </span>
        )}
        {ends && data?.source === "game" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-text-dim" title={t("robo.day.endsHint")}>
            <Clock size={14} />{t("robo.day.ends", { t: ends })}
          </span>
        )}
        {data?.source === "manual" && (
          <span className="chip shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{t("robo.day.sim")}</span>
        )}
      </span>
    );
  })();

  return (
    <Panel
      icon={<Coin size={18} />}
      accent="var(--yellow)"
      title={t("robo.day.title")}
      right={
        <button
          type="button"
          onClick={() => void load(sim, true)}
          disabled={loading}
          className="btn btn-ghost btn-sm shrink-0 disabled:opacity-40"
        >
          {t("robo.day.refresh")}
        </button>
      }
    >
      <p className="text-sm leading-relaxed text-text-dim">{t("robo.day.desc")}</p>

      {/* cabecalho do dia: altura fixa pros tres estados (carregando / sem tipo / tipo) */}
      <div className="well flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5">{head}</div>

      {/* simulador: ver a lista como ela ficaria em outro tipo (ou sem bonus nenhum) */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="field-label">{t("robo.day.simLabel")}</span>
          <TypeFilter value={sim} onChange={(v) => setSim(v)} className="w-[13rem]" emptyLabel={t("robo.day.simToday")} />
        </label>
        {data && (
          <span className="pb-2 text-sm text-text-dim" title={t("robo.day.multHint")}>
            {t("robo.day.mult")} <span className="pixel text-base text-cyan">x{data.mult.withDay.toFixed(3)}</span>
            <span className="ml-2">{t("robo.day.multBg", { v: data.mult.background.toFixed(3) })}</span>
          </span>
        )}
      </div>

      {/* lista */}
      {loading && !data ? (
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" />
        </div>
      ) : !data || !data.rows.length ? (
        <div className="well flex min-h-16 items-center justify-center text-center text-base text-text-dim">
          {err ? t("robo.day.fail") : t("robo.day.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data.rows.map((r, i) => {
            const gain = r.plainGoldH > 0 ? r.goldH / r.plainGoldH - 1 : 0;
            return (
              <div
                key={`${r.targetId}-${r.poke.id}`}
                className="well flex min-w-0 flex-col gap-2.5 p-2.5 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="pixel w-6 shrink-0 text-sm text-text-dim">{i + 1}</span>

                {/* ALVO */}
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--surface-2)]">
                    <Sprite src={spriteUrl(r.targetId)} alt={r.targetName} size={34} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-text">{r.targetName}</span>
                      {r.typeDayHits && (
                        <span className="chip shrink-0" style={{ background: "var(--yellow)", color: "#2a2200" }} title={t("robo.day.effHint")}>
                          +{Math.round((data.mult.day ?? 0) * 100)}%
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs uppercase tracking-wide text-text-dim">
                      {r.huntName} · {area(r.area)} · lvl {r.huntLevel}
                    </span>
                    <TypeBadges t1={r.t1} t2={r.t2} />
                  </span>
                </span>

                {/* SEU POKEMON */}
                <span className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
                  <span className="shrink-0 text-xs uppercase tracking-wide text-text-dim">{t("robo.day.with")}</span>
                  <Sprite src={spriteUrl(r.poke.speciesId)} alt={r.poke.name} size={26} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-text">{r.poke.name}</span>
                    <span className="text-xs text-text-dim">
                      Lv{r.poke.level}
                      {!r.poke.team && <span className="ml-1 text-yellow" title={t("robo.day.boxHint")}>· {t("robo.day.box")}</span>}
                    </span>
                  </span>
                </span>

                {/* RENDIMENTO */}
                <span className="grid grid-cols-3 gap-2 text-right sm:w-52 sm:shrink-0">
                  <span className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="truncate text-xs uppercase tracking-wide text-text-dim">{t("robo.day.goldH")}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm text-green"><Coin size={14} />{compact(r.goldH)}</span>
                  </span>
                  <span className="flex min-w-0 flex-col items-end gap-0.5" title={t("robo.day.gainHint")}>
                    <span className="truncate text-xs uppercase tracking-wide text-text-dim">{t("robo.day.gain")}</span>
                    <span className={`tabular-nums text-sm ${gain > 0.001 ? "text-yellow" : "slot-empty"}`}>
                      {gain > 0.001 ? `+${pct(gain)}` : "—"}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col items-end gap-0.5" title={t("robo.day.effHint")}>
                    <span className="truncate text-xs uppercase tracking-wide text-text-dim">{t("robo.day.eff")}</span>
                    <span className={`tabular-nums text-sm ${r.typeDayHits ? (r.dayUse >= 0.8 ? "text-green" : r.dayUse >= 0.4 ? "text-yellow" : "text-red") : "slot-empty"}`}>
                      {r.typeDayHits ? pct(r.dayUse) : "—"}
                    </span>
                  </span>
                </span>

                {/* RISCO + ACAO */}
                <span className="flex shrink-0 items-center justify-between gap-2 sm:w-32 sm:justify-end">
                  <span className="pixel text-sm" style={{ color: RISK_COLOR[r.risk] }} title={t("robo.day.riskHint", { n: r.killsPerLife })}>
                    {t(`hunt.route.${r.risk}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onHunt(r)}
                    className="btn btn-ghost btn-sm shrink-0"
                    title={r.poke.team ? undefined : t("robo.day.boxHint")}
                  >
                    {t("robo.day.hunt")} <ChevronRight size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-sm leading-relaxed text-text-dim">{t("robo.day.note")}</p>
    </Panel>
  );
}
