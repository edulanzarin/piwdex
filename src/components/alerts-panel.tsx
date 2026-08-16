"use client";

// Aba Alertas (VIP): o sniper passivo. Duas metades — "Minhas buscas" (watchlists que
// o worker varre) e "Caixa de alertas" (inbox in-app do que ja disparou). Tudo leitura:
// o worker le mercado/conta e grava aqui; nada escreve no jogo.

import { useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { Watchlist, Notification, NotifKind } from "@/lib/alerts";
import type { Currency } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { SelectMenu } from "./select-menu";
import { ToggleButton } from "./toggle-button";
import { useT } from "./locale-provider";
import { Star, Coin, Diamond } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");

const numI = (s: string) => {
  const v = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : null;
};

// "ha 3 min" / "ha 2 h" / data curta — sem lib.
function ago(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(0, (Date.now() - d) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `ha ${Math.floor(s / 60)} min`;
  if (s < 86400) return `ha ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const KIND_COLOR: Record<NotifKind, string> = {
  snipe: "text-green",
  egg: "text-pink",
  breeding: "text-pink",
  streak: "text-yellow",
  vip: "text-yellow",
};

// ---- formulario de nova busca ----

function NewWatch({ creatures, onCreated }: { creatures: ComboCreature[]; onCreated: (w: Watchlist) => void }) {
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
    // moeda + teto derivam de qual campo foi preenchido.
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

  const field = "w-full rounded border border-border bg-[rgba(8,14,28,0.6)] px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-[color:var(--cyan)] focus:outline-none";
  const lbl = "mb-1 block text-[0.5rem] uppercase tracking-wide text-text-dim";

  return (
    <div className="card p-4">
      <h3 className="pixel text-[0.6rem] text-cyan">{t("alerts.new.title")}</h3>
      <p className="mt-2 text-[0.7rem] text-text-dim">{t("alerts.new.help")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <span className={lbl}>{t("alerts.f.species")}</span>
          <PokemonCombobox value={species} onSelect={setSpecies} creatures={creatures} placeholder={t("alerts.f.anySpecies")} />
        </div>
        <div>
          <span className={lbl}>{t("alerts.f.maxGold")}</span>
          <input inputMode="numeric" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} placeholder="—" className={field} />
        </div>
        <div>
          <span className={lbl}>{t("alerts.f.maxDia")}</span>
          <input inputMode="numeric" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} placeholder="—" className={field} />
        </div>
        <div>
          <span className={lbl}>{t("alerts.f.minQuality")}</span>
          <SelectMenu value={minQ} onChange={setMinQ} options={qualityOpts} />
        </div>
        <div>
          <span className={lbl}>{t("alerts.f.minIv")}</span>
          <input inputMode="numeric" value={minIv} onChange={(e) => setMinIv(e.target.value)} placeholder="—" className={field} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToggleButton active={shiny} onClick={() => setShiny((v) => !v)} accent="yellow">
          <Star size={12} /> {t("alerts.f.shiny")}
        </ToggleButton>
        <ToggleButton active={belowFair} onClick={() => setBelowFair((v) => !v)} accent="green">
          {t("alerts.f.belowFair")}
        </ToggleButton>
        <button type="button" onClick={submit} disabled={busy} className="btn btn-cyan ml-auto disabled:opacity-50">
          {busy ? `${t("alerts.new.saving")}...` : `${t("alerts.new.save")} ›`}
        </button>
      </div>
      {err && <p className="mt-2 text-[0.72rem] font-semibold text-red">{err}</p>}
    </div>
  );
}

// ---- linha de uma busca salva ----

function watchSummary(w: Watchlist, t: (k: string) => string): string {
  const parts: string[] = [];
  if (w.maxPrice != null) parts.push(`≤ ${fmt(w.maxPrice)} ${w.currency === "DIAMONDS" ? t("alerts.coin.dia") : t("alerts.coin.gold")}`);
  if (w.minQuality != null) parts.push(`Q ≥ ${w.minQuality}`);
  if (w.minIv != null) parts.push(`IV ≥ ${w.minIv}`);
  if (w.shinyOnly) parts.push("shiny");
  if (w.belowFair) parts.push(t("alerts.f.belowFair").toLowerCase());
  return parts.join(" · ") || t("alerts.any");
}

function WatchRow({ w, onToggle, onDelete, t }: { w: Watchlist; onToggle: (a: boolean) => void; onDelete: () => void; t: (k: string) => string }) {
  return (
    <div className={`flex items-center gap-3 rounded border border-border bg-[rgba(8,14,28,0.5)] p-2.5 ${w.active ? "" : "opacity-50"}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
        <Sprite src={w.speciesId ? spriteUrl(w.speciesId, w.shinyOnly) : null} alt={w.label ?? "any"} size={38} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{w.label ?? (w.speciesId ? `#${w.speciesId}` : t("alerts.anySpecies"))}</div>
        <div className="truncate text-[0.62rem] text-text-dim">{watchSummary(w, t)}</div>
      </div>
      <ToggleButton active={w.active} onClick={() => onToggle(!w.active)} accent="green" title={t(w.active ? "alerts.pause" : "alerts.resume")}>
        {t(w.active ? "alerts.on" : "alerts.off")}
      </ToggleButton>
      <button type="button" onClick={onDelete} title={t("alerts.delete")} className="text-text-dim transition hover:text-red">✕</button>
    </div>
  );
}

// ---- item do inbox ----

function NotifItem({ n, onRead }: { n: Notification; onRead: () => void }) {
  const t = useT();
  const speciesId = typeof n.data?.speciesId === "number" ? (n.data.speciesId as number) : null;
  const shiny = Boolean(n.data?.shiny);
  const currency = n.data?.currency as Currency | undefined;
  return (
    <button
      type="button"
      onClick={() => !n.readAt && onRead()}
      className={`flex w-full items-start gap-3 rounded border p-2.5 text-left transition ${
        n.readAt ? "border-border bg-transparent" : "border-[color:var(--cyan)]/40 bg-[rgba(57,139,240,0.06)]"
      }`}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
        <Sprite src={speciesId ? spriteUrl(speciesId, shiny) : null} alt={n.title} size={38} />
        {!n.readAt && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${KIND_COLOR[n.kind] ?? "text-text"}`}>
          {currency === "DIAMONDS" ? <Diamond size={11} /> : n.kind === "snipe" ? <Coin size={11} /> : null}
          <span className="truncate">{n.title}</span>
        </div>
        {n.body && <div className="mt-0.5 truncate text-[0.66rem] text-text-dim">{n.body}</div>}
      </div>
      <span className="shrink-0 text-[0.55rem] text-text-dim">{ago(n.createdAt)}</span>
    </button>
  );
}

// ---- painel ----

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function AlertsPanel({ creatures, onUnread }: { creatures: ComboCreature[]; onUnread?: (n: number) => void }) {
  const t = useT();
  const [watch, setWatch] = useState<Load<Watchlist[]>>({ status: "loading" });
  const [inbox, setInbox] = useState<Load<Notification[]>>({ status: "loading" });

  const loadWatch = async () => {
    try {
      const res = await fetch("/api/vip/watchlist", { cache: "no-store" });
      const j = (await res.json()) as { watchlists?: Watchlist[] };
      setWatch({ status: "ok", data: j.watchlists ?? [] });
    } catch {
      setWatch({ status: "error" });
    }
  };
  const loadInbox = async () => {
    try {
      const res = await fetch("/api/vip/alerts", { cache: "no-store" });
      const j = (await res.json()) as { notifications?: Notification[]; unread?: number };
      setInbox({ status: "ok", data: j.notifications ?? [] });
      onUnread?.(j.unread ?? 0);
    } catch {
      setInbox({ status: "error" });
    }
  };
  useEffect(() => {
    loadWatch();
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeWatch = async (id: string) => {
    if (watch.status === "ok") setWatch({ status: "ok", data: watch.data.filter((w) => w.id !== id) });
    await fetch(`/api/vip/watchlist?id=${id}`, { method: "DELETE" });
  };
  const toggleWatch = async (id: string, active: boolean) => {
    if (watch.status === "ok")
      setWatch({ status: "ok", data: watch.data.map((w) => (w.id === id ? { ...w, active } : w)) });
    await fetch("/api/vip/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
  };
  const markOne = async (id: string) => {
    if (inbox.status === "ok")
      setInbox({ status: "ok", data: inbox.data.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) });
    const res = await fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    const j = (await res.json().catch(() => ({}))) as { unread?: number };
    onUnread?.(j.unread ?? 0);
  };
  const markAll = async () => {
    if (inbox.status === "ok")
      setInbox({ status: "ok", data: inbox.data.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) });
    await fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    onUnread?.(0);
  };

  const unread = inbox.status === "ok" ? inbox.data.filter((n) => !n.readAt).length : 0;

  return (
    <div className="flex flex-col gap-5">
      <NewWatch
        creatures={creatures}
        onCreated={(w) => setWatch((s) => (s.status === "ok" ? { status: "ok", data: [w, ...s.data] } : s))}
      />

      {/* Minhas buscas */}
      <div className="card p-4">
        <h3 className="pixel text-[0.6rem] text-cyan">{t("alerts.list.title")}</h3>
        <div className="mt-3">
          {watch.status === "loading" ? (
            <LoadingBall label={t("alerts.loading")} />
          ) : watch.status === "error" ? (
            <p className="text-[0.72rem] text-text-dim">{t("alerts.error")}</p>
          ) : watch.data.length === 0 ? (
            <p className="text-[0.72rem] text-text-dim">{t("alerts.list.empty")}</p>
          ) : (
            <div className="grid gap-2">
              {watch.data.map((w) => (
                <WatchRow key={w.id} w={w} t={t} onDelete={() => removeWatch(w.id)} onToggle={(a) => toggleWatch(w.id, a)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Caixa de alertas */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="pixel text-[0.6rem] text-green">
            {t("alerts.inbox.title")}
            {unread > 0 && <span className="ml-2 rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] text-[#06131a]">{unread}</span>}
          </h3>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="btn btn-ghost">{t("alerts.markAll")}</button>
          )}
        </div>
        {inbox.status === "loading" ? (
          <LoadingBall label={t("alerts.loading")} />
        ) : inbox.status === "error" ? (
          <p className="text-[0.72rem] text-text-dim">{t("alerts.error")}</p>
        ) : inbox.data.length === 0 ? (
          <p className="text-[0.72rem] leading-relaxed text-text-dim">{t("alerts.inbox.empty")}</p>
        ) : (
          <div className="grid gap-2">
            {inbox.data.map((n) => (
              <NotifItem key={n.id} n={n} onRead={() => markOne(n.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
