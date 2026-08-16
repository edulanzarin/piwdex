"use client";

// Consultor de mercado — vive na area VIP (nao mais na aba Conta gratuita). Le o mercado
// ao vivo do jogo via /api/market e ranqueia por Power/IV/Quality reais dos anuncios.

import { useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { MarketMon } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Star } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => { const v = parseInt(s.replace(/\D/g, ""), 10); return Number.isFinite(v) ? v : null; };
const ivColor = (v: number | null) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

export function MarketAdvisor({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [maxGold, setMaxGold] = useState("");
  const [maxDiamonds, setMaxDiamonds] = useState("");
  const [shiny, setShiny] = useState(false);
  const [sort, setSort] = useState("power");
  const [busy, setBusy] = useState(false);
  const [mons, setMons] = useState<MarketMon[] | null>(null);

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
            <div key={m.listingId} className="card flex items-center gap-3 p-3">
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
                  <span className="text-text-dim">{m.currency === "DIAMONDS" ? "◆" : "$"}</span>{fmt(m.price)}
                  {m.belowNpc && <span className="ml-1 chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[0.6rem] italic text-text-dim">{t("account.market.hint")}</p>
    </div>
  );
}
