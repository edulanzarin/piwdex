"use client";

// Vender pokemon (manual, por regra) — 2a capacidade de venda do Robo. As travas que
// o Eduardo pediu, TODAS configuraveis e granulares:
//   (1) um box por raridade (COMMON..MYTHIC) — marca so o que topa vender;
//   (2) nunca shiny;
//   (3) IV maximo ABSOLUTO (0..192, nao %) — so vende ate esse IV total;
//   (4) qualidade maxima (decimal) — so vende ate essa qualidade.
// A config fica salva em localStorage (piw:poke-sell-config:v2) e ja e o contrato que
// o worker/venda vao ler. A simulacao lista o que casaria ANTES de confirmar.
//
// TRAVA ATUAL: a lista dos pokemon individuais (com IV/quality/shiny) nao existe na
// REST do jogo (endpoints candidatos deram 404) — so no WebSocket (evento `pokes`).
// Enquanto essa fonte nao entra, as travas salvam mas a simulacao/venda ficam
// desligadas com aviso. O backend (POST /api/vip/shop action sell-pokes) ja vende por
// pokeId; falta so a fonte da lista.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { LoadingBall } from "./loaders";
import { useT } from "./locale-provider";
import { Coin, Star } from "./icons";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

interface SimPoke { id: string; name: string; level: number; shiny: boolean; ivTotal: number; quality: number; sellValue: number; rarity: Rarity }
type Sim = { s: "idle" } | { s: "loading" } | { s: "error"; code: string } | { s: "ok"; pokes: SimPoke[]; total: number };
const fmt = (n: number) => n.toLocaleString("pt-BR");

// estado do robo de venda automatica 24/7 (GET /api/vip/autosell)
type AutoStatus = "idle" | "connecting" | "running" | "kicked" | "error";
interface AutoState { status: AutoStatus; since: number | null; lastSweepAt: number | null; lastSold: number; soldTotal: number; goldTotal: number }
const AUTO_COLOR: Record<AutoStatus, string> = { idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)", kicked: "var(--yellow)", error: "var(--pink)" };
const hhmm = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—");

export interface PokeSellConfig {
  sellRarities: Rarity[]; // raridades que PODEM ser vendidas (o resto nunca vende)
  keepShiny: boolean; // nunca vender shiny
  maxIv: number; // 0..192, so vende IV total <= maxIv
  maxQuality: number; // decimal, so vende quality <= maxQuality
}

// escala absoluta do jogo (nao %): IV total = soma dos 6 IVs (0..32 cada).
const IV_MAX = 192;
const QUALITY_MAX = 3; // teto do slider; qualidade real e decimal (~1.0..2.x) — ajustavel quando o WS trouxer os valores
const QUALITY_STEP = 0.05;

const KEY = "piw:poke-sell-config:v2";
const DEFAULTS: PokeSellConfig = { sellRarities: ["COMMON", "UNCOMMON"], keepShiny: true, maxIv: 100, maxQuality: 1.8 };

function load(): PokeSellConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<PokeSellConfig>;
    const rar = Array.isArray(p.sellRarities) ? p.sellRarities.filter((r): r is Rarity => RARITY_ORDER.includes(r as Rarity)) : null;
    const clamp = (n: unknown, max: number, d: number) => (typeof n === "number" && n >= 0 && n <= max ? n : d);
    return {
      sellRarities: rar ?? DEFAULTS.sellRarities,
      keepShiny: typeof p.keepShiny === "boolean" ? p.keepShiny : DEFAULTS.keepShiny,
      maxIv: clamp(p.maxIv, IV_MAX, DEFAULTS.maxIv),
      maxQuality: clamp(p.maxQuality, QUALITY_MAX, DEFAULTS.maxQuality),
    };
  } catch {
    return DEFAULTS;
  }
}

// linha de config: titulo + descricao + controle (mesmo padrao do RoboPanel)
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="mt-0.5 text-[0.68rem] text-text-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// slider pra ajuste grosso + campo de numero pra valor EXATO (os dois sincronizados)
function Slider({ value, min, max, step, decimals, onChange }: { value: number; min: number; max: number; step: number; decimals: number; onChange: (n: number) => void }) {
  const round = (n: number) => { const p = Math.pow(10, decimals); return Math.round(n * p) / p; };
  const set = (n: number) => { if (Number.isNaN(n)) return; onChange(round(Math.min(max, Math.max(min, n)))); };
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-32 accent-[color:var(--yellow)]" />
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="input w-20 text-right font-semibold tabular-nums text-yellow" />
    </div>
  );
}

// um box por raridade, na cor oficial — marcado = vende essa raridade
function RarityBoxes({ selected, onToggle }: { selected: Rarity[]; onToggle: (r: Rarity) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {RARITY_ORDER.map((r) => {
        const on = selected.includes(r);
        const color = RARITY_COLOR[r];
        return (
          <button
            key={r}
            type="button"
            onClick={() => onToggle(r)}
            aria-pressed={on}
            className="chip inline-flex items-center gap-1.5 border transition"
            style={{ background: on ? color : "transparent", borderColor: color, color: on ? "#06111a" : color, opacity: on ? 1 : 0.5 }}
          >
            <span className="w-2 text-center text-[0.6rem]">{on ? "✓" : "·"}</span>
            {r}
          </button>
        );
      })}
    </div>
  );
}

export function PokeSeller() {
  const t = useT();
  const [cfg, setCfg] = useState<PokeSellConfig>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [sim, setSim] = useState<Sim>({ s: "idle" });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selling, setSelling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // hidrata do localStorage so no cliente (evita mismatch de SSR)
  useEffect(() => setCfg(load()), []);

  // robo de venda automatica 24/7: poll do estado a cada 4s
  const [auto, setAuto] = useState<AutoState | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const loadAuto = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/autosell", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as AutoState | null;
      if (j && "status" in j) setAuto(j);
    } catch {}
  }, []);
  useEffect(() => { loadAuto(); const id = setInterval(loadAuto, 4000); return () => clearInterval(id); }, [loadAuto]);

  const toggleAuto = async (on: boolean) => {
    setAutoBusy(true);
    try {
      const body = on ? { action: "start", config: cfg } : { action: "stop" };
      const r = await fetch("/api/vip/autosell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => null)) as AutoState | null;
      if (j && "status" in j) setAuto(j);
    } finally { setAutoBusy(false); }
  };

  // puxa a lista viva (WS) e mostra o que bate as travas — nada e vendido ainda
  const simulate = async () => {
    setSim({ s: "loading" });
    setFlash(null);
    try {
      const res = await fetch("/api/vip/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sim-pokes", config: cfg }),
      });
      const j = (await res.json().catch(() => ({}))) as { pokes?: SimPoke[]; total?: number; error?: string };
      if (res.ok) {
        const pokes = j.pokes ?? [];
        setSim({ s: "ok", pokes, total: j.total ?? pokes.length });
        setSel(new Set(pokes.map((p) => p.id)));
      } else {
        setSim({ s: "error", code: j.error ?? "failed" });
      }
    } catch {
      setSim({ s: "error", code: "failed" });
    }
  };

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const { count, gold } = useMemo(() => {
    let count = 0, gold = 0;
    if (sim.s === "ok") for (const p of sim.pokes) if (sel.has(p.id)) { count++; gold += p.sellValue; }
    return { count, gold };
  }, [sim, sel]);

  const sell = async () => {
    if (sim.s !== "ok") return;
    const pokeIds = sim.pokes.filter((p) => sel.has(p.id)).map((p) => p.id);
    if (!pokeIds.length) return;
    setSelling(true);
    try {
      const res = await fetch("/api/vip/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell-pokes", pokeIds }),
      });
      const j = (await res.json().catch(() => ({}))) as { result?: { goldGained?: number; sold?: number } };
      if (res.ok) {
        setFlash(t("robo.pokes.sold", { gold: fmt(j.result?.goldGained ?? gold), n: j.result?.sold ?? pokeIds.length }));
        setSim({ s: "idle" });
        setSel(new Set());
      } else {
        setFlash(t("robo.pokes.failed"));
      }
    } finally {
      setSelling(false);
    }
  };

  const patch = (p: Partial<PokeSellConfig>) => {
    setCfg((c) => {
      const next = { ...c, ...p };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const toggleRarity = (r: Rarity) =>
    patch({ sellRarities: cfg.sellRarities.includes(r) ? cfg.sellRarities.filter((x) => x !== r) : [...cfg.sellRarities, r] });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-yellow"><Coin size={14} /> {t("robo.pokes.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokes.desc")}</p>
      </div>

      {/* travas configuraveis — sempre editaveis, salvam na hora */}
      <div className="card flex flex-col p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="pixel text-[0.6rem] text-cyan">{t("robo.pokes.filters")}</h3>
          {saved && <span className="text-[0.66rem] font-semibold text-green">{t("robo.pokes.saved")}</span>}
        </div>

        {/* raridade: bloco de largura cheia (6 boxes nao cabem alinhados a direita) */}
        <div className="py-3">
          <div className="text-sm font-semibold text-text">{t("robo.pokes.sellRarities")}</div>
          <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.pokes.sellRarities.desc")}</div>
          <RarityBoxes selected={cfg.sellRarities} onToggle={toggleRarity} />
        </div>

        <Row title={t("robo.pokes.keepShiny")} desc={t("robo.pokes.keepShiny.desc")}>
          <ToggleButton active={cfg.keepShiny} accent="green" onClick={() => patch({ keepShiny: !cfg.keepShiny })}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cfg.keepShiny ? "var(--green)" : "var(--text-dim)" }} />
            {cfg.keepShiny ? t("robo.on") : t("robo.off")}
          </ToggleButton>
        </Row>
        <Row title={t("robo.pokes.maxIv")} desc={t("robo.pokes.maxIv.desc", { n: cfg.maxIv })}>
          <Slider value={cfg.maxIv} min={0} max={IV_MAX} step={1} decimals={0} onChange={(n) => patch({ maxIv: n })} />
        </Row>
        <Row title={t("robo.pokes.maxQuality")} desc={t("robo.pokes.maxQuality.desc", { n: cfg.maxQuality.toFixed(2) })}>
          <Slider value={cfg.maxQuality} min={0} max={QUALITY_MAX} step={QUALITY_STEP} decimals={2} onChange={(n) => patch({ maxQuality: n })} />
        </Row>
      </div>

      {/* venda automatica 24/7: o piwdex segura a sessao e vende sozinho pelas travas acima */}
      {(() => {
        const status: AutoStatus = auto?.status ?? "idle";
        const on = status === "running" || status === "connecting";
        return (
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="pixel text-[0.6rem] text-yellow">{t("robo.auto.title")}</h3>
                <p className="mt-1 text-[0.62rem] text-text-dim">{t("robo.auto.desc")}</p>
              </div>
              {on ? (
                <button type="button" onClick={() => toggleAuto(false)} disabled={autoBusy} className="btn btn-ghost">{t("robo.auto.stop")}</button>
              ) : (
                <button type="button" onClick={() => toggleAuto(true)} disabled={autoBusy || cfg.sellRarities.length === 0} className="btn btn-cyan disabled:opacity-40">{t("robo.auto.start")} ›</button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[0.72rem] font-semibold">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: AUTO_COLOR[status] }} />
              {t(`robo.auto.status.${status}`)}
            </div>
            {auto && (auto.soldTotal > 0 || auto.lastSweepAt) && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-border p-2.5">
                  <div className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("robo.auto.sold")}</div>
                  <div className="mt-0.5 pixel text-[0.7rem] text-text">{fmt(auto.soldTotal)}</div>
                </div>
                <div className="rounded border border-border p-2.5">
                  <div className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("robo.auto.gold")}</div>
                  <div className="mt-0.5 pixel text-[0.7rem] text-yellow">{fmt(auto.goldTotal)}</div>
                </div>
                <div className="rounded border border-border p-2.5">
                  <div className="text-[0.5rem] uppercase tracking-wide text-text-dim">{t("robo.auto.lastSweep")}</div>
                  <div className="mt-0.5 pixel text-[0.7rem] text-text">{hhmm(auto.lastSweepAt)}</div>
                </div>
              </div>
            )}
            <p className="text-[0.58rem] leading-relaxed text-text-dim">{t("robo.auto.warn")}</p>
          </div>
        );
      })()}

      {/* simulacao + venda: puxa a lista viva do WS, voce confere e confirma */}
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="pixel text-[0.6rem] text-cyan">{t("robo.pokes.simulate")}</h3>
            <p className="mt-1 text-[0.62rem] text-text-dim">{t("robo.pokes.protected")}</p>
          </div>
          {sim.s !== "ok" ? (
            <button type="button" onClick={simulate} disabled={sim.s === "loading" || cfg.sellRarities.length === 0} className="btn btn-cyan disabled:opacity-40">
              {sim.s === "loading" ? `${t("robo.pokes.simulating")}...` : `${t("robo.pokes.simulate")} ›`}
            </button>
          ) : (
            <button type="button" onClick={() => { setSim({ s: "idle" }); setSel(new Set()); }} className="btn btn-ghost">{t("robo.pokes.redo")}</button>
          )}
          {flash && <span className="w-full text-right text-[0.72rem] font-semibold text-green sm:w-auto">{flash}</span>}
        </div>

        {sim.s === "loading" && <LoadingBall label={t("robo.pokes.simulating")} />}
        {sim.s === "error" && (
          <p className="text-[0.72rem] text-text-dim">{sim.code === "not_connected" ? t("robo.connect") : t("robo.pokes.wsError")}</p>
        )}
        {sim.s === "ok" && (sim.pokes.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{t("robo.pokes.simEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-[0.68rem] text-text-dim">{t("robo.pokes.simCount", { n: sim.pokes.length, total: sim.total })}</span>
            <div className="grid max-h-96 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
              {sim.pokes.map((p) => {
                const on = sel.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSel(p.id)}
                    className="flex items-center gap-2.5 rounded border p-2 text-left transition"
                    style={{ borderColor: on ? "var(--cyan)" : "var(--border)", background: on ? "color-mix(in srgb, var(--cyan) 8%, transparent)" : "transparent" }}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[0.6rem] ${on ? "border-cyan bg-cyan text-[#06131a]" : "border-border text-transparent"}`}>✓</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{p.name}</span>
                        <span className="shrink-0 text-[0.6rem] text-text-dim">Lv{p.level}</span>
                        {p.shiny && <span className="shrink-0 text-yellow"><Star size={9} /></span>}
                        <span className="shrink-0 rounded px-1 text-[0.5rem] font-bold uppercase" style={{ background: RARITY_COLOR[p.rarity], color: "#06111a" }}>{p.rarity}</span>
                      </div>
                      <div className="text-[0.6rem] text-text-dim">IV {p.ivTotal} · Q {p.quality.toFixed(2)} · <span className="text-yellow">{fmt(p.sellValue)}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-[0.72rem] text-text-dim">{t("robo.sell.selected", { n: count })}</span>
              <button type="button" onClick={sell} disabled={selling || count === 0} className="btn btn-cyan disabled:opacity-40">
                {selling ? `${t("robo.pokes.selling")}...` : `${t("robo.pokes.confirm", { n: count, gold: fmt(gold) })} ›`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
