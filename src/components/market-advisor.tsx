"use client";

// Consultor de mercado — vive na area VIP (nao mais na aba Conta gratuita). Le o mercado
// ao vivo do jogo via /api/market e ranqueia por Power/IV/Quality reais dos anuncios.
// Cada card abre um modal com os stats base da especie (vindos do catalogo via `dex`).

import { useEffect, useState } from "react";
import { assetIconUrl } from "@/lib/sprites";
import { spriteUrl } from "@/lib/sprites";
import type { MarketMon, Currency } from "@/lib/game-account";
import type { PokeType, Rarity } from "@/lib/types";
import { ivGrade, qualityGrade, monGrade, isBreedingStock, priceGrade, dealPct, type Grade } from "@/lib/market-value";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges, RarityBadge } from "./badges";
import { TypeFilter } from "./type-filter";
import { StatBar } from "./stat-bar";
import { MonStatsSection } from "./mon-stats";
import { Modal } from "./modal";
import { Pagination } from "./pagination";
import { Field, ShinyToggle } from "./filter-field";
import { ToggleButton } from "./toggle-button";
import { SelectMenu } from "./select-menu";
import { StatTile } from "./stat-tile";
import { CloseButton } from "./icon-button";
import { useToast } from "./toast";
import { useT } from "./locale-provider";
import { Panel } from "./ui/panel";
import { EmptyState } from "./ui/feed";
import { Star, Coin, Diamond, ChevronRight, Dollar, Loot, Check } from "./icons";

// Cor de cada nota (genes, Quality ou preco): verde otimo, amarelo mediano, vermelho ruim.
const GRADE_VAR: Record<Grade, string> = { great: "var(--green)", ok: "var(--yellow)", bad: "var(--red)" };
const GRADE_TEXT: Record<Grade, string> = { great: "text-green", ok: "text-yellow", bad: "text-red" };

// Etiqueta colorida (contorno + fundo suave), boa nas tres cores sobre fundo escuro.
function GradeChip({ grade, label }: { grade: Grade; label: string }) {
  const c = GRADE_VAR[grade];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, border: `1px solid ${c}`, color: c }}
    >
      {label}
    </span>
  );
}

// "+35%" / "-18%": o quanto o preco foge do justo (negativo = mais barato).
function fmtPct(p: number): string {
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
        : <span className="text-green"><Coin size={size} /></span>}
      {fmt(value)}
    </span>
  );
}

const STATS: readonly [string, keyof MarketDex][] = [
  ["HP", "baseHp"], ["ATK", "baseAtk"], ["DEF", "baseDef"],
  ["SP.ATK", "baseSpAtk"], ["SP.DEF", "baseSpDef"], ["SPEED", "baseSpeed"],
] as const;

// Mini-tile de numero do anuncio: rotulo + valor, no poco padrao (.well via StatTile).
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return <StatTile label={label} value={<span className="flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]">{children}</span>} />;
}

// Card de um anuncio do mercado — reusado no consultor E dentro de cada Desejo (aba
// Desejos), pra o achado mostrar a MESMA leitura: borda por nota (Q pesa mais que IV),
// etiqueta de preco (BARATO/JUSTO/CARO vs justo) e abaixo do NPC. `right` injeta um
// canto (ex.: o ✕ de recusar) sem quebrar o layout.
export function MarketMonCard({ mon, onClick, right, rarity }: { mon: MarketMon; onClick: () => void; right?: React.ReactNode; rarity?: Rarity }) {
  const t = useT();
  const monG = monGrade(mon.ivTotal, mon.quality);
  const qualG = qualityGrade(mon.quality);
  const dGrade = priceGrade(mon.price, mon.fairPrice ?? null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-[color:var(--border-strong)] hover:bg-surface-2"
        style={monG ? { borderLeftColor: GRADE_VAR[monG], borderLeftWidth: 3 } : undefined}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
          <Sprite src={spriteUrl(mon.speciesId, mon.shiny)} alt={mon.name} size={48} />
          {mon.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={11} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="pixel truncate text-base">{mon.name}</span>
            <span className="text-sm text-text-dim">Lv.{mon.level}</span>
            {rarity && <RarityBadge rarity={rarity} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-text-dim">
            {mon.power != null && <span>{t("account.col.power")} <span className="text-yellow">{fmt(mon.power)}</span></span>}
            {mon.ivTotal != null && <span>{t("account.col.iv")} <span className={ivColor(mon.ivTotal)}>{mon.ivTotal}</span>/192</span>}
            {mon.quality != null && <span>{t("account.col.quality")} <span className={qualG ? GRADE_TEXT[qualG] : "text-cyan"}>{mon.quality.toFixed(3)}</span></span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pixel text-base text-text">
            <Price currency={mon.currency} value={mon.price} />
            {dGrade && <GradeChip grade={dGrade} label={t(`account.market.deal.${dGrade}`)} />}
            {mon.belowNpc && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>}
          </div>
        </div>
      </button>
      {right && <div className="absolute right-2 top-2 z-10">{right}</div>}
    </div>
  );
}

// Uma pilha de item do mercado, como a API /api/market?kind=items devolve.
export interface MarketItemRow {
  listingId: string;
  kind: string;
  refId: number;
  name: string;
  icon: string; // caminho do catalogo local (assetIconUrl resolve)
  category: string;
  quantity: number;
  price: number; // UNITARIO
  currency: Currency;
  belowNpc: boolean;
  sellers: number;
  npcPrice?: number | null;
}

// POST de compra (rota VIP reconfere anuncio e preco antes de gastar). Devolve msg de erro
// legivel ou null no sucesso.
async function postBuy(body: Record<string, unknown>, t: (k: string, v?: Record<string, string | number>) => string): Promise<string | null> {
  try {
    const r = await fetch("/api/vip/market-buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (j.error === "price_changed" || j.error === "listing_gone") return t("market.buy.gone");
    if (j.error === "not_enough") return t("market.buy.notEnough");
    return t("market.buy.refused");
  } catch { return t("toast.err"); }
}

/** Modal de compra de uma PILHA de item: quantidade + total, confirmacao explicita. */
export function BuyItemModal({ item, onClose, onBought }: { item: MarketItemRow; onClose: () => void; onBought?: () => void }) {
  const t = useT();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const clamp = (n: number) => Math.min(item.quantity, Math.max(1, Math.floor(n) || 1));
  const total = item.price * clamp(qty);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const err = await postBuy({ kind: "item", refId: item.refId, price: item.price, currency: item.currency, quantity: clamp(qty) }, t);
    setBusy(false);
    if (err) { toast.error(err); return; }
    toast.success(t("market.buy.ok"));
    onBought?.();
    onClose();
  };
  return (
    <Modal onClose={onClose} className="w-full max-w-sm gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
          {item.icon ? <Sprite src={assetIconUrl(item.icon)} alt={item.name} size={36} /> : <Loot size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate pixel text-base text-text">{item.name}</h3>
          <div className="text-sm text-text-dim">
            <Price currency={item.currency} value={item.price} size={11} /> {t("market.it.unit")} · x{fmt(item.quantity)}
          </div>
        </div>
        <CloseButton onClick={onClose} className="shrink-0 self-start" />
      </div>
      <label className="flex flex-col gap-1">
        <span className="field-label">{t("market.buy.qty")}</span>
        <input type="number" min={1} max={item.quantity} value={qty}
          onChange={(e) => setQty(clamp(Number(e.target.value)))} className="input" />
      </label>
      <div className="flex items-center justify-between rounded border border-border bg-[var(--well-bg)] px-3 py-2">
        <span className="field-label">{t("market.buy.total")}</span>
        <span className="pixel text-lg"><Price currency={item.currency} value={total} size={13} /></span>
      </div>
      <button type="button" onClick={() => void confirm()} disabled={busy} className="btn btn-green disabled:opacity-40">
        <Check size={11} /> {busy ? "…" : t("market.buy.confirm")}
      </button>
    </Modal>
  );
}

export function MarketMonModal({ mon, dex, onClose, onBought }: { mon: MarketMon; dex?: MarketDex; onClose: () => void; onBought?: () => void }) {
  const t = useT();
  const toast = useToast();
  // compra em duas etapas: botao -> confirmacao explicita com o preco
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const buyable = mon.price > 0 && mon.listingId !== "" && mon.listingId !== "chat-link";
  const doBuy = async () => {
    if (busy) return;
    setBusy(true);
    const err = await postBuy({ kind: "pokemon", id: mon.listingId, price: mon.price, currency: mon.currency }, t);
    setBusy(false);
    if (err) { toast.error(err); setConfirming(false); return; }
    toast.success(t("market.buy.ok"));
    onBought?.();
    onClose();
  };
  const total = dex
    ? dex.baseHp + dex.baseAtk + dex.baseDef + dex.baseSpAtk + dex.baseSpDef + dex.baseSpeed
    : null;
  const best = dex ? Math.max(dex.baseHp, dex.baseAtk, dex.baseDef, dex.baseSpAtk, dex.baseSpDef, dex.baseSpeed) : 0;
  const genes = ivGrade(mon.ivTotal);
  const qual = qualityGrade(mon.quality);
  const fair = mon.fairPrice ?? null;
  const deal = priceGrade(mon.price, fair);
  const pct = dealPct(mon.price, fair);
  const breeding = isBreedingStock(mon.quality) && genes === "great";

  return (
    <Modal onClose={onClose} className="w-full max-w-md gap-5 p-5">
        {/* Cabecalho */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
            <Sprite src={spriteUrl(mon.speciesId, mon.shiny)} alt={mon.name} size={72} />
            {mon.shiny && <span className="absolute right-1 top-1 text-yellow"><Star size={13} /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate pixel text-base text-text">{mon.name}</h3>
              <span className="text-sm text-text-dim">Lv.{mon.level}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {dex ? <TypeBadges t1={dex.type1} t2={dex.type2} /> : mon.type1 ? <TypeBadges t1={mon.type1 as PokeType} t2={null} /> : null}
              {dex && <RarityBadge rarity={dex.rarity} />}
              {mon.belowNpc && (
                <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>
              )}
            </div>
          </div>
          <CloseButton onClick={onClose} className="shrink-0 self-start" />
        </div>

        {/* Numeros reais do anuncio — 2 colunas fixas: cabem valores ate ~1 bilhao sem vazar.
            price <= 0 = nao veio preco (ex.: pokemon LINKADO no chat): esconde o tile. */}
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("account.col.power")}><span className="text-yellow">{mon.power != null ? fmt(mon.power) : "—"}</span></Tile>
          <Tile label={t("account.col.iv")}>
            {mon.ivTotal != null ? <><span className={ivColor(mon.ivTotal)}>{mon.ivTotal}</span><span className="text-sm text-text-dim">/192</span></> : "—"}
          </Tile>
          <Tile label={t("account.col.quality")}><span className={qual ? GRADE_TEXT[qual] : "text-cyan"}>{mon.quality != null ? mon.quality.toFixed(3) : "—"}</span></Tile>
          {mon.price > 0 && (
            <Tile label={t("account.market.price")}><span className="text-text"><Price currency={mon.currency} value={mon.price} size={13} /></span></Tile>
          )}
          {/* bicho sem preco (ex.: linkado no chat): mostra quanto VALERIA pelo motor de
              preco justo (teto x mediana do mercado) — chega async, dai o tile condicional */}
          {mon.price <= 0 && fair != null && (
            <Tile label={t("account.market.worth")}>
              <span className="inline-flex items-center gap-1 text-text"><span className="opacity-70">~</span><Price currency={mon.currency} value={fair} size={13} /></span>
            </Tile>
          )}
        </div>

        {/* Veredito: genes (IV), Quality (Q) e preco (vale a pena). Quality manda na nota. */}
        {(genes || qual || deal) && (
          <div className="flex flex-col gap-2 rounded border border-border bg-[var(--well-bg)] p-3">
            <div className="section-title text-purple">{t("account.market.verdict")}</div>
            {genes && (
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="text-text-dim">{t("account.market.genesLabel")}</span>
                <GradeChip grade={genes} label={t(`account.market.genes.${genes}`)} />
              </div>
            )}
            {qual && (
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="text-text-dim">{t("account.market.qualityLabel")}</span>
                <GradeChip grade={qual} label={t(`account.market.quality.${qual}`)} />
              </div>
            )}
            {deal && (
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="text-text-dim">{t("account.market.dealLabel")}</span>
                <span className="flex items-center gap-2">
                  {pct != null && <span className="tabular-nums text-text-dim">{t("account.market.dealVs", { p: fmtPct(pct) })}</span>}
                  <GradeChip grade={deal} label={t(`account.market.deal.${deal}`)} />
                </span>
              </div>
            )}
            {/* so pra anuncio com preco: no bicho do chat o valor ja esta no tile "valeria" */}
            {fair != null && mon.price > 0 && (
              <div className="flex items-center justify-between gap-2 text-sm text-text-dim">
                <span>{t("account.market.fairPrice")}</span>
                <span className="inline-flex items-center gap-1"><span className="opacity-70">~</span><Price currency={mon.currency} value={fair} /></span>
              </div>
            )}
            {breeding && (
              <p className="border-t border-border pt-2 text-sm leading-relaxed text-text-dim">{t("account.market.breedingNote")}</p>
            )}
          </div>
        )}

        {/* Stats REAIS do individuo a venda (o anuncio ja traz); sem eles, cai nos base
            da especie. Com dex + qualidade, cada barra compara com o perfeito (IV 32). */}
        {mon.stats ? (
          <MonStatsSection
            stats={mon.stats}
            bases={dex ? [dex.baseHp, dex.baseAtk, dex.baseDef, dex.baseSpAtk, dex.baseSpDef, dex.baseSpeed] : null}
            level={mon.level}
            quality={mon.quality}
          />
        ) : dex && (
          <div className="flex flex-col gap-2.5">
            <div className="section-title text-cyan">{t("cr.statsBase")}</div>
            {STATS.map(([label, key], i) => (
              <StatBar key={key} iconIndex={i} label={label} value={dex[key] as number} best={(dex[key] as number) === best} />
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-sm uppercase tracking-wide text-text-dim">{t("cr.total")}</span>
              <strong className="tabular-nums text-cyan">{total}</strong>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {buyable && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-green">
              {t("market.buy.for")} <Price currency={mon.currency} value={mon.price} size={11} />
            </button>
          )}
          {buyable && confirming && (
            <>
              <button type="button" onClick={() => void doBuy()} disabled={busy} className="btn btn-green disabled:opacity-40">
                <Check size={11} /> {busy ? "…" : t("market.buy.confirm")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="btn btn-ghost disabled:opacity-40">{t("market.buy.cancel")}</button>
            </>
          )}
          <a href={`/dex/${mon.speciesId}`} className="btn btn-cyan ms-auto">{t("account.market.viewDex")} <ChevronRight size={10} /></a>
        </div>
    </Modal>
  );
}

/** Card de uma pilha de item do mercado: icone + nome + categoria, preco unitario,
 *  estoque/vendedores e o botao Comprar. */
function MarketItemCard({ item, onBuy }: { item: MarketItemRow; onBuy: () => void }) {
  const t = useT();
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
        {item.icon ? <Sprite src={assetIconUrl(item.icon)} alt={item.name} size={34} /> : <Loot size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="pixel truncate text-base">{item.name}</span>
          <span className="text-xs uppercase text-text-dim">{item.category}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-text-dim">
          <span className="pixel text-base text-text"><Price currency={item.currency} value={item.price} size={11} /> <span className="text-text-dim">{t("market.it.unit")}</span></span>
          <span>x{fmt(item.quantity)}</span>
          <span>{t("market.it.sellers", { n: item.sellers })}</span>
          {item.npcPrice != null && item.npcPrice > 0 && <span>NPC {fmt(item.npcPrice)}</span>}
          {item.belowNpc && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>}
        </div>
      </div>
      <button type="button" onClick={onBuy} className="btn btn-green shrink-0">{t("market.buy")}</button>
    </div>
  );
}

export function MarketAdvisor({
  creatures,
  dex,
  focus,
}: {
  creatures: ComboCreature[];
  dex?: Record<number, MarketDex>;
  focus?: { speciesId: number; nonce: number } | null; // pulo vindo de um alerta clicado
}) {
  const t = useT();
  const [tab, setTab] = useState<"pokemon" | "items">("pokemon");
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [type, setType] = useState<PokeType | "">("");
  const [maxGold, setMaxGold] = useState("");
  const [maxDiamonds, setMaxDiamonds] = useState("");
  const [minQ, setMinQ] = useState("");
  const [minIv, setMinIv] = useState("");
  const [shiny, setShiny] = useState(false);
  const [sort, setSort] = useState("potential");
  const [busy, setBusy] = useState(false);
  const [mons, setMons] = useState<MarketMon[] | null>(null);
  const [selected, setSelected] = useState<MarketMon | null>(null);
  const [page, setPage] = useState(0);
  // ---- aba ITENS ----
  const [itQ, setItQ] = useState("");
  const [itCat, setItCat] = useState("");
  const [itCurrency, setItCurrency] = useState("");
  const [itSort, setItSort] = useState("price");
  const [itBelowNpc, setItBelowNpc] = useState(false);
  const [itBusy, setItBusy] = useState(false);
  const [itRows, setItRows] = useState<MarketItemRow[] | null>(null);
  const [itPage, setItPage] = useState(0);
  const [buyItem, setBuyItem] = useState<MarketItemRow | null>(null);

  const searchItems = async () => {
    setItBusy(true);
    try {
      const p = new URLSearchParams({ kind: "items", sort: itSort });
      if (itQ.trim()) p.set("q", itQ.trim());
      if (itCat) p.set("cat", itCat);
      if (itCurrency) p.set("currency", itCurrency);
      if (itBelowNpc) p.set("belowNpc", "1");
      const res = await fetch(`/api/market?${p.toString()}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { items?: MarketItemRow[] };
      setItRows(j.items ?? []);
      setItPage(0);
    } catch { setItRows([]); setItPage(0); } finally { setItBusy(false); }
  };

  const PAGE_SIZE = 12;
  const pageCount = mons ? Math.max(1, Math.ceil(mons.length / PAGE_SIZE)) : 1;
  const paged = mons ? mons.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : [];

  const search = async (over?: ComboCreature | null) => {
    const sp = over === undefined ? species : over;
    if (over !== undefined) setSpecies(over);
    setBusy(true);
    try {
      const p = new URLSearchParams();
      if (sp) p.set("sp", String(sp.pokeId));
      if (type) p.set("type", type);
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
      setPage(0);
    } catch {
      setMons([]);
      setPage(0);
    } finally {
      setBusy(false);
    }
  };

  // Clique num alerta de snipe pula pra ca com a especie ja buscada.
  useEffect(() => {
    if (!focus?.speciesId) return;
    search(creatures.find((c) => c.pokeId === focus.speciesId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-purple">{t("account.market.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("account.market.desc")}</p>
        </div>
        {/* abas: pokemon | itens — mesmo mercado do jogo, duas vitrines */}
        <div className="flex gap-1">
          <button type="button" onClick={() => setTab("pokemon")} className={`tab ${tab === "pokemon" ? "tab-active" : ""}`}>{t("market.tab.pokemon")}</button>
          <button type="button" onClick={() => { setTab("items"); if (itRows == null) void searchItems(); }} className={`tab ${tab === "items" ? "tab-active" : ""}`}>{t("market.tab.items")}</button>
        </div>
      </div>

      {tab === "items" ? (() => {
        const IT_PAGE = 14;
        const itPages = itRows ? Math.max(1, Math.ceil(itRows.length / IT_PAGE)) : 1;
        const itPaged = itRows ? itRows.slice(itPage * IT_PAGE, itPage * IT_PAGE + IT_PAGE) : [];
        return (
          <>
            <Panel icon={<Loot size={12} />} accent="var(--green)" title={t("robo.caught.filters")} className="z-20 p-5" bodyClassName="gap-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="flex flex-col gap-1">
                  <span className="field-label">{t("market.it.q")}</span>
                  <input className="input" value={itQ} onChange={(e) => setItQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void searchItems(); }} placeholder={t("market.it.qPh")} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="field-label">{t("market.it.cat")}</span>
                  <SelectMenu value={itCat} onChange={setItCat} className="" options={[
                    { value: "", label: t("market.it.anyCat") },
                    { value: "Items", label: "Items" },
                    { value: "Stones", label: "Stones" },
                    { value: "Poke Balls", label: "Poke Balls" },
                    { value: "Diamonds", label: "Diamonds" },
                  ]} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="field-label">{t("market.it.currency")}</span>
                  <SelectMenu value={itCurrency} onChange={setItCurrency} className="" options={[
                    { value: "", label: t("market.it.anyCurrency") },
                    { value: "GOLD", label: t("market.it.gold") },
                    { value: "DIAMONDS", label: t("market.it.diamonds") },
                  ]} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="field-label">{t("account.market.sort")}</span>
                  <SelectMenu value={itSort} onChange={setItSort} className="" options={[
                    { value: "price", label: t("market.it.sort.price") },
                    { value: "recent", label: t("market.it.sort.recent") },
                    { value: "qty", label: t("market.it.sort.qty") },
                  ]} />
                </label>
                <Field label={t("alerts.f.filters")}>
                  <ToggleButton active={itBelowNpc} onClick={() => setItBelowNpc((v) => !v)} accent="green">
                    {t("account.market.belowNpc")}
                  </ToggleButton>
                </Field>
              </div>
              <div className="flex items-center justify-end">
                <button type="button" onClick={() => void searchItems()} disabled={itBusy} className="btn btn-green disabled:opacity-40">
                  {itBusy ? `${t("account.market.searching")}...` : <>{t("account.market.search")} <ChevronRight size={10} /></>}
                </button>
              </div>
            </Panel>

            {itBusy ? (
              <div className="card p-6"><LoadingBall label={t("account.market.searching")} /></div>
            ) : itRows == null ? null : itRows.length === 0 ? (
              <div className="card p-4"><EmptyState message={t("account.market.empty")} /></div>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {itPaged.map((i) => <MarketItemCard key={`${i.refId}:${i.currency}:${i.price}`} item={i} onBuy={() => setBuyItem(i)} />)}
              </div>
            )}
            {itRows && itRows.length > IT_PAGE && <Pagination page={itPage} pageCount={itPages} onPage={setItPage} />}
            {buyItem && <BuyItemModal item={buyItem} onClose={() => setBuyItem(null)} onBought={() => void searchItems()} />}
          </>
        );
      })() : (
      <>
      <Panel icon={<Dollar size={12} />} accent="var(--purple)" title={t("robo.caught.filters")} className="z-20 p-5" bodyClassName="gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Especie e Tipo sao mutuamente exclusivos: uma especie ja e de um tipo so.
              Escolher um zera o outro. */}
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="field-label">{t("account.market.species")}</span>
            <PokemonCombobox
              creatures={creatures}
              value={species}
              onSelect={(c) => { setSpecies(c); if (c) setType(""); }}
              placeholder={t("account.market.anySpecies")}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.type")}</span>
            <TypeFilter value={type} onChange={(tp) => { setType(tp); if (tp) setSpecies(null); }} className="" />
          </div>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.maxGold")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.maxDiamonds")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxDiamonds} onChange={(e) => setMaxDiamonds(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.minQuality")}</span>
            <SelectMenu
              value={minQ}
              onChange={setMinQ}
              className=""
              options={[
                { value: "", label: t("account.market.any") },
                { value: "1.4", label: "≥ 1.4" },
                { value: "1.8", label: "≥ 1.8" },
                { value: "2.0", label: "≥ 2.0" },
              ]}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.minIv")}</span>
            <SelectMenu
              value={minIv}
              onChange={setMinIv}
              className=""
              options={[
                { value: "", label: t("account.market.any") },
                { value: "100", label: "≥ 100" },
                { value: "150", label: "≥ 150" },
              ]}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("account.market.sort")}</span>
            <SelectMenu
              value={sort}
              onChange={setSort}
              className=""
              options={[
                { value: "potential", label: t("account.market.sort.potential") },
                { value: "quality", label: t("account.market.sort.quality") },
                { value: "iv", label: t("account.market.sort.iv") },
                { value: "power", label: t("account.market.sort.power") },
                { value: "value", label: t("account.market.sort.value") },
                { value: "price", label: t("account.market.sort.price") },
              ]}
            />
          </label>
          <Field label={t("alerts.f.filters")}>
            <ShinyToggle active={shiny} onChange={setShiny} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => search()} disabled={busy} className="btn btn-cyan disabled:opacity-40">
            {busy ? `${t("account.market.searching")}...` : <>{t("account.market.search")} <ChevronRight size={10} /></>}
          </button>
        </div>
      </Panel>

      {busy ? (
        <div className="card p-6"><LoadingBall label={t("account.market.searching")} /></div>
      ) : mons == null ? null : mons.length === 0 ? (
        <div className="card p-4"><EmptyState message={t("account.market.empty")} /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((m) => (
            <MarketMonCard key={m.listingId} mon={m} rarity={dex?.[m.speciesId]?.rarity} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}
      {mons && mons.length > PAGE_SIZE && <Pagination page={page} pageCount={pageCount} onPage={setPage} />}
      <div className="rounded border border-border bg-[var(--well-bg)] px-3 py-2 text-sm leading-relaxed text-text-dim">
        {t("account.market.legend")} {t("account.market.hint")}
      </div>

      {selected && <MarketMonModal mon={selected} dex={dex?.[selected.speciesId]} onClose={() => setSelected(null)} onBought={() => void search()} />}
      </>
      )}
    </div>
  );
}

