"use client";

// MELHOR HUNT AGORA — "com os pokemons que eu tenho, o que rende mais por hora hoje?".
//
// Tres decisoes de desenho, todas pagas com erro:
//
//  1. A lista NAO e "os alvos do tipo premiado": e o catalogo inteiro com o bonus do dia
//     aplicado onde ele vale. As vezes o dia nao muda quem paga mais, e filtrar esconderia
//     isso com cara de otimizacao.
//  2. A renda e `loot + venda dos capturados - supply`, nao so loot. Medir so o loot
//     mostrava 23k/h numa hunt que pagava 91k — o loot era 13% da renda.
//  3. Os ajustes (streak, boost, tipo simulado, taxas) ficam RECOLHIDOS no fim. Em cima
//     eles empurravam a resposta pra baixo da dobra, e a resposta e o produto.
//
// Quem calcula e o servidor (/api/vip/money) — o roster individual so existe la.

import { useCallback, useEffect, useRef, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { RISK_COLOR, type RiskLevel } from "@/lib/combat";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { Panel } from "./ui/panel";
import { TypeBadges } from "./badges";
import { TypeIcon } from "./type-icon";
import { TypeFilter } from "./type-filter";
import { ToggleButton } from "./toggle-button";
import { Coin, Clock, Xp, Caret, ChevronRight } from "./icons";
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
  goldH: number; lootH: number; captureH: number; supplyH: number;
  potionH: number; dmgPerKill: number;
  plainGoldH: number; goldPerKill: number;
  kosH: number; xpH: number; plainXpH: number;
  eff: number; moveType: PokeType;
  risk: RiskLevel; killsPerLife: number;
  typeDayHits: boolean; dayUse: number;
  captureRate: number; captureGuessRate: number; captureSample: number;
  goldGuessH: number;
}

interface Style {
  capturePerKill: number; supplyPerKill: number;
  from: "live" | "totals" | "default"; sample: number;
  speedFactor: number; sellShare: number; spots: number; species: number;
  autoCatch: boolean; ballName: string;
  ballCost: number; potion: { heal: number; price: number } | null;
  killSpeed: { dps: number; overhead: number; points: number } | null;
  law: { sample: number; spread: number } | null;
}

interface MoneyRes {
  live: boolean;
  mode: "gold" | "xp";
  pokes: number;
  typeDay: { type: PokeType | null; label: string; lootPct: number; xpPct: number; until: number | null } | null;
  applied: PokeType | null;
  source: "game" | "manual" | "off";
  mult: { streak: number; boost: number; day: number; background: number; withDay: number };
  style: Style;
  catalog: { live: boolean; at: string; error: string | null; checkedAt: number };
  rows: MoneyRow[];
}

const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e6) return sign + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return sign + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return sign + String(Math.round(a));
};
const pct = (f: number) => `${(f * 100).toFixed(f * 100 >= 10 ? 0 : 1).replace(/\.0$/, "")}%`;
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);

function left(until: number | null, now: number): string {
  if (!until) return "";
  const s = Math.floor((until - now) / 1000);
  if (s <= 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Idade do catalogo em texto curto — e o numero que valida a lista inteira. */
function age(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// A grade e UMA so, compartilhada pelo cabecalho e pelas linhas, dentro de um container
// que rola na horizontal. Foi assim que as tres colunas de metrica pararam de se
// sobrepor: antes cada linha tinha a propria grade estreita e os rotulos vazavam.
const COLS = "grid-cols-[2rem_minmax(13rem,1fr)_minmax(8rem,10rem)_7rem_5rem_5rem_5.5rem_5.5rem]";

/** Quantas linhas o painel mostra fechado. Doze empurravam o painel da hunt pra fora da
 *  tela; as tres primeiras ja respondem "pra onde eu vou agora". */
const TOP_N = 3;
const OPEN_KEY = "piwdex-bestcamp-open";

export function TypeDayPanel({ onHunt, huntOn = false }: { onHunt: (row: MoneyRow) => void; huntOn?: boolean }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [data, setData] = useState<MoneyRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"gold" | "xp">("gold");
  const [open, setOpen] = useState(false); // ajustes
  const [all, setAll] = useState(false);   // mostrar as 12 em vez das 3 primeiras

  // Recolher e uma escolha de CONTEXTO: com a hunt rodando voce esta acompanhando, nao
  // escolhendo — o painel comeca fechado e o resumo no cabecalho basta. Sem hunt, ele e a
  // proxima decisao e abre. A escolha manual passa a mandar, e sobrevive a visita.
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(OPEN_KEY);
      if (v === "1" || v === "0") setPanelOpen(v === "1");
    } catch { /* modo privado: fica no padrao por contexto */ }
  }, []);
  const shown = panelOpen ?? !huntOn;
  const togglePanel = (next: boolean) => {
    setPanelOpen(next);
    try { window.localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* sem persistir */ }
  };

  // ajustes: string vazia = "usa o que o jogo disse"
  const [sim, setSim] = useState<PokeType | "">("");
  const [streak, setStreak] = useState("");
  const [boost, setBoost] = useState<boolean | null>(null);
  const [event, setEvent] = useState("");
  const [capture, setCapture] = useState("");
  const [supply, setSupply] = useState("");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      qs.set("mode", mode);
      if (sim) qs.set("type", sim);
      if (streak.trim()) qs.set("streak", streak.trim());
      if (boost != null) qs.set("boost", boost ? "1" : "0");
      if (event.trim()) qs.set("event", event.trim());
      if (capture.trim()) qs.set("capture", capture.trim());
      if (supply.trim()) qs.set("supply", supply.trim());
      if (refresh) qs.set("refresh", "1");
      const r = await fetch(`/api/vip/money?${qs}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as (MoneyRes & { error?: string }) | null;
      if (!r.ok || !j) { setErr(j?.error ?? "fail"); setData(null); return; }
      setData(j);
    } catch {
      setErr("fail"); setData(null);
    } finally { setLoading(false); }
  }, [mode, sim, streak, boost, event, capture, supply]);

  // Ajuste digitado nao dispara request por tecla — espera a pessoa parar.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; void load(); return; }
    const id = window.setTimeout(() => void load(), 400);
    return () => window.clearTimeout(id);
  }, [load]);

  const day = data?.typeDay ?? null;
  const applied = data?.applied ?? null;
  const ends = left(day?.until ?? null, now);
  const isXp = mode === "xp";
  const dirty = !!(sim || streak.trim() || boost != null || event.trim() || capture.trim() || supply.trim());

  const reset = () => { setSim(""); setStreak(""); setBoost(null); setEvent(""); setCapture(""); setSupply(""); };

  // Fechado, o cabecalho tem que continuar respondendo a pergunta — senao recolher vira
  // esconder. O primeiro colocado cabe numa linha.
  const top = data?.rows[0] ?? null;
  const summary = top ? (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-text-dim">
      <span className="text-text-dim">·</span>
      <Sprite src={spriteUrl(top.targetId)} alt={top.targetName} size={20} />
      <span className="truncate text-text">{top.targetName}</span>
      <span className={`pixel tabular-nums ${isXp ? "text-cyan" : "text-green"}`}>
        {compact(isXp ? top.xpH : top.goldH)}/h
      </span>
    </span>
  ) : null;

  const styleNote = (() => {
    const st = data?.style;
    if (!st) return null;
    if (st.from === "default" && !st.capturePerKill && !st.supplyPerKill) return t("robo.day.styleNone");
    const key = st.from === "default" ? "robo.day.styleManual" : "robo.day.styleTotals";
    return t(key, {
      cap: (st.capturePerKill * 100).toFixed(1),
      sup: compact(st.supplyPerKill),
      n: st.sample.toLocaleString("pt-BR"),
    });
  })();

  return (
    <Panel
      icon={<Coin size={18} />}
      accent="var(--yellow)"
      collapsible
      open={shown}
      onOpenChange={togglePanel}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{t("robo.day.title")}</span>
          {!shown && summary}
        </span>
      }
      right={
        <div className="flex shrink-0 items-center gap-1.5">
          <ToggleButton active={!isXp} onClick={() => setMode("gold")} accent="yellow"><Coin size={14} /> $$</ToggleButton>
          <ToggleButton active={isXp} onClick={() => setMode("xp")} accent="green"><Xp size={14} /> XP</ToggleButton>
          <button type="button" onClick={() => void load(true)} disabled={loading} className="btn btn-ghost btn-sm disabled:opacity-40">
            {t("robo.day.refresh")}
          </button>
        </div>
      }
    >
      {/* faixa do dia: tipo premiado + frescor do catalogo, altura fixa nos tres estados */}
      <div className="well flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5">
        {loading && !data ? (
          <span className="slot-empty text-base">{t("robo.day.loading")}</span>
        ) : err ? (
          <span className="text-base text-text-dim">{t(err === "not_connected" ? "robo.day.off" : "robo.day.fail")}</span>
        ) : !applied ? (
          <span className="text-base text-text-dim">{day && !day.type ? day.label : t("robo.day.none")}</span>
        ) : (
          <>
            <span className="chip shrink-0" style={{ background: TYPE_COLOR[applied], color: "#fff" }}>
              <TypeIcon type={applied} size={14} /> {typeLabel(applied)}
            </span>
            <span className="pixel text-base text-yellow">
              +{Math.round((data?.mult.day ?? 0) * 100)}%{" "}
              <span className="text-text-dim">{isXp && day ? t("robo.day.xpWord") : t("robo.day.loot")}</span>
            </span>
            {ends && data?.source === "game" && (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-text-dim">
                <Clock size={14} />{t("robo.day.ends", { t: ends })}
              </span>
            )}
            {data?.source === "manual" && (
              <span className="chip shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{t("robo.day.sim")}</span>
            )}
            {data && (
              <span
                className={`ms-auto inline-flex shrink-0 items-center gap-1.5 text-sm ${data.catalog.live ? "text-text-dim" : "text-yellow"}`}
                title={data.catalog.error ?? t("robo.day.catalogHint")}
              >
                {data.catalog.live
                  ? t("robo.day.catalogLive", { t: age(data.catalog.at, now) })
                  : t("robo.day.catalogStale")}
              </span>
            )}
          </>
        )}
      </div>

      {/* lista: cabecalho + linhas na MESMA grade, rolando junto na horizontal */}
      {loading && !data ? (
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-14" /><div className="skeleton h-14" /><div className="skeleton h-14" />
        </div>
      ) : !data || !data.rows.length ? (
        <div className="well flex min-h-16 items-center justify-center text-center text-base text-text-dim">
          {err ? t("robo.day.fail") : t("robo.day.empty")}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="min-w-[58rem]">
            <div className={`grid ${COLS} items-end gap-x-3 px-2.5 pb-1.5`}>
              <span />
              <span className="field-label">{t("robo.day.colTarget")}</span>
              <span className="field-label">{t("robo.day.colPoke")}</span>
              <span className="field-label text-right">{isXp ? t("robo.day.colXpH") : t("robo.day.colGoldH")}</span>
              <span className="field-label text-right">{t("robo.day.gain")}</span>
              <span className="field-label text-right">{t("robo.day.eff")}</span>
              <span className="field-label text-right">{t("robo.day.colRisk")}</span>
              <span className="field-label text-right">{t("robo.day.colGo")}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {(all ? data.rows : data.rows.slice(0, TOP_N)).map((r, i) => {
                const value = isXp ? r.xpH : r.goldH;
                const plain = isXp ? r.plainXpH : r.plainGoldH;
                const gain = plain > 0 ? value / plain - 1 : 0;
                return (
                  <div key={`${r.targetId}-${r.poke.id}`} className={`well grid ${COLS} items-center gap-x-3 p-2.5`}>
                    <span className="pixel text-sm text-text-dim">{i + 1}</span>

                    {/* ALVO */}
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--surface-2)]">
                        <Sprite src={spriteUrl(r.targetId)} alt={r.targetName} size={34} />
                      </span>
                      {/* duas linhas, nao tres: os tipos sobem pra linha do nome e a
                          altura da linha cai ~um terco — com 12 alvos isso e meia tela */}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-text">{r.targetName}</span>
                          <TypeBadges t1={r.t1} t2={r.t2} icon={false} />
                          {r.typeDayHits && (
                            <span className="chip shrink-0" style={{ background: "var(--yellow)", color: "#2a2200" }}>
                              +{Math.round((data.mult.day ?? 0) * 100)}%
                            </span>
                          )}
                        </span>
                        <span className="truncate text-xs uppercase tracking-wide text-text-dim">
                          {r.huntName} · {area(r.area)} · lvl {r.huntLevel}
                        </span>
                      </span>
                    </span>

                    {/* SEU POKEMON */}
                    <span className="flex min-w-0 items-center gap-2">
                      <Sprite src={spriteUrl(r.poke.speciesId)} alt={r.poke.name} size={26} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-text">{r.poke.name}</span>
                        <span className="text-xs text-text-dim">
                          Lv{r.poke.level}
                          {!r.poke.team && <span className="ml-1 text-yellow" title={t("robo.day.boxHint")}>· {t("robo.day.box")}</span>}
                        </span>
                      </span>
                    </span>

                    {/* RENDIMENTO + a conta aberta embaixo */}
                    <span className="flex flex-col items-end gap-0.5">
                      <span className={`pixel inline-flex items-center gap-1 tabular-nums text-base ${isXp ? "text-cyan" : "text-green"}`}>
                        {isXp ? <Xp size={14} /> : <Coin size={14} />}{compact(value)}
                      </span>
                      {/* O numero grande e o que a SUA evidencia sustenta. Quando o cenario
                          otimista e bem maior, ele aparece do lado marcado como aposta —
                          era ele, sozinho, que mandava caçar Tyrogue. */}
                      {!isXp && r.goldGuessH > r.goldH * 1.15 && (
                        <span
                          className="whitespace-nowrap text-[0.68rem] tabular-nums text-yellow"
                          title={t(r.captureSample > 0 ? "robo.day.upsideSome" : "robo.day.upsideNone", {
                            v: compact(r.goldGuessH),
                            rate: (r.captureGuessRate * 100).toFixed(1),
                            n: r.captureSample.toLocaleString("pt-BR"),
                          })}
                        >
                          {t("robo.day.upside", { v: compact(r.goldGuessH) })}
                        </span>
                      )}
                      {!isXp && (
                        <span
                          className="whitespace-nowrap text-[0.68rem] tabular-nums text-text-dim"
                          title={t(r.captureSample > 0 ? "robo.day.breakSpot" : "robo.day.breakHint", {
                            rate: (r.captureRate * 100).toFixed(1),
                            n: r.captureSample.toLocaleString("pt-BR"),
                          })}
                        >
                          {compact(r.lootH)} + {compact(r.captureH)} − {compact(r.supplyH)}
                          {r.potionH > r.supplyH * 0.4 && r.potionH > 0 && (
                            <span className="ml-1 text-red" title={t("robo.day.potionHint", { v: compact(r.potionH), d: Math.round(r.dmgPerKill) })}>
                              {t("robo.day.potionFlag")}
                            </span>
                          )}
                        </span>
                      )}
                    </span>

                    <span className={`text-right tabular-nums text-sm ${gain > 0.001 ? "text-yellow" : "slot-empty"}`} title={t("robo.day.gainHint")}>
                      {gain > 0.001 ? `+${pct(gain)}` : "—"}
                    </span>

                    <span
                      className={`text-right tabular-nums text-sm ${r.typeDayHits ? (r.dayUse >= 0.8 ? "text-green" : r.dayUse >= 0.4 ? "text-yellow" : "text-red") : "slot-empty"}`}
                      title={t("robo.day.effHint")}
                    >
                      {r.typeDayHits ? pct(r.dayUse) : "—"}
                    </span>

                    <span className="pixel text-right text-sm" style={{ color: RISK_COLOR[r.risk] }} title={t("robo.day.riskHint", { n: r.killsPerLife })}>
                      {t(`hunt.route.${r.risk}`)}
                    </span>

                    <span className="flex justify-end">
                      <button type="button" onClick={() => onHunt(r)} className="btn btn-ghost btn-sm shrink-0">
                        {t("robo.day.hunt")} <ChevronRight size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            {data.rows.length > TOP_N && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="btn btn-ghost btn-sm mt-2 w-full justify-center"
              >
                {all ? t("robo.day.less") : t("robo.day.more", { n: data.rows.length })}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-sm leading-relaxed text-text-dim">
        {isXp ? t("robo.day.noteXp") : t("robo.day.note")}
        {styleNote ? ` ${styleNote}` : ""}
        {data?.style.killSpeed
          ? ` ${t("robo.day.killSpeed", {
              dps: data.style.killSpeed.dps.toLocaleString("pt-BR"),
              oh: data.style.killSpeed.overhead.toFixed(1),
              n: data.style.killSpeed.points,
            })}`
          : data && data.style.speedFactor !== 1
            ? ` ${t("robo.day.speed", { v: data.style.speedFactor.toFixed(2) })}`
            : ""}
        {data && data.style.law && data.style.law.sample > 0
          ? ` ${t("robo.day.law", { n: data.style.law.sample, x: data.style.law.spread.toFixed(1), ball: data.style.ballName })}`
          : ""}
        {data && data.style.species > 0
          ? ` ${t("robo.day.meter", { n: data.style.species })}`
          : ""}
        {data && !data.style.autoCatch ? ` ${t("robo.day.noAuto")}` : ""}
        {data && data.style.sellShare !== 1
          ? ` ${t("robo.day.share", { v: Math.round(data.style.sellShare * 100) })}`
          : ""}
      </p>

      {/* AJUSTES — recolhidos, e no fim: em cima empurravam a resposta pra fora da tela */}
      <div className="well p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
        >
          <span className="field-label flex-1">{t("robo.day.tune")}</span>
          {dirty && <span className="chip shrink-0" style={{ background: "var(--cyan)", color: "#06131a" }}>{t("robo.day.tuned")}</span>}
          <span className="inline-flex shrink-0 text-text-dim" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
            <Caret size={16} />
          </span>
        </button>
        {open && (
          <div className="flex flex-col gap-3 border-t border-border px-3.5 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.tuneStreak")}</span>
                <input className="input" inputMode="decimal" value={streak}
                  placeholder={data ? (data.mult.streak * 100).toFixed(1) : "3"}
                  onChange={(e) => setStreak(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.tuneEvent")}</span>
                <input className="input" inputMode="decimal" value={event}
                  placeholder={data ? (data.mult.boost * 100).toFixed(0) : "0"}
                  onChange={(e) => setEvent(e.target.value)} />
              </label>
              <div className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.tuneBoost")}</span>
                <ToggleButton active={boost === true} onClick={() => setBoost(boost === true ? false : true)} accent="cyan">
                  {boost === true ? t("boost.on") : t("boost.off")}
                </ToggleButton>
              </div>
              <label className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.tuneCapture")}</span>
                <input className="input" inputMode="decimal" value={capture}
                  placeholder={data ? data.style.capturePerKill.toFixed(4) : "0"}
                  onChange={(e) => setCapture(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.tuneSupply")}</span>
                <input className="input" inputMode="decimal" value={supply}
                  placeholder={data ? Math.round(data.style.supplyPerKill).toString() : "0"}
                  onChange={(e) => setSupply(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="field-label">{t("robo.day.simLabel")}</span>
                <TypeFilter value={sim} onChange={setSim} className="" emptyLabel={t("robo.day.simToday")} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm text-text-dim" title={t("robo.day.multHint")}>
                {t("robo.day.mult")}{" "}
                <span className="pixel text-base text-cyan">x{(data?.mult.withDay ?? 1).toFixed(3)}</span>
                <span className="ml-2">{t("robo.day.multBg", { v: (data?.mult.background ?? 1).toFixed(3) })}</span>
              </span>
              <button type="button" onClick={reset} disabled={!dirty} className="btn btn-ghost btn-sm ms-auto disabled:opacity-40">
                {t("robo.day.tuneReset")}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-text-dim">{t("robo.day.tuneNote")}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
