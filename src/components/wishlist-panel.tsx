"use client";

// Aba Desejos (VIP): a lista de pokemon que voce quer que o piwdex vigie no mercado, e —
// dentro de cada desejo — os pokemon ACHADOS por ele. Cada achado abre o modal do
// Mercado (mesmo do consultor) e pode ser recusado ali. O resumo "N achados" fica na
// aba Alertas; aqui e o detalhe. A watchlist (CRUD) continua via fetch; os achados
// chegam AO VIVO pelo stream (useVipLive) — pokemon novo aparece sem F5.

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { Watchlist } from "@/lib/alerts";
import type { Currency, MarketMon } from "@/lib/game-account";
import type { PokeType } from "@/lib/types";
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
import { MarketMonModal, MarketMonCard, type MarketDex } from "./market-advisor";
import { useT, useTypeLabel } from "./locale-provider";
import { Star, Heart, ChevronRight } from "./icons";
import { useVipLive, type LiveNotification } from "./vip-live";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => {
  const v = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : null;
};

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

function NewWish({ creatures, onCreated }: { creatures: ComboCreature[]; onCreated: (w: Watchlist) => void }) {
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
    const body = {
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
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan">
          <Heart size={14} className="text-pink" /> {t("wish.new.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("wish.new.help")}</p>
      </div>
      <div className="card z-20 flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Especie e Tipo sao exclusivos: uma especie ja e de um tipo so. */}
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
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
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.92rem] font-semibold text-red">{err ?? ""}</span>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-cyan disabled:opacity-40">
            {busy ? `${t("wish.new.saving")}...` : <>{t("wish.new.save")} <ChevronRight size={10} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- resumo dos criterios de um desejo ----

function wishSummary(w: Watchlist, t: (k: string) => string): string {
  const parts: string[] = [];
  if (w.maxPrice != null) parts.push(`≤ ${fmt(w.maxPrice)} ${w.currency === "DIAMONDS" ? t("alerts.coin.dia") : t("alerts.coin.gold")}`);
  if (w.minQuality != null) parts.push(`Q ≥ ${w.minQuality}`);
  if (w.minIv != null) parts.push(`IV ≥ ${w.minIv}`);
  if (w.shinyOnly) parts.push("shiny");
  if (w.belowFair) parts.push(t("alerts.f.belowFair").toLowerCase());
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
  t: (k: string) => string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(matches.length / MATCH_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = matches.slice(safePage * MATCH_PAGE, safePage * MATCH_PAGE + MATCH_PAGE);

  return (
    <div id={`wish-${w.id}`} className={`card p-4 ${w.active ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        {/* cabecalho clicavel = expande/recolhe */}
        <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
          <span className="inline-flex text-cyan" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}><ChevronRight size={9} /></span>
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
            {!w.speciesId && w.type ? (
              <span className="flex h-7 w-7 items-center justify-center rounded" style={{ background: TYPE_COLOR[w.type as PokeType], color: "#fff" }}>
                <TypeIcon type={w.type as PokeType} size={16} />
              </span>
            ) : (
              <Sprite src={w.speciesId ? spriteUrl(w.speciesId, w.shinyOnly) : null} alt={w.label ?? "any"} size={38} />
            )}
            {w.shinyOnly && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={10} /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="pixel truncate text-[1rem]">{w.label ?? (w.speciesId ? `#${w.speciesId}` : t("alerts.anySpecies"))}</span>
              {matches.length > 0 && (
                <span className="rounded-full bg-green px-1.5 py-0.5 text-[0.7rem] font-bold text-[#052012]">{matches.length}</span>
              )}
            </div>
            <div className="truncate text-[0.82rem] text-text-dim">{wishSummary(w, t)}</div>
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
                const mon = monFromNotif(n, nameOf(Number((n.data ?? {}).speciesId ?? 0)));
                return (
                  <MarketMonCard
                    key={n.id}
                    mon={mon}
                    onClick={() => onOpen(mon)}
                    right={<CloseButton onClick={() => onDismiss(n.id)} title={t("alerts.dismiss")} />}
                  />
                );
              })}
            </div>
            {matches.length > MATCH_PAGE && <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />}
          </div>
        ) : (
          <p className="mt-3 text-[0.86rem] text-text-dim">{w.active ? t("wish.noMatches") : t("wish.paused")}</p>
        ))}
    </div>
  );
}

// ---- painel ----

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function WishlistPanel({ creatures, dex, focusWishId }: { creatures: ComboCreature[]; dex: Record<number, MarketDex>; focusWishId?: string | null }) {
  const t = useT();
  const { alerts, applyAlerts } = useVipLive();
  const [wishes, setWishes] = useState<Load<Watchlist[]>>({ status: "loading" });
  // achados vem AO VIVO do stream; o CRUD da watchlist continua por fetch proprio
  const matches = useMemo(() => alerts?.notifications ?? [], [alerts]);
  const [selected, setSelected] = useState<MarketMon | null>(null);
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
        onCreated={(w) => setWishes((s) => (s.status === "ok" ? { status: "ok", data: [w, ...s.data] } : s))}
      />

      <div className="flex flex-col gap-3">
        <h3 className="section-title flex items-center gap-2 text-cyan">
          <Heart size={12} className="text-pink" /> {t("wish.list.title")}
        </h3>
        {wishes.status === "loading" ? (
          <div className="card p-4"><LoadingBall label={t("alerts.loading")} /></div>
        ) : wishes.status === "error" ? (
          <div className="card p-4"><p className="text-[0.92rem] text-text-dim">{t("alerts.error")}</p></div>
        ) : wishes.data.length === 0 ? (
          <div className="card p-4"><p className="text-[0.92rem] text-text-dim">{t("wish.list.empty")}</p></div>
        ) : (
          wishes.data.map((w) => (
            <WishBlock
              key={w.id}
              w={w}
              matches={byWish.get(w.id) ?? []}
              expanded={expandedId === w.id}
              onToggleExpand={() => setExpandedId((cur) => (cur === w.id ? null : w.id))}
              nameOf={nameOf}
              t={t}
              onToggle={(a) => toggle(w.id, a)}
              onDelete={() => remove(w.id)}
              onOpen={open}
              onDismiss={dismiss}
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
    </div>
  );
}
