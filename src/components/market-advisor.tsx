"use client";

// Consultor de mercado — vive na area VIP (nao mais na aba Conta gratuita). Le o mercado
// ao vivo do jogo via /api/market e ranqueia por Power/IV/Quality reais dos anuncios.
// Cada card abre um modal com os stats base da especie (vindos do catalogo via `dex`).

import { useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { MarketMon, Currency } from "@/lib/game-account";
import type { PokeType, Rarity } from "@/lib/types";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { useT } from "./locale-provider";
import { Star, Coin, Diamond } from "./icons";

// Stats base da especie (do catalogo) — o que o modal precisa alem do anuncio.
export interface MarketDex {
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpeed: number;
  huntLevel: number;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => { const v = parseInt(s.replace(/\D/g, ""), 10); return Number.isFinite(v) ? v : null; };
const ivColor = (v: number | null) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

// Preco com icone pixel da moeda (nada de "◆" que vira bolinha) — dolar dourado, diamante ciano.
function Price({ currency, value, size = 12 }: { currency: Currency; value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {currency === "DIAMONDS"
        ? <span className="text-cyan"><Diamond size={size} /></span>
        : <span className="text-yellow"><Coin size={size} /></span>}
      {fmt(value)}
    </span>
  );
}

const STATS: readonly [string, keyof MarketDex][] = [
  ["HP", "baseHp"], ["ATK", "baseAtk"], ["DEF", "baseDef"],
  ["SP.ATK", "baseSpAtk"], ["SP.DEF", "baseSpDef"], ["SPEED", "baseSpeed"],
] as const;
const MAX_STAT = 200;

function StatBar({ label, value, best, iconIndex }: { label: string; value: number; best: boolean; iconIndex: number }) {
  const pct = Math.min(100, (value / MAX_STAT) * 100);
  const hue = Math.round((Math.min(value, MAX_STAT) / MAX_STAT) * 130);
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-16 shrink-0 items-center gap-1.5 text-[0.58rem] uppercase tracking-wide text-text-dim">
        <StatIcon index={iconIndex} size={12} />{label}
      </div>
      <div className={`w-8 shrink-0 text-right text-sm font-bold tabular-nums ${best ? "text-yellow" : ""}`}>{value}</div>
      <div className="statbar flex-1">
        <div className="statbar-fill" style={{ width: `${pct}%`, background: `hsl(${hue} 68% 48%)` }} />
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
      <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums">{children}</div>
    </div>
  );
}

function MarketMonModal({ mon, dex, onClose }: { mon: MarketMon; dex?: MarketDex; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = dex
    ? dex.baseHp + dex.baseAtk + dex.baseDef + dex.baseSpAtk + dex.baseSpDef + dex.baseSpeed
    : null;
  const best = dex ? Math.max(dex.baseHp, dex.baseAtk, dex.baseDef, dex.baseSpAtk, dex.baseSpDef, dex.baseSpeed) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="card flex max-h-[88vh] w-full max-w-md flex-col gap-5 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
            <Sprite src={spriteUrl(mon.speciesId, mon.shiny)} alt={mon.name} size={72} />
            {mon.shiny && <span className="absolute right-1 top-1 text-yellow"><Star size={13} /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate pixel text-[0.9rem] text-text">{mon.name}</h3>
              <span className="text-[0.62rem] text-text-dim">Lv.{mon.level}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {dex ? <TypeBadges t1={dex.type1} t2={dex.type2} /> : mon.type1 ? <TypeBadges t1={mon.type1 as PokeType} t2={null} /> : null}
              {mon.belowNpc && (
                <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="fechar" className="shrink-0 self-start rounded p-1 text-text-dim hover:bg-surface-2 hover:text-text">✕</button>
        </div>

        {/* Numeros reais do anuncio */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label={t("account.col.power")}><span className="text-yellow">{mon.power != null ? fmt(mon.power) : "—"}</span></Tile>
          <Tile label={t("account.col.iv")}>
            {mon.ivTotal != null ? <><span className={ivColor(mon.ivTotal)}>{mon.ivTotal}</span><span className="text-[0.62rem] text-text-dim">/192</span></> : "—"}
          </Tile>
          <Tile label={t("account.col.quality")}><span className="text-cyan">{mon.quality != null ? mon.quality.toFixed(3) : "—"}</span></Tile>
          <Tile label={t("account.market.price")}><span className="text-text"><Price currency={mon.currency} value={mon.price} size={13} /></span></Tile>
        </div>

        {/* Stats base da especie */}
        {dex && (
          <div className="flex flex-col gap-2.5">
            <div className="pixel text-[0.62rem] text-cyan">{t("cr.statsBase")}</div>
            {STATS.map(([label, key], i) => (
              <StatBar key={key} iconIndex={i} label={label} value={dex[key] as number} best={(dex[key] as number) === best} />
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{t("cr.total")}</span>
              <strong className="tabular-nums text-cyan">{total}</strong>
            </div>
          </div>
        )}

        <a href={`/dex/${mon.speciesId}`} className="btn btn-cyan self-start">{t("account.market.viewDex")} ›</a>
      </div>
    </div>
  );
}

export function MarketAdvisor({ creatures, dex }: { creatures: ComboCreature[]; dex?: Record<number, MarketDex> }) {
  const t = useT();
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [maxGold, setMaxGold] = useState("");
  const [maxDiamonds, setMaxDiamonds] = useState("");
  const [shiny, setShiny] = useState(false);
  const [sort, setSort] = useState("power");
  const [busy, setBusy] = useState(false);
  const [mons, setMons] = useState<MarketMon[] | null>(null);
  const [selected, setSelected] = useState<MarketMon | null>(null);

  const search = async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams();
      if (species) p.set("sp", String(species.pokeId));
      const g = numI(maxGold);
      const d = numI(maxDiamonds);
      if (g != null) p.set("maxGold", String(g));
      if (d != null) p.set("maxDiamonds", String(d));
      if (shiny) p.set("shiny", "1");
      p.set("sort", sort);
      const res = await fetch(`/api/market?${p.toString()}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { mons?: MarketMon[] };
      setMons(j.mons ?? []);
    } catch {
      setMons([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel text-[0.8rem] text-purple">{t("account.market.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("account.market.desc")}</p>
      </div>
      <div className="card flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.species")}</span>
            <PokemonCombobox creatures={creatures} value={species} onSelect={setSpecies} placeholder={t("account.market.anySpecies")} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.maxGold")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.maxDiamonds")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxDiamonds} onChange={(e) => setMaxDiamonds(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.sort")}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="power">{t("account.market.sort.power")}</option>
              <option value="value">{t("account.market.sort.value")}</option>
              <option value="price">{t("account.market.sort.price")}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[0.72rem] text-text-dim">
            <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} className="h-4 w-4 accent-[color:var(--yellow)]" />
            <span className="inline-flex items-center gap-1"><span className="text-yellow"><Star /></span>{t("account.market.shiny")}</span>
          </label>
          <button type="button" onClick={search} disabled={busy} className="btn btn-cyan disabled:opacity-40">
            {busy ? `${t("account.market.searching")}...` : `${t("account.market.search")} ›`}
          </button>
        </div>
      </div>

      {busy ? (
        <div className="card p-6"><LoadingBall label={t("account.market.searching")} /></div>
      ) : mons == null ? null : mons.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-dim">{t("account.market.empty")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mons.map((m) => (
            <button
              key={m.listingId}
              type="button"
              onClick={() => setSelected(m)}
              className="card flex items-center gap-3 p-3 text-left transition hover:border-[color:var(--border-strong)] hover:bg-surface-2"
            >
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
                <Sprite src={spriteUrl(m.speciesId, m.shiny)} alt={m.name} size={48} />
                {m.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={11} /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{m.name}</span>
                  <span className="text-[0.58rem] text-text-dim">Lv.{m.level}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.62rem] text-text-dim">
                  {m.power != null && <span>{t("account.col.power")} <span className="text-yellow">{fmt(m.power)}</span></span>}
                  {m.ivTotal != null && <span>{t("account.col.iv")} <span className={ivColor(m.ivTotal)}>{m.ivTotal}</span>/192</span>}
                  {m.quality != null && <span>{t("account.col.quality")} <span className="text-cyan">{m.quality.toFixed(3)}</span></span>}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 pixel text-[0.7rem] text-text">
                  <Price currency={m.currency} value={m.price} />
                  {m.belowNpc && <span className="ml-1 chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="text-[0.6rem] italic text-text-dim">{t("account.market.hint")}</p>

      {selected && <MarketMonModal mon={selected} dex={dex?.[selected.speciesId]} onClose={() => setSelected(null)} />}
    </div>
  );
}
