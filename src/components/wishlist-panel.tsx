"use client";

// Aba Desejos (VIP): a lista de pokemon que voce quer que o piwdex vigie no mercado, e —
// dentro de cada desejo — os pokemon ACHADOS por ele. Cada achado abre o modal do
// Mercado (mesmo do consultor) e pode ser recusado ali. O resumo "N achados" fica na
// aba Alertas; aqui e o detalhe. Tudo leitura: o worker le o mercado e grava; nada
// escreve no jogo.

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { Watchlist, Notification } from "@/lib/alerts";
import type { Currency, MarketMon } from "@/lib/game-account";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { Pagination } from "./pagination";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { ToggleButton } from "./toggle-button";
import { MarketMonModal, type MarketDex } from "./market-advisor";
import { useT } from "./locale-provider";
import { Star, Heart, Coin, Diamond } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => {
  const v = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : null;
};
const ivColor = (v: number | null) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

// Remonta o MarketMon a partir do que o worker gravou no alerta (pra abrir o modal).
function monFromNotif(n: Notification, name: string): MarketMon {
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
  const qualityOpts = [
    { value: "", label: t("alerts.quality.any") },
    { value: "1.2", label: "≥ 1.2" },
    { value: "1.4", label: "≥ 1.4" },
    { value: "1.6", label: "≥ 1.6" },
    { value: "1.8", label: "≥ 1.8" },
    { value: "2.0", label: "≥ 2.0" },
  ];
  const [species, setSpecies] = useState<ComboCreature | null>(null);
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
      currency,
      maxPrice,
      minQuality: minQ ? Number(minQ) : null,
      minIv: numI(minIv),
      shinyOnly: shiny,
      belowFair,
      label: species?.name ?? null,
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

  const lblCls = "text-[0.55rem] uppercase tracking-wide text-text-dim";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-cyan">
          <Heart size={14} className="text-pink" /> {t("wish.new.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("wish.new.help")}</p>
      </div>
      <div className="card flex flex-col gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className={lblCls}>{t("alerts.f.species")}</span>
            <PokemonCombobox creatures={creatures} value={species} onSelect={setSpecies} placeholder={t("alerts.f.anySpecies")} />
          </label>
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
            <select className="input" value={minQ} onChange={(e) => setMinQ(e.target.value)}>
              {qualityOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.minIv")}</span>
            <select className="input" value={minIv} onChange={(e) => setMinIv(e.target.value)}>
              <option value="">{t("alerts.quality.any")}</option>
              <option value="100">≥ 100</option>
              <option value="150">≥ 150</option>
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className={lblCls}>{t("alerts.f.filters")}</span>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleButton active={shiny} onClick={() => setShiny((v) => !v)} accent="yellow">
                <Star size={12} /> {t("alerts.f.shiny")}
              </ToggleButton>
              <ToggleButton active={belowFair} onClick={() => setBelowFair((v) => !v)} accent="green">
                {t("alerts.f.belowFair")}
              </ToggleButton>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.72rem] font-semibold text-red">{err ?? ""}</span>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-cyan disabled:opacity-40">
            {busy ? `${t("wish.new.saving")}...` : `${t("wish.new.save")} ›`}
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

function MatchCard({ n, name, onOpen, onDismiss, t }: { n: Notification; name: string; onOpen: () => void; onDismiss: () => void; t: (k: string) => string }) {
  const d = (n.data ?? {}) as Record<string, unknown>;
  const speciesId = Number(d.speciesId ?? 0);
  const shiny = Boolean(d.shiny);
  const currency = d.currency === "DIAMONDS" ? "DIAMONDS" : "GOLD";
  const price = Number(d.price ?? 0);
  const quality = d.quality == null ? null : Number(d.quality);
  const iv = d.ivTotal == null ? null : Number(d.ivTotal);
  const power = d.power == null ? null : Number(d.power);
  const level = Number(d.level ?? 0);
  const belowFair = d.fairPrice != null && price < Number(d.fairPrice);
  return (
    <div className="flex items-stretch gap-2 rounded border border-border bg-[rgba(8,14,28,0.5)] p-2 transition hover:border-[color:var(--border-strong)]">
      <button type="button" onClick={onOpen} title={t("alerts.open")} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={spriteUrl(speciesId, shiny)} alt={name} size={40} />
          {shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={10} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{name}</span>
            <span className="text-[0.56rem] text-text-dim">Lv.{level}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.6rem] text-text-dim">
            {power != null && <span>{t("account.col.power")} <span className="text-yellow">{fmt(power)}</span></span>}
            {iv != null && <span>{t("account.col.iv")} <span className={ivColor(iv)}>{iv}</span></span>}
            {quality != null && <span>{t("account.col.quality")} <span className="text-cyan">{quality.toFixed(3)}</span></span>}
          </div>
          <div className="mt-1 flex items-center gap-1.5 pixel text-[0.68rem]">
            <span className="inline-flex items-center gap-1 tabular-nums">
              {currency === "DIAMONDS" ? <span className="text-cyan"><Diamond size={11} /></span> : <span className="text-yellow"><Coin size={11} /></span>}
              {fmt(price)}
            </span>
            {belowFair && <span className="rounded px-1 text-[0.5rem] font-bold uppercase text-green" style={{ border: "1px solid var(--green)" }}>{t("wish.belowFair")}</span>}
          </div>
        </div>
      </button>
      <button type="button" onClick={onDismiss} title={t("alerts.dismiss")} aria-label={t("alerts.dismiss")} className="shrink-0 self-start text-text-dim transition hover:text-red">✕</button>
    </div>
  );
}

// ---- bloco de um desejo (criterios + achados paginados) ----

const MATCH_PAGE = 6;

function WishBlock({
  w,
  matches,
  onToggle,
  onDelete,
  onOpen,
  onDismiss,
  nameOf,
  t,
}: {
  w: Watchlist;
  matches: Notification[];
  onToggle: (a: boolean) => void;
  onDelete: () => void;
  onOpen: (n: Notification) => void;
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
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={w.speciesId ? spriteUrl(w.speciesId, w.shinyOnly) : null} alt={w.label ?? "any"} size={38} />
          {w.shinyOnly && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={10} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{w.label ?? (w.speciesId ? `#${w.speciesId}` : t("alerts.anySpecies"))}</span>
            {matches.length > 0 && (
              <span className="rounded-full bg-green px-1.5 py-0.5 text-[0.5rem] font-bold text-[#052012]">{matches.length}</span>
            )}
          </div>
          <div className="truncate text-[0.62rem] text-text-dim">{wishSummary(w, t)}</div>
        </div>
        <ToggleButton active={w.active} onClick={() => onToggle(!w.active)} accent="green" title={t(w.active ? "alerts.pause" : "alerts.resume")}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: w.active ? "var(--green)" : "var(--text-dim)" }} />
          {t(w.active ? "alerts.on" : "alerts.off")}
        </ToggleButton>
        <button type="button" onClick={onDelete} title={t("alerts.delete")} aria-label={t("alerts.delete")} className="text-text-dim transition hover:text-red">✕</button>
      </div>

      {matches.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {paged.map((n) => (
              <MatchCard key={n.id} n={n} name={nameOf(Number((n.data ?? {}).speciesId ?? 0))} onOpen={() => onOpen(n)} onDismiss={() => onDismiss(n.id)} t={t} />
            ))}
          </div>
          {matches.length > MATCH_PAGE && <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />}
        </div>
      ) : (
        <p className="mt-3 text-[0.66rem] text-text-dim">{w.active ? t("wish.noMatches") : t("wish.paused")}</p>
      )}
    </div>
  );
}

// ---- painel ----

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function WishlistPanel({ creatures, dex }: { creatures: ComboCreature[]; dex: Record<number, MarketDex> }) {
  const t = useT();
  const [wishes, setWishes] = useState<Load<Watchlist[]>>({ status: "loading" });
  const [matches, setMatches] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<MarketMon | null>(null);

  const nameOf = (speciesId: number) => creatures.find((c) => c.pokeId === speciesId)?.name ?? `#${speciesId}`;

  const load = async () => {
    try {
      const [wRes, aRes] = await Promise.all([
        fetch("/api/vip/watchlist", { cache: "no-store" }),
        fetch("/api/vip/alerts", { cache: "no-store" }),
      ]);
      const wj = (await wRes.json()) as { watchlists?: Watchlist[] };
      const aj = (await aRes.json()) as { notifications?: Notification[] };
      setWishes({ status: "ok", data: wj.watchlists ?? [] });
      setMatches(aj.notifications ?? []);
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
    const m = new Map<string, Notification[]>();
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
    setMatches((ms) => ms.filter((n) => String((n.data ?? {}).watchlistId ?? "") !== id));
    await fetch(`/api/vip/watchlist?id=${id}`, { method: "DELETE" });
  };
  const toggle = async (id: string, active: boolean) => {
    if (wishes.status === "ok") setWishes({ status: "ok", data: wishes.data.map((w) => (w.id === id ? { ...w, active } : w)) });
    await fetch("/api/vip/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    load(); // resync: pausar esconde os achados; retomar traz de volta
  };
  const dismiss = async (id: string) => {
    setMatches((ms) => ms.filter((n) => n.id !== id));
    setSelected(null);
    await fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: [id] }),
    });
  };
  const open = (n: Notification) => setSelected(monFromNotif(n, nameOf(Number((n.data ?? {}).speciesId ?? 0))));

  return (
    <div className="flex flex-col gap-5">
      <NewWish
        creatures={creatures}
        onCreated={(w) => setWishes((s) => (s.status === "ok" ? { status: "ok", data: [w, ...s.data] } : s))}
      />

      <div className="flex flex-col gap-3">
        <h3 className="pixel flex items-center gap-2 text-[0.6rem] text-cyan">
          <Heart size={12} className="text-pink" /> {t("wish.list.title")}
        </h3>
        {wishes.status === "loading" ? (
          <div className="card p-4"><LoadingBall label={t("alerts.loading")} /></div>
        ) : wishes.status === "error" ? (
          <div className="card p-4"><p className="text-[0.72rem] text-text-dim">{t("alerts.error")}</p></div>
        ) : wishes.data.length === 0 ? (
          <div className="card p-4"><p className="text-[0.72rem] text-text-dim">{t("wish.list.empty")}</p></div>
        ) : (
          wishes.data.map((w) => (
            <WishBlock
              key={w.id}
              w={w}
              matches={byWish.get(w.id) ?? []}
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
