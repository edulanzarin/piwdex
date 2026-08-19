"use client";

// Aba Desejos (VIP): a lista de pokemon que voce quer que o piwdex vigie no mercado, e —
// dentro de cada desejo — os pokemon ACHADOS por ele. Cada achado abre o modal do
// Mercado (mesmo do consultor) e pode ser recusado ali. O resumo "N achados" fica na
// aba Alertas; aqui e o detalhe. A watchlist (CRUD) continua via fetch; os achados
// chegam AO VIVO pelo stream (useVipLive) — pokemon novo aparece sem F5.

import { useEffect, useMemo, useRef, useState } from "react";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import type { Watchlist } from "@/lib/alerts";
import type { Currency, MarketMon } from "@/lib/game-account";
import type { Rarity, PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { Pagination } from "./pagination";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { ToggleButton } from "./toggle-button";
import { ShinyToggle } from "./filter-field";
import { SelectMenu } from "./select-menu";
import { CloseButton } from "./icon-button";
import { TypeFilter } from "./type-filter";
import { TypeIcon } from "./type-icon";
import { TYPE_COLOR } from "@/lib/typing";
import { MarketMonModal, MarketMonCard, BuyItemModal, type MarketDex, type MarketItemRow } from "./market-advisor";
import { useT, useTypeLabel } from "./locale-provider";
import { Star, Heart, ChevronRight, Loot, Caret } from "./icons";
import { useVipLive, type LiveNotification } from "./vip-live";

// Linha densa de numeros do card: altura fechada, nunca quebra e ROLA na horizontal
// quando o card fica estreito (celular) — mesmo dialeto do card do mercado.
const METAROW = "flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => {
  const v = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : null;
};

// Item do catalogo pro seletor de desejo de item.
export interface WishItem { id: number; name: string; icon: string }

// Remonta a pilha de item a partir do alerta (pro card do achado e pra COMPRA).
function itemFromNotif(n: LiveNotification, iconOf: (id: number) => string): MarketItemRow {
  const d = (n.data ?? {}) as Record<string, unknown>;
  return {
    listingId: String(d.listingId ?? n.id),
    kind: String(d.itemKind ?? "item"),
    refId: Number(d.itemId ?? 0),
    name: String(d.name ?? "?"),
    icon: iconOf(Number(d.itemId ?? 0)) || String(d.icon ?? ""),
    category: String(d.category ?? ""),
    quantity: Number(d.quantity ?? 1),
    price: Number(d.price ?? 0),
    currency: d.currency === "DIAMONDS" ? "DIAMONDS" : "GOLD",
    belowNpc: Boolean(d.belowNpc),
    sellers: 1,
  };
}

// Seletor de item leve: input com dropdown filtrado (mesmo padrao do BallSelect).
function ItemPicker({ items, value, onSelect, placeholder }: { items: WishItem[]; value: WishItem | null; onSelect: (i: WishItem | null) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? items.filter((i) => i.name.toLowerCase().includes(needle)).slice(0, 30) : items.slice(0, 30);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {value?.icon && <Sprite src={assetIconUrl(value.icon)} alt="" size={18} />}
          <span className={`truncate ${value ? "" : "text-text-dim"}`}>{value?.name ?? placeholder}</span>
        </span>
        <span className="inline-flex shrink-0 text-cyan"><Caret size={16} /></span>
      </button>
      {open && (
        // menu flutuante em vidro (o .card ja traz blur): a superficie sobe pra 92% do
        // solido SO aqui — e o unico jeito de ter menu sobre lista sem texto no texto
        <div className="card glass-over fadein absolute z-30 mt-1 w-full p-1">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input input-sm mb-1" />
          <div className="max-h-56 overflow-auto">
            {value && (
              <button type="button" onClick={() => { onSelect(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text-dim hover:bg-surface-2">
                {placeholder}
              </button>
            )}
            {filtered.map((i) => (
              <button key={i.id} type="button" onClick={() => { onSelect(i); setOpen(false); setQ(""); }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${value?.id === i.id ? "bg-surface-2" : ""}`}>
                {i.icon && <Sprite src={assetIconUrl(i.icon)} alt="" size={18} />}
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Card de um ACHADO de item dentro do desejo: icone + qtd + preco unitario + comprar.
// min-h igual ao do MarketMonCard: os dois convivem na MESMA grade de achados e as
// linhas de altura fixa garantem cards do mesmo tamanho.
function ItemMatchCard({ item, onBuy, right }: { item: MarketItemRow; onBuy: () => void; right?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="relative">
      <div className="card flex min-h-28 w-full items-center gap-3 p-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
          {item.icon ? <Sprite src={assetIconUrl(item.icon)} alt={item.name} size={34} /> : <Loot size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="pixel block h-7 truncate text-base" title={item.name}>{item.name}</span>
          <div className={`${METAROW} h-7 gap-x-3 text-sm text-text-dim`}>
            <span className="pixel shrink-0 whitespace-nowrap text-base text-text">{item.price.toLocaleString("pt-BR")} <span className="text-text-dim">{item.currency === "DIAMONDS" ? "dia" : "$"} {t("market.it.unit")}</span></span>
            <span className="shrink-0 whitespace-nowrap">x{item.quantity.toLocaleString("pt-BR")}</span>
            <span className={`chip shrink-0 ${item.belowNpc ? "" : "invisible"}`} style={{ background: "var(--green)", color: "#052012" }}>{t("account.market.belowNpc")}</span>
          </div>
        </div>
        <button type="button" onClick={onBuy} className="btn btn-green mr-7 shrink-0">{t("market.buy")}</button>
      </div>
      {right && <div className="absolute right-2 top-2 z-10">{right}</div>}
    </div>
  );
}

// Remonta o MarketMon a partir do que o worker gravou no alerta (pra abrir o modal).
function monFromNotif(n: LiveNotification, name: string): MarketMon {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const nn = (v: unknown) => (v == null ? null : Number(v));
  return {
    listingId: String(d.listingId ?? n.id),
    speciesId: Number(d.speciesId ?? 0),
    name: String(d.name ?? name),
    level: Number(d.level ?? 0),
    shiny: Boolean(d.shiny),
    ivTotal: nn(d.ivTotal),
    quality: nn(d.quality),
    power: nn(d.power),
    stats: (d.stats as MarketMon["stats"]) ?? null, // guardado pelo sniper desde ago/2026;
    // alerta antigo (sem stats) faz o primitivo cair nos base da especie sozinho
    type1: (d.type1 as PokeType) ?? null,
    type2: (d.type2 as PokeType) ?? null,
    price: Number(d.price ?? 0),
    currency: d.currency === "DIAMONDS" ? "DIAMONDS" : "GOLD",
    belowNpc: Boolean(d.belowNpc),
    sellers: Number(d.sellers ?? 1),
    fairPrice: nn(d.fairPrice),
  };
}

// ---- formulario de novo desejo ----

function NewWish({ creatures, items, onCreated }: { creatures: ComboCreature[]; items: WishItem[]; onCreated: (w: Watchlist) => void }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const qualityOpts = [
    { value: "", label: t("alerts.quality.any") },
    { value: "1.2", label: "≥ 1.2" },
    { value: "1.4", label: "≥ 1.4" },
    { value: "1.6", label: "≥ 1.6" },
    { value: "1.8", label: "≥ 1.8" },
    { value: "2.0", label: "≥ 2.0" },
  ];
  const [kind, setKind] = useState<"pokemon" | "item">("pokemon");
  const [item, setItem] = useState<WishItem | null>(null);
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [type, setType] = useState<PokeType | "">("");
  const [maxGold, setMaxGold] = useState("");
  const [maxDia, setMaxDia] = useState("");
  const [minQ, setMinQ] = useState("");
  const [minIv, setMinIv] = useState("");
  const [shiny, setShiny] = useState(false);
  const [belowFair, setBelowFair] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    let currency: Currency | null = null;
    let maxPrice: number | null = null;
    const g = numI(maxGold);
    const dmd = numI(maxDia);
    if (g != null) {
      currency = "GOLD";
      maxPrice = g;
    } else if (dmd != null) {
      currency = "DIAMONDS";
      maxPrice = dmd;
    }
    const body = kind === "item"
      ? {
          kind: "item",
          itemId: item?.id ?? null,
          currency,
          maxPrice,
          belowFair,
          label: item?.name ?? null,
        }
      : {
          kind: "pokemon",
          speciesId: species?.pokeId ?? null,
          type: species ? null : type || null,
          currency,
          maxPrice,
          minQuality: minQ ? Number(minQ) : null,
          minIv: numI(minIv),
          shinyOnly: shiny,
          belowFair,
          label: species?.name ?? (type ? typeLabel(type) : null),
        };
    setBusy(true);
    try {
      const res = await fetch("/api/vip/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { watchlist?: Watchlist; error?: string };
      if (res.ok && j.watchlist) {
        onCreated(j.watchlist);
        setSpecies(null);
        setItem(null);
        setType("");
        setMaxGold("");
        setMaxDia("");
        setMinQ("");
        setMinIv("");
        setShiny(false);
        setBelowFair(false);
      } else {
        setErr(t(`alerts.err.${j.error ?? "failed"}`));
      }
    } catch {
      setErr(t("alerts.err.failed"));
    } finally {
      setBusy(false);
    }
  };

  const lblCls = "field-label";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Heart size={18}  /> {t("wish.new.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("wish.new.help")}</p>
        </div>
        {/* desejo de POKEMON ou de ITEM — mesmo sniper, criterios diferentes */}
        <div className="flex gap-1">
          <button type="button" onClick={() => setKind("pokemon")} className={`tab ${kind === "pokemon" ? "tab-active" : ""}`}>{t("market.tab.pokemon")}</button>
          <button type="button" onClick={() => setKind("item")} className={`tab ${kind === "item" ? "tab-active" : ""}`}>{t("market.tab.items")}</button>
        </div>
      </div>
      <div className="card z-20 flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {kind === "item" ? (
            <>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={lblCls}>{t("wish.item")}</span>
                <ItemPicker items={items} value={item} onSelect={setItem} placeholder={t("wish.item.any")} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={lblCls}>{t("wish.item.maxGold")}</span>
                <input className="input" inputMode="numeric" placeholder="—" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={lblCls}>{t("wish.item.maxDia")}</span>
                <input className="input" inputMode="numeric" placeholder="—" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} />
              </label>
              <div className="flex flex-col gap-1">
                <span className={lblCls}>{t("alerts.f.filters")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleButton active={belowFair} onClick={() => setBelowFair((v) => !v)} accent="green">
                    {t("account.market.belowNpc")}
                  </ToggleButton>
                </div>
              </div>
            </>
          ) : (
          <>
          {/* Especie e Tipo sao exclusivos: uma especie ja e de um tipo so. */}
          <label className="flex flex-col gap-1 sm:col-span-2 md:col-span-1">
            <span className={lblCls}>{t("alerts.f.species")}</span>
            <PokemonCombobox creatures={creatures} value={species} onSelect={(c) => { setSpecies(c); if (c) setType(""); }} placeholder={t("alerts.f.anySpecies")} />
          </label>
          <div className="flex flex-col gap-1">
            <span className={lblCls}>{t("account.market.type")}</span>
            <TypeFilter value={type} onChange={(tp) => { setType(tp); if (tp) setSpecies(null); }} className="" />
          </div>
          <label className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.maxGold")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.maxDia")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.minQuality")}</span>
            <SelectMenu value={minQ} onChange={setMinQ} className="" options={qualityOpts} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.minIv")}</span>
            <SelectMenu
              value={minIv}
              onChange={setMinIv}
              className=""
              options={[
                { value: "", label: t("alerts.quality.any") },
                { value: "100", label: "≥ 100" },
                { value: "150", label: "≥ 150" },
              ]}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.filters")}</span>
            <div className="flex flex-wrap items-center gap-2">
              <ShinyToggle active={shiny} onChange={setShiny} />
              <ToggleButton active={belowFair} onClick={() => setBelowFair((v) => !v)} accent="green">
                {t("alerts.f.belowFair")}
              </ToggleButton>
            </div>
          </div>
          </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-red">{err ?? ""}</span>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-cyan disabled:opacity-40">
            {busy ? `${t("wish.new.saving")}...` : <>{t("wish.new.save")} <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- resumo dos criterios de um desejo ----

function wishSummary(w: Watchlist, t: (k: string) => string): string {
  const parts: string[] = [];
  if (w.maxPrice != null) parts.push(`≤ ${fmt(w.maxPrice)} ${w.currency === "DIAMONDS" ? t("alerts.coin.dia") : t("alerts.coin.gold")}${w.kind === "item" ? ` ${t("market.it.unit")}` : ""}`);
  if (w.minQuality != null) parts.push(`Q ≥ ${w.minQuality}`);
  if (w.minIv != null) parts.push(`IV ≥ ${w.minIv}`);
  if (w.shinyOnly) parts.push("shiny");
  if (w.belowFair) parts.push((w.kind === "item" ? t("account.market.belowNpc") : t("alerts.f.belowFair")).toLowerCase());
  return parts.join(" · ") || t("alerts.any");
}

// ---- card de um pokemon achado ----

// ---- bloco de um desejo (acordeao: cabecalho + achados paginados) ----

const MATCH_PAGE = 6;

function WishBlock({
  w,
  matches,
  expanded,
  onToggleExpand,
  onToggle,
  onDelete,
  onOpen,
  onDismiss,
  nameOf,
  rarityOf,
  itemIconOf,
  onBuyItem,
  t,
}: {
  w: Watchlist;
  matches: LiveNotification[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: (a: boolean) => void;
  onDelete: () => void;
  onOpen: (mon: MarketMon) => void;
  onDismiss: (id: string) => void;
  nameOf: (speciesId: number) => string;
  rarityOf: (speciesId: number) => Rarity | undefined;
  itemIconOf: (itemId: number) => string;
  onBuyItem: (item: MarketItemRow) => void;
  t: (k: string) => string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(matches.length / MATCH_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = matches.slice(safePage * MATCH_PAGE, safePage * MATCH_PAGE + MATCH_PAGE);

  return (
    <div id={`wish-${w.id}`} className={`card p-3 sm:p-4 ${w.active ? "" : "opacity-60"}`}>
      {/* em 360px o cabecalho carrega chevron + tile + texto + liga/desliga + excluir:
          os gaps encolhem no celular pra sobrar largura de nome */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* cabecalho clicavel = expande/recolhe */}
        <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3" aria-expanded={expanded}>
          <span className="inline-flex shrink-0 text-cyan" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}><ChevronRight size={16} /></span>
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
            {w.kind === "item" ? (
              w.itemId != null && itemIconOf(w.itemId)
                ? <Sprite src={assetIconUrl(itemIconOf(w.itemId))} alt={w.label ?? "item"} size={32} />
                : <Loot size={20} />
            ) : !w.speciesId && w.type ? (
              <span className="flex h-7 w-7 items-center justify-center rounded" style={{ background: TYPE_COLOR[w.type as PokeType], color: "#fff" }}>
                <TypeIcon type={w.type as PokeType} size={16} />
              </span>
            ) : (
              <Sprite src={w.speciesId ? spriteUrl(w.speciesId, w.shinyOnly) : null} alt={w.label ?? "any"} size={38} />
            )}
            {w.shinyOnly && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={14} /></span>}
            {/* contagem de achados: badge ABSOLUTO no canto do tile — nunca in-flow */}
            {matches.length > 0 && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-green px-1.5 py-0.5 text-xs text-[#052012]">{matches.length}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-7 items-center gap-2 overflow-hidden">
              <span className="pixel truncate text-base" title={w.label ?? undefined}>{w.label ?? (w.speciesId ? `#${w.speciesId}` : t("alerts.anySpecies"))}</span>
            </div>
            <div className="h-6 truncate text-sm text-text-dim" title={wishSummary(w, t)}>{wishSummary(w, t)}</div>
          </div>
        </button>
        <ToggleButton active={w.active} onClick={() => onToggle(!w.active)} accent="green" title={t(w.active ? "alerts.pause" : "alerts.resume")}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: w.active ? "var(--green)" : "var(--text-dim)" }} />
          {t(w.active ? "alerts.on" : "alerts.off")}
        </ToggleButton>
        <CloseButton onClick={onDelete} title={t("alerts.delete")} />
      </div>

      {expanded &&
        (matches.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid gap-2 lg:grid-cols-2">
              {paged.map((n) => {
                if (((n.data ?? {}) as Record<string, unknown>).kind === "item") {
                  const it = itemFromNotif(n, itemIconOf);
                  return (
                    <ItemMatchCard
                      key={n.id}
                      item={it}
                      onBuy={() => onBuyItem(it)}
                      right={<CloseButton onClick={() => onDismiss(n.id)} title={t("alerts.dismiss")} />}
                    />
                  );
                }
                const mon = monFromNotif(n, nameOf(Number((n.data ?? {}).speciesId ?? 0)));
                return (
                  <MarketMonCard
                    key={n.id}
                    mon={mon}
                    rarity={rarityOf(mon.speciesId)}
                    onClick={() => onOpen(mon)}
                    right={<CloseButton onClick={() => onDismiss(n.id)} title={t("alerts.dismiss")} />}
                  />
                );
              })}
            </div>
            {matches.length > MATCH_PAGE && <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />}
          </div>
        ) : (
          // estado vazio com a MESMA altura de uma linha de achados: quando o primeiro
          // achado chegar ao vivo, o bloco nao pula
          <div className="well mt-3 flex min-h-28 items-center justify-center">
            <p className="text-base text-text-dim">{w.active ? t("wish.noMatches") : t("wish.paused")}</p>
          </div>
        ))}
    </div>
  );
}

// ---- painel ----

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function WishlistPanel({ creatures, items, dex, focusWishId }: { creatures: ComboCreature[]; items: WishItem[]; dex: Record<number, MarketDex>; focusWishId?: string | null }) {
  const t = useT();
  const { alerts, applyAlerts } = useVipLive();
  const [wishes, setWishes] = useState<Load<Watchlist[]>>({ status: "loading" });
  // achados vem AO VIVO do stream; o CRUD da watchlist continua por fetch proprio
  const matches = useMemo(() => alerts?.notifications ?? [], [alerts]);
  const [selected, setSelected] = useState<MarketMon | null>(null);
  const [buyItem, setBuyItem] = useState<MarketItemRow | null>(null);
  const itemIconOf = useMemo(() => {
    const m = new Map(items.map((i) => [i.id, i.icon]));
    return (id: number) => m.get(id) ?? "";
  }, [items]);
  // acordeao: um desejo aberto por vez. Ja abre no desejo que veio do resumo (Alertas).
  const [expandedId, setExpandedId] = useState<string | null>(focusWishId ?? null);

  const nameOf = (speciesId: number) => creatures.find((c) => c.pokeId === speciesId)?.name ?? `#${speciesId}`;

  const load = async () => {
    try {
      const wRes = await fetch("/api/vip/watchlist", { cache: "no-store" });
      const wj = (await wRes.json()) as { watchlists?: Watchlist[] };
      setWishes({ status: "ok", data: wj.watchlists ?? [] });
    } catch {
      setWishes({ status: "error" });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // achados agrupados por desejo.
  const byWish = useMemo(() => {
    const m = new Map<string, LiveNotification[]>();
    for (const n of matches) {
      const wid = String((n.data ?? {}).watchlistId ?? "");
      if (!wid) continue;
      const arr = m.get(wid) ?? [];
      arr.push(n);
      m.set(wid, arr);
    }
    return m;
  }, [matches]);

  const remove = async (id: string) => {
    if (wishes.status === "ok") setWishes({ status: "ok", data: wishes.data.filter((w) => w.id !== id) });
    // some com os achados do desejo na hora; o stream confirma no proximo push
    const rest = matches.filter((n) => String((n.data ?? {}).watchlistId ?? "") !== id);
    applyAlerts({ notifications: rest, unread: rest.filter((n) => !n.readAt).length });
    await fetch(`/api/vip/watchlist?id=${id}`, { method: "DELETE" });
  };
  const toggle = async (id: string, active: boolean) => {
    if (wishes.status === "ok") setWishes({ status: "ok", data: wishes.data.map((w) => (w.id === id ? { ...w, active } : w)) });
    await fetch("/api/vip/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    load(); // resync da watchlist; os achados (esconder/voltar) chegam pelo stream
  };
  // Abrir a secao JA e ter visto os achados: a Central de desejos (que tinha o botao
  // "marcar tudo lido") saiu por ser redundante — a lista de desejos, logo abaixo, mostra
  // os mesmos achados na MESMA pagina. Sem isto o contador do menu nunca zeraria.
  const markedRead = useRef(false);
  useEffect(() => {
    if (markedRead.current || !alerts || alerts.unread <= 0) return;
    markedRead.current = true;
    applyAlerts({
      notifications: alerts.notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      unread: 0,
    });
    void fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, [alerts, applyAlerts]);

  const dismiss = async (id: string) => {
    // otimista: tira da lista local; o stream confirma no proximo push
    const rest = matches.filter((n) => n.id !== id);
    applyAlerts({ notifications: rest, unread: rest.filter((n) => !n.readAt).length });
    setSelected(null);
    await fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: [id] }),
    });
  };
  const open = (mon: MarketMon) => setSelected(mon);

  return (
    <div className="flex flex-col gap-5">
      <NewWish
        creatures={creatures}
        items={items}
        onCreated={(w) => setWishes((s) => (s.status === "ok" ? { status: "ok", data: [w, ...s.data] } : s))}
      />

      <div className="flex flex-col gap-3">
        <h3 className="section-title flex items-center gap-2">
          <Heart size={18}  /> {t("wish.list.title")}
        </h3>
        {/* estados com a mesma altura minima de um desejo recolhido: a lista nao pula
            quando sai do carregando pro vazio/erro/cheio */}
        {wishes.status === "loading" ? (
          <div className="card flex min-h-20 items-center justify-center p-4"><LoadingBall label={t("alerts.loading")} /></div>
        ) : wishes.status === "error" ? (
          <div className="card flex min-h-20 items-center justify-center p-4"><p className="text-base text-text-dim">{t("alerts.error")}</p></div>
        ) : wishes.data.length === 0 ? (
          <div className="card flex min-h-20 items-center justify-center p-4"><p className="text-base text-text-dim">{t("wish.list.empty")}</p></div>
        ) : (
          wishes.data.map((w) => (
            <WishBlock
              key={w.id}
              w={w}
              matches={byWish.get(w.id) ?? []}
              expanded={expandedId === w.id}
              onToggleExpand={() => setExpandedId((cur) => (cur === w.id ? null : w.id))}
              nameOf={nameOf}
              rarityOf={(id) => dex[id]?.rarity}
              t={t}
              onToggle={(a) => toggle(w.id, a)}
              onDelete={() => remove(w.id)}
              onOpen={open}
              onDismiss={dismiss}
              itemIconOf={itemIconOf}
              onBuyItem={setBuyItem}
            />
          ))
        )}
      </div>

      {selected && (
        <MarketMonModal
          mon={selected}
          dex={dex[selected.speciesId]}
          onClose={() => setSelected(null)}
        />
      )}
      {buyItem && <BuyItemModal item={buyItem} onClose={() => setBuyItem(null)} />}
    </div>
  );
}
