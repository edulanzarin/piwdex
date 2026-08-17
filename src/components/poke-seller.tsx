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

import { useCallback, useEffect, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { Sprite } from "./sprite";
import { StatTile } from "./stat-tile";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin, Star, Clock, Check, ChevronRight } from "./icons";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("pt-BR");

// estado do robo de venda automatica 24/7 (GET /api/vip/autosell)
type AutoStatus = "idle" | "connecting" | "running" | "kicked" | "error";
interface SoldPoke { id: string; name: string; speciesId: number; level: number; shiny: boolean; ivTotal: number; quality: number; sellValue: number; rarity: Rarity }
interface AutoState { status: AutoStatus; since: number | null; lastSweepAt: number | null; lastSold: number; soldTotal: number; goldTotal: number; lastMatches: SoldPoke[]; error?: string }
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
            <span className="inline-flex w-2 justify-center text-[0.6rem]">{on ? <Check size={9} /> : "·"}</span>
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
        <h2 className="section-title flex items-center gap-2 text-yellow"><Coin size={14} /> {t("robo.pokes.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokes.desc")}</p>
      </div>

      {/* travas configuraveis — sempre editaveis, salvam na hora */}
      <div className="card flex flex-col p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="section-title text-cyan">{t("robo.pokes.filters")}</h3>
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
                <h3 className="section-title text-yellow">{t("robo.auto.title")}</h3>
                <p className="mt-1 text-[0.62rem] text-text-dim">{t("robo.auto.desc")}</p>
              </div>
              {on ? (
                <button type="button" onClick={() => toggleAuto(false)} disabled={autoBusy} className="btn btn-ghost">{t("robo.auto.stop")}</button>
              ) : (
                <button type="button" onClick={() => toggleAuto(true)} disabled={autoBusy || cfg.sellRarities.length === 0} className="btn btn-cyan disabled:opacity-40">{t("robo.auto.start")} <ChevronRight size={10} /></button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[0.72rem] font-semibold">
              <span className={`inline-block h-2 w-2 rounded-full ${on ? "pulse-soft" : ""}`} style={{ background: AUTO_COLOR[status] }} />
              {t(`robo.auto.status.${status}`)}
            </div>
            {(status === "kicked" || status === "error") && (
              <p className="rounded border border-[color:var(--yellow)]/40 bg-[rgba(240,200,60,0.06)] px-3 py-2 text-[0.62rem] leading-relaxed text-yellow">
                {t("robo.auto.kickedHint")}{auto?.error ? ` (${auto.error})` : ""}
              </p>
            )}
            {auto && (auto.soldTotal > 0 || auto.lastSweepAt) && (
              <div className="grid grid-cols-3 gap-2">
                <StatTile label={t("robo.auto.sold")} value={fmt(auto.soldTotal)} icon={<Coin size={11} className="text-text-dim" />} />
                <StatTile label={t("robo.auto.gold")} value={fmt(auto.goldTotal)} accent="var(--yellow)" icon={<Coin size={11} />} />
                <StatTile label={t("robo.auto.lastSweep")} value={hhmm(auto.lastSweepAt)} icon={<Clock size={11} className="text-text-dim" />} />
              </div>
            )}
            <p className="text-[0.58rem] leading-relaxed text-text-dim">{t("robo.auto.warn")}</p>
          </div>
        );
      })()}

      {/* cards do que o robo casou/vendeu na ultima varredura (so quando ligado/tem resultado) */}
      {(() => {
        const on = auto?.status === "running" || auto?.status === "connecting";
        const matches = auto?.lastMatches ?? [];
        if (!on && matches.length === 0) return null;
        return (
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="section-title text-cyan">{t("robo.auto.matches")}</h3>
              {auto && auto.lastSold > 0 && <span className="text-[0.62rem] text-green">{t("robo.auto.justSold", { n: auto.lastSold })}</span>}
            </div>
            {matches.length === 0 ? (
              <p className="text-[0.72rem] text-text-dim">{t("robo.auto.matchesEmpty")}</p>
            ) : (
              <div className="grid max-h-96 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
                {matches.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                      <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={34} />
                      {p.shiny && <span className="absolute right-0 top-0 text-yellow"><Star size={9} /></span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{p.name}</span>
                        <span className="shrink-0 text-[0.6rem] text-text-dim">Lv{p.level}</span>
                        <span className="shrink-0 rounded px-1 text-[0.5rem] font-bold uppercase" style={{ background: RARITY_COLOR[p.rarity], color: "#06111a" }}>{p.rarity}</span>
                      </div>
                      <div className="text-[0.6rem] text-text-dim">IV {p.ivTotal} · Q {p.quality.toFixed(2)} · <span className="text-yellow">{fmt(p.sellValue)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
