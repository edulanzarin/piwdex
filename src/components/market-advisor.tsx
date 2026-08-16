"use client";

// Consultor de mercado — vive na area VIP (nao mais na aba Conta gratuita). Le o mercado
// ao vivo do jogo via /api/market e ranqueia por Power/IV/Quality reais dos anuncios.
// Cada card abre um modal com os stats base da especie (vindos do catalogo via `dex`).

import { useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { MarketMon, Currency } from "@/lib/game-account";
import type { PokeType, Rarity } from "@/lib/types";
import { buildBench, ivGrade, qualityGrade, monGrade, isBreedingStock, priceGrade, dealRatio, type Grade, type DealBench } from "@/lib/market-value";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges } from "./badges";
import { StatBar } from "./stat-bar";
import { Modal } from "./modal";
import { ToggleButton } from "./toggle-button";
import { useT } from "./locale-provider";
import { Star, Coin, Diamond } from "./icons";

// Cor de cada nota (genes, Quality ou preco): verde otimo, amarelo mediano, vermelho ruim.
const GRADE_VAR: Record<Grade, string> = { great: "var(--green)", ok: "var(--yellow)", bad: "var(--red)" };
const GRADE_TEXT: Record<Grade, string> = { great: "text-green", ok: "text-yellow", bad: "text-red" };

// Etiqueta colorida (contorno + fundo suave), boa nas tres cores sobre fundo escuro.
function GradeChip({ grade, label }: { grade: Grade; label: string }) {
  const c = GRADE_VAR[grade];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, border: `1px solid ${c}`, color: c }}
    >
      {label}
    </span>
  );
}

// "+35%" / "-18%" de custo-beneficio vs a mediana da moeda.
function dealPct(ratio: number): string {
  const p = Math.round((ratio - 1) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

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

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
      <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-sm font-bold tabular-nums">{children}</div>
    </div>
  );
}

function MarketMonModal({ mon, dex, bench, onClose }: { mon: MarketMon; dex?: MarketDex; bench: DealBench; onClose: () => void }) {
  const t = useT();
  const total = dex
    ? dex.baseHp + dex.baseAtk + dex.baseDef + dex.baseSpAtk + dex.baseSpDef + dex.baseSpeed
    : null;
  const best = dex ? Math.max(dex.baseHp, dex.baseAtk, dex.baseDef, dex.baseSpAtk, dex.baseSpDef, dex.baseSpeed) : 0;
  const genes = ivGrade(mon.ivTotal);
  const qual = qualityGrade(mon.quality);
  const deal = priceGrade(mon, bench);
  const ratio = dealRatio(mon, bench);
  const breeding = isBreedingStock(mon.quality) && genes === "great";

  return (
    <Modal onClose={onClose} className="w-full max-w-md gap-5 p-5">
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

        {/* Numeros reais do anuncio — 2 colunas fixas: cabem valores ate ~1 bilhao sem vazar */}
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("account.col.power")}><span className="text-yellow">{mon.power != null ? fmt(mon.power) : "—"}</span></Tile>
          <Tile label={t("account.col.iv")}>
            {mon.ivTotal != null ? <><span className={ivColor(mon.ivTotal)}>{mon.ivTotal}</span><span className="text-[0.62rem] text-text-dim">/192</span></> : "—"}
          </Tile>
          <Tile label={t("account.col.quality")}><span className={qual ? GRADE_TEXT[qual] : "text-cyan"}>{mon.quality != null ? mon.quality.toFixed(3) : "—"}</span></Tile>
          <Tile label={t("account.market.price")}><span className="text-text"><Price currency={mon.currency} value={mon.price} size={13} /></span></Tile>
        </div>

        {/* Veredito: genes (IV), Quality (Q) e preco (vale a pena). Quality manda na nota. */}
        {(genes || qual || deal) && (
          <div className="flex flex-col gap-2 rounded border border-border bg-[rgba(8,14,28,0.5)] p-3">
            <div className="pixel text-[0.62rem] text-purple">{t("account.market.verdict")}</div>
            {genes && (
              <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                <span className="text-text-dim">{t("account.market.genesLabel")}</span>
                <GradeChip grade={genes} label={t(`account.market.genes.${genes}`)} />
              </div>
            )}
            {qual && (
              <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                <span className="text-text-dim">{t("account.market.qualityLabel")}</span>
                <GradeChip grade={qual} label={t(`account.market.quality.${qual}`)} />
              </div>
            )}
            {deal && (
              <div className="flex items-center justify-between gap-2 text-[0.72rem]">
                <span className="text-text-dim">{t("account.market.dealLabel")}</span>
                <span className="flex items-center gap-2">
                  {ratio != null && <span className="tabular-nums text-text-dim">{t("account.market.dealVs", { p: dealPct(ratio) })}</span>}
                  <GradeChip grade={deal} label={t(`account.market.deal.${deal}`)} />
                </span>
              </div>
            )}
            {breeding && (
              <p className="border-t border-border pt-2 text-[0.62rem] leading-relaxed text-text-dim">{t("account.market.breedingNote")}</p>
            )}
          </div>
        )}

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
    </Modal>
  );
}

export function MarketAdvisor({ creatures, dex }: { creatures: ComboCreature[]; dex?: Record<number, MarketDex> }) {
  const t = useT();
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [maxGold, setMaxGold] = useState("");
  const [maxDiamonds, setMaxDiamonds] = useState("");
  const [minQ, setMinQ] = useState("");
  const [minIv, setMinIv] = useState("");
  const [shiny, setShiny] = useState(false);
  const [sort, setSort] = useState("potential");
  const [busy, setBusy] = useState(false);
  const [mons, setMons] = useState<MarketMon[] | null>(null);
  const [selected, setSelected] = useState<MarketMon | null>(null);

  // Baseline de custo-beneficio (mediana Power/preco por moeda) sobre os anuncios listados.
  const bench = useMemo(() => buildBench(mons ?? []), [mons]);

  const search = async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams();
      if (species) p.set("sp", String(species.pokeId));
      const g = numI(maxGold);
      const d = numI(maxDiamonds);
      if (g != null) p.set("maxGold", String(g));
      if (d != null) p.set("maxDiamonds", String(d));
      if (minQ) p.set("minQ", minQ);
      if (minIv) p.set("minIv", minIv);
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.minQuality")}</span>
            <select className="input" value={minQ} onChange={(e) => setMinQ(e.target.value)}>
              <option value="">{t("account.market.any")}</option>
              <option value="1.4">≥ 1.4</option>
              <option value="1.8">≥ 1.8</option>
              <option value="2.0">≥ 2.0</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.minIv")}</span>
            <select className="input" value={minIv} onChange={(e) => setMinIv(e.target.value)}>
              <option value="">{t("account.market.any")}</option>
              <option value="100">≥ 100</option>
              <option value="150">≥ 150</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t("account.market.sort")}</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="potential">{t("account.market.sort.potential")}</option>
              <option value="quality">{t("account.market.sort.quality")}</option>
              <option value="iv">{t("account.market.sort.iv")}</option>
              <option value="power">{t("account.market.sort.power")}</option>
              <option value="value">{t("account.market.sort.value")}</option>
              <option value="price">{t("account.market.sort.price")}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <ToggleButton active={shiny} onClick={() => setShiny((s) => !s)} accent="yellow">
            <Star size={13} /> {t("account.market.shiny")}
          </ToggleButton>
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
          {mons.map((m) => {
            const monG = monGrade(m.ivTotal, m.quality);
            const qualG = qualityGrade(m.quality);
            const dGrade = priceGrade(m, bench);
            return (
            <button
              key={m.listingId}
              type="button"
              onClick={() => setSelected(m)}
              className="card flex items-center gap-3 p-3 text-left transition hover:border-[color:var(--border-strong)] hover:bg-surface-2"
              style={monG ? { borderLeftColor: GRADE_VAR[monG], borderLeftWidth: 3 } : undefined}
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
                  {m.quality != null && <span>{t("account.col.quality")} <span className={qualG ? GRADE_TEXT[qualG] : "text-cyan"}>{m.quality.toFixed(3)}</span></span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pixel text-[0.7rem] text-text">
                  <Price currency={m.currency} value={m.price} />
                  {dGrade && <GradeChip grade={dGrade} label={t(`account.market.deal.${dGrade}`)} />}
                  {m.belowNpc && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>}
                </div>
              </div>
            </button>
            );
          })}
        </div>
      )}
      <p className="text-[0.6rem] italic text-text-dim">{t("account.market.legend")}</p>
      <p className="text-[0.6rem] italic text-text-dim">{t("account.market.hint")}</p>

      {selected && <MarketMonModal mon={selected} dex={dex?.[selected.speciesId]} bench={bench} onClose={() => setSelected(null)} />}
    </div>
  );
}
