"use client";

// Secao CONFIGURACOES unificada (VIP): automacao nativa do jogo (Auto-Helper), travas da
// venda de pokemon e auto-compra de consumiveis — TUDO num draft so, aplicado por UM unico
// Confirmar (sticky no topo). Substitui os tres cards antigos (RoboPanel + PokeSeller +
// ConsumablesBuyer), cada um com seu proprio botao, que confundia e deixava metade sem
// salvar. Nada grava a cada clique: mexeu, o contador de pendencias sobe; Confirmar aplica
// tudo em lote e recarrega o estado real.
//
// Fontes: /api/vip/auto (auto-helper do jogo) · /api/vip/autobuy (toggle + pocao/revive)
// · /api/vip/autosell (travas + interruptor da venda, SALVOS NO BANCO — valem em toda hunt).

import { useEffect, useRef, useState } from "react";
import { LoadingBall } from "./loaders";
import { ToggleButton } from "./toggle-button";
import { Pokeball } from "./pokeball";
import { Caret, Infinity_, Check, Coin, Gear } from "./icons";
import { useT } from "./locale-provider";
import { useToast } from "./toast";
import { useVipLive } from "./vip-live";
import { assetIconUrl } from "@/lib/sprites";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

// ---- tipos ----

interface Auto {
  autoCatch: boolean;
  autoCatchBallId: number;
  autoCatchShiny: boolean;
  autoCatchShinyBallId: number;
  autoPotion: boolean;
  autoPotionThreshold: number;
  autoRevive: boolean;
  selectedBallId: number;
  isVip: boolean;
}
interface Ball { id: number; name: string; iconUrl: string; count: number; infinite: boolean }
type AutoField = "autoCatch" | "autoCatchBallId" | "autoCatchShiny" | "autoCatchShinyBallId" | "autoPotion" | "autoPotionThreshold" | "autoRevive" | "selectedBallId";
const AUTO_FIELDS: AutoField[] = ["autoCatch", "autoCatchBallId", "autoCatchShiny", "autoCatchShinyBallId", "autoPotion", "autoPotionThreshold", "autoRevive", "selectedBallId"];

interface Opt { id: number; name: string; icon: string }

interface SellCfg { sellRarities: Rarity[]; keepShiny: boolean; maxIv: number; maxQuality: number }
const SELL_DEFAULTS: SellCfg = { sellRarities: ["COMMON", "UNCOMMON"], keepShiny: true, maxIv: 100, maxQuality: 1.8 };
const IV_MAX = 192;
const QUALITY_MAX = 3;
const QUALITY_STEP = 0.05;

interface Draft {
  auto: Auto;
  potionId: number | null;
  reviveId: number | null;
  sellOn: boolean;
  sell: SellCfg;
  autobuy: boolean;
}

type Load =
  | { s: "loading" }
  | { s: "error"; code: string }
  | { s: "ok"; base: Draft; balls: Ball[]; potions: Opt[]; revives: Opt[] };

// ---- seletor de bola (icone + nome + quantidade no proprio botao) ----

function BallSelect({ balls, value, onChange, disabled }: { balls: Ball[]; value: number; onChange: (id: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = balls.find((b) => b.id === value);
  const empty = cur != null && !cur.infinite && cur.count <= 0;
  return (
    <div ref={box} className="relative w-full sm:w-56">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2 disabled:opacity-40"
      >
        <span className="flex min-w-0 items-center gap-2">
          {cur?.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.iconUrl} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
          )}
          <span className="truncate">{cur?.name ?? `#${value}`}</span>
          {cur && (
            <span className={`shrink-0 text-[0.6rem] tabular-nums ${empty ? "font-bold text-red" : "text-text-dim"}`}>
              {cur.infinite ? <Infinity_ size={11} /> : `x${cur.count}`}
            </span>
          )}
        </span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={9} />
        </span>
      </button>
      {open && (
        <div role="listbox" className="card fadein absolute z-30 mt-1 max-h-64 w-full overflow-auto p-1" style={{ background: "var(--surface-solid)" }}>
          {balls.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onChange(b.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${b.id === value ? "bg-surface-2" : ""}`}
            >
              {b.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.iconUrl} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
              )}
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="flex shrink-0 items-center text-[0.6rem] text-text-dim">{b.infinite ? <Infinity_ size={13} /> : b.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- seletor de pocao/revive (icone + nome), com "a melhor disponivel" = null ----

function SupplySelect({ opts, value, onChange, bestLabel }: { opts: Opt[]; value: number | null; onChange: (id: number | null) => void; bestLabel: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = value != null ? opts.find((o) => o.id === value) : null;
  return (
    <div ref={box} className="relative w-full sm:w-56">
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {cur?.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetIconUrl(cur.icon)} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
          )}
          <span className="truncate">{cur?.name ?? bestLabel}</span>
        </span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={9} />
        </span>
      </button>
      {open && (
        <div role="listbox" className="card fadein absolute z-30 mt-1 max-h-64 w-full overflow-auto p-1" style={{ background: "var(--surface-solid)" }}>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${value == null ? "bg-surface-2" : ""}`}
          >
            <span className="min-w-0 flex-1 truncate text-text-dim">{bestLabel}</span>
          </button>
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${o.id === value ? "bg-surface-2" : ""}`}
            >
              {o.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetIconUrl(o.icon)} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
              )}
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- blocos de layout compartilhados ----

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="mt-0.5 text-[0.68rem] text-text-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

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

// ---- painel ----

export function ConfigPanel() {
  const t = useT();
  const toast = useToast();
  // contagem de bolas AO VIVO via SSE (cai enquanto a caca gasta)
  const liveBalls = useVipLive().account?.account?.balls;
  const [st, setSt] = useState<Load>({ s: "loading" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      const [aRes, bRes, sRes] = await Promise.all([
        fetch("/api/vip/auto", { cache: "no-store" }),
        fetch("/api/vip/autobuy", { cache: "no-store" }),
        fetch("/api/vip/autosell", { cache: "no-store" }),
      ]);
      const aj = (await aRes.json().catch(() => ({}))) as { auto?: Auto; balls?: Ball[]; error?: string };
      const bj = (await bRes.json().catch(() => ({}))) as { on?: boolean; potionId?: number | null; reviveId?: number | null; potions?: Opt[]; revives?: Opt[] };
      const sj = (await sRes.json().catch(() => ({}))) as { on?: boolean; config?: Partial<SellCfg> | null };
      if (!aRes.ok || !aj.auto) { setSt({ s: "error", code: aj.error ?? "failed" }); return; }
      const sell: SellCfg = sj.config
        ? {
            sellRarities: Array.isArray(sj.config.sellRarities) ? sj.config.sellRarities.filter((r): r is Rarity => RARITY_ORDER.includes(r as Rarity)) : SELL_DEFAULTS.sellRarities,
            keepShiny: sj.config.keepShiny !== false,
            maxIv: typeof sj.config.maxIv === "number" ? sj.config.maxIv : SELL_DEFAULTS.maxIv,
            maxQuality: typeof sj.config.maxQuality === "number" ? sj.config.maxQuality : SELL_DEFAULTS.maxQuality,
          }
        : { ...SELL_DEFAULTS, sellRarities: [...SELL_DEFAULTS.sellRarities] };
      const base: Draft = {
        auto: aj.auto,
        potionId: bj.potionId ?? null,
        reviveId: bj.reviveId ?? null,
        sellOn: sj.on === true,
        sell,
        autobuy: bj.on === true,
      };
      setSt({ s: "ok", base, balls: aj.balls ?? [], potions: bj.potions ?? [], revives: bj.revives ?? [] });
      setDraft(structuredClone(base));
    } catch {
      setSt({ s: "error", code: "failed" });
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (st.s === "loading") return <div className="card p-6"><LoadingBall label={t("robo.loading")} /></div>;
  if (st.s === "error") {
    const msg = st.code === "not_connected" || st.code === "expired" ? t("robo.connect") : t("robo.error");
    return <div className="card p-6 text-sm text-text-dim">{msg}</div>;
  }

  const base = st.base;
  const d = draft ?? base;

  // tempo real: sobrepoe SO a contagem de cada bola (stream) — nunca o draft
  const liveCount = new Map((liveBalls ?? []).map((b) => [b.id, b.count]));
  const balls = st.balls.map((b) => (liveCount.has(b.id) ? { ...b, count: liveCount.get(b.id)! } : b));
  const ballEmpty = (id: number) => {
    const b = balls.find((x) => x.id === id);
    return b != null && !b.infinite && b.count <= 0;
  };

  const editAuto = (p: Partial<Auto>) => setDraft((cur) => ({ ...(cur ?? base), auto: { ...(cur ?? base).auto, ...p } }));
  const edit = (p: Partial<Omit<Draft, "auto" | "sell">>) => setDraft((cur) => ({ ...(cur ?? base), ...p }));
  const editSell = (p: Partial<SellCfg>) => setDraft((cur) => ({ ...(cur ?? base), sell: { ...(cur ?? base).sell, ...p } }));
  const toggleRarity = (r: Rarity) =>
    editSell({ sellRarities: d.sell.sellRarities.includes(r) ? d.sell.sellRarities.filter((x) => x !== r) : [...d.sell.sellRarities, r] });

  // ---- pendencias (o que o Confirmar vai aplicar) ----
  const autoDirty = AUTO_FIELDS.filter((f) => d.auto[f] !== base.auto[f]);
  const supplyDirty = d.potionId !== base.potionId || d.reviveId !== base.reviveId;
  const sellDirty = d.sellOn !== base.sellOn || JSON.stringify(d.sell) !== JSON.stringify(base.sell);
  const autobuyDirty = d.autobuy !== base.autobuy;
  const pendingCount = autoDirty.length + (supplyDirty ? 1 : 0) + (sellDirty ? 1 : 0) + (autobuyDirty ? 1 : 0);
  const dirty = pendingCount > 0;

  const confirm = async () => {
    if (busy || !dirty) return;
    if (d.sellOn && !d.sell.sellRarities.length) { toast.error(t("robo.pokes.needRarity")); return; }
    setBusy(true);
    try {
      // 1) automacao nativa: so os campos que mudaram
      for (const f of autoDirty) {
        await fetch("/api/vip/auto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field: f, value: d.auto[f] }) });
      }
      // 2) pocao/revive da auto-compra
      if (supplyDirty) {
        await fetch("/api/vip/autobuy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supply: { potionId: d.potionId, reviveId: d.reviveId } }) });
      }
      // 3) toggle da auto-compra
      if (autobuyDirty) {
        await fetch("/api/vip/autobuy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: d.autobuy ? "start" : "stop" }) });
      }
      // 4) venda de pokemon: travas + interruptor num save so (banco; vale em toda hunt)
      if (sellDirty) {
        await fetch("/api/vip/autosell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", on: d.sellOn, config: d.sell }) });
      }
      await load();
      setSaved(true); window.setTimeout(() => setSaved(false), 1800);
      toast.success(t("config.saved"));
    } catch { toast.error(t("toast.err")); } finally { setBusy(false); }
  };

  const sw = (on: boolean, onClick: () => void, disabled?: boolean, title?: string) => (
    <ToggleButton active={on} accent="green" onClick={() => !disabled && onClick()} title={title}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "pulse-soft" : ""}`} style={{ background: on ? "var(--green)" : "var(--text-dim)" }} />
      {on ? t("robo.on") : t("robo.off")}
    </ToggleButton>
  );

  const a = base.auto;
  const ballWarn = (id: number) =>
    ballEmpty(id) && (
      <p className="mt-1.5 rounded border border-red/50 bg-[color:var(--red)]/10 px-2.5 py-1.5 text-[0.62rem] leading-relaxed text-red">
        {t("config.ballEmpty")}
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      {/* barra de acao UNICA — sticky: um Confirmar pra secao inteira */}
      <div className="card sticky top-2 z-40 flex flex-wrap items-center gap-3 p-4" style={{ background: "var(--surface-solid)" }}>
        <span className="inline-flex text-blue"><Gear size={14} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="section-title text-blue">{t("vip.sec.config")}</h2>
          <p className="mt-0.5 text-[0.66rem] text-text-dim">{t("config.desc")}</p>
        </div>
        {saved && !dirty && <span className="text-[0.66rem] font-semibold text-green">{t("config.saved")}</span>}
        {dirty && <span className="chip" style={{ background: "var(--yellow)", color: "#1a1405" }}>{t("config.pending", { n: pendingCount })}</span>}
        <button type="button" onClick={confirm} disabled={!dirty || busy} className="btn btn-cyan disabled:opacity-40">
          <Check size={11} /> {busy ? "…" : t("robo.pokes.commit")}
        </button>
      </div>

      {/* ---- automacao nativa do jogo ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="section-title text-yellow">{t("robo.title")}</h3>
          <p className="mt-1.5 max-w-2xl text-[0.72rem] text-text-dim">{t("robo.desc")}</p>
        </div>
        <div className="card z-20 flex flex-col p-5">
          <Row title={t("robo.autoCatch")} desc={a.isVip ? t("robo.autoCatch.desc") : t("robo.vipOnly")}>
            {sw(d.auto.autoCatch, () => editAuto({ autoCatch: !d.auto.autoCatch }), !a.isVip, !a.isVip ? t("robo.vipOnly") : undefined)}
          </Row>
          {d.auto.autoCatch && a.isVip && (
            <div className="border-t border-border py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{t("robo.catchBall")}</div>
                  <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.catchBall.desc")}</div>
                </div>
                <div className="shrink-0"><BallSelect balls={balls} value={d.auto.autoCatchBallId} onChange={(id) => editAuto({ autoCatchBallId: id })} /></div>
              </div>
              {ballWarn(d.auto.autoCatchBallId)}
            </div>
          )}

          <Row title={t("robo.autoShiny")} desc={t("robo.autoShiny.desc")}>
            {sw(d.auto.autoCatchShiny, () => editAuto({ autoCatchShiny: !d.auto.autoCatchShiny }), !a.isVip, !a.isVip ? t("robo.vipOnly") : undefined)}
          </Row>
          {d.auto.autoCatchShiny && a.isVip && (
            <div className="border-t border-border py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{t("robo.shinyBall")}</div>
                  <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.shinyBall.desc")}</div>
                </div>
                <div className="shrink-0"><BallSelect balls={balls} value={d.auto.autoCatchShinyBallId} onChange={(id) => editAuto({ autoCatchShinyBallId: id })} /></div>
              </div>
              {ballWarn(d.auto.autoCatchShinyBallId)}
            </div>
          )}

          <Row title={t("robo.autoPotion")} desc={t("robo.autoPotion.desc")}>
            {sw(d.auto.autoPotion, () => editAuto({ autoPotion: !d.auto.autoPotion }))}
          </Row>
          {d.auto.autoPotion && (
            <Row title={t("robo.threshold")} desc={t("robo.threshold.desc", { n: d.auto.autoPotionThreshold })}>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={5} max={95} step={5}
                  value={d.auto.autoPotionThreshold}
                  onChange={(e) => editAuto({ autoPotionThreshold: Number(e.target.value) })}
                  className="w-40 accent-[color:var(--yellow)]"
                />
                <span className="w-9 text-right text-sm font-semibold tabular-nums text-yellow">{d.auto.autoPotionThreshold}%</span>
              </div>
            </Row>
          )}
          {d.auto.autoPotion && (
            <Row title={t("robo.autobuy.potion")} desc={t("robo.autobuy.rowDesc")}>
              <SupplySelect opts={st.potions} value={d.potionId} onChange={(id) => edit({ potionId: id })} bestLabel={t("robo.autobuy.best")} />
            </Row>
          )}

          <Row title={t("robo.autoRevive")} desc={t("robo.autoRevive.desc")}>
            {sw(d.auto.autoRevive, () => editAuto({ autoRevive: !d.auto.autoRevive }))}
          </Row>
          {d.auto.autoRevive && (
            <Row title={t("robo.autobuy.revive")} desc={t("robo.autobuy.rowDesc")}>
              <SupplySelect opts={st.revives} value={d.reviveId} onChange={(id) => edit({ reviveId: id })} bestLabel={t("robo.autobuy.best")} />
            </Row>
          )}

          <Row title={t("robo.selectedBall")} desc={t("robo.selectedBall.desc")}>
            <BallSelect balls={balls} value={d.auto.selectedBallId} onChange={(id) => editAuto({ selectedBallId: id })} />
          </Row>
        </div>
      </section>

      {/* ---- venda de pokemon (travas + interruptor, salvos no servidor) ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2 text-green"><Coin size={14} /> {t("robo.pokes.title")}</h3>
          <p className="mt-1.5 max-w-2xl text-[0.72rem] text-text-dim">{t("config.sellDesc")}</p>
        </div>
        <div className="card flex flex-col p-5">
          <Row title={t("robo.pokes.sellOn")} desc={t("robo.pokes.sellOn.desc")}>
            {sw(d.sellOn, () => edit({ sellOn: !d.sellOn }))}
          </Row>

          <div className="border-t border-border py-3">
            <div className="text-sm font-semibold text-text">{t("robo.pokes.sellRarities")}</div>
            <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.pokes.sellRarities.desc")}</div>
            <RarityBoxes selected={d.sell.sellRarities} onToggle={toggleRarity} />
          </div>

          <Row title={t("robo.pokes.keepShiny")} desc={t("robo.pokes.keepShiny.desc")}>
            {sw(d.sell.keepShiny, () => editSell({ keepShiny: !d.sell.keepShiny }))}
          </Row>
          <Row title={t("robo.pokes.maxIv")} desc={t("robo.pokes.maxIv.desc", { n: d.sell.maxIv })}>
            <Slider value={d.sell.maxIv} min={0} max={IV_MAX} step={1} decimals={0} onChange={(n) => editSell({ maxIv: n })} />
          </Row>
          <Row title={t("robo.pokes.maxQuality")} desc={t("robo.pokes.maxQuality.desc", { n: d.sell.maxQuality.toFixed(2) })}>
            <Slider value={d.sell.maxQuality} min={0} max={QUALITY_MAX} step={QUALITY_STEP} decimals={2} onChange={(n) => editSell({ maxQuality: n })} />
          </Row>
        </div>
      </section>

      {/* ---- auto-compra de consumiveis ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="section-title flex items-center gap-2 text-yellow"><Pokeball size={13} /> {t("robo.autobuy.title")}</h3>
          <p className="mt-1.5 max-w-2xl text-[0.72rem] text-text-dim">{t("robo.autobuy.desc")}</p>
        </div>
        <div className="card flex flex-col gap-3 p-5">
          <Row title={t("robo.autobuy.toggle")} desc={t("robo.autobuy.toggleDesc")}>
            {sw(d.autobuy, () => edit({ autobuy: !d.autobuy }))}
          </Row>
          <p className="rounded border border-[color:var(--yellow)]/40 bg-[rgba(240,200,60,0.06)] px-3 py-2 text-[0.62rem] leading-relaxed text-yellow">{t("robo.autobuy.warn")}</p>
        </div>
      </section>
    </div>
  );
}
