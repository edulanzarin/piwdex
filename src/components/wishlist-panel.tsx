"use client";

// Aba Desejos (VIP): a lista de pokemon que voce quer que o piwdex vigie no mercado.
// Cada "desejo" (watchlist) e um criterio; o worker varre o mercado e, quando bate,
// o resultado cai na aba Alertas. Aqui so se cria/pausa/exclui desejo — leitura pura.

import { useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { Watchlist } from "@/lib/alerts";
import type { Currency } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { ToggleButton } from "./toggle-button";
import { useT } from "./locale-provider";
import { Star, Heart } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => {
  const v = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(v) ? v : null;
};

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

// ---- linha de um desejo salvo ----

function wishSummary(w: Watchlist, t: (k: string) => string): string {
  const parts: string[] = [];
  if (w.maxPrice != null) parts.push(`≤ ${fmt(w.maxPrice)} ${w.currency === "DIAMONDS" ? t("alerts.coin.dia") : t("alerts.coin.gold")}`);
  if (w.minQuality != null) parts.push(`Q ≥ ${w.minQuality}`);
  if (w.minIv != null) parts.push(`IV ≥ ${w.minIv}`);
  if (w.shinyOnly) parts.push("shiny");
  if (w.belowFair) parts.push(t("alerts.f.belowFair").toLowerCase());
  return parts.join(" · ") || t("alerts.any");
}

function WishRow({ w, onToggle, onDelete, t }: { w: Watchlist; onToggle: (a: boolean) => void; onDelete: () => void; t: (k: string) => string }) {
  return (
    <div className={`flex items-center gap-3 rounded border border-border bg-[rgba(8,14,28,0.5)] p-2.5 ${w.active ? "" : "opacity-50"}`}>
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
        <Sprite src={w.speciesId ? spriteUrl(w.speciesId, w.shinyOnly) : null} alt={w.label ?? "any"} size={38} />
        {w.shinyOnly && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={10} /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{w.label ?? (w.speciesId ? `#${w.speciesId}` : t("alerts.anySpecies"))}</div>
        <div className="truncate text-[0.62rem] text-text-dim">{wishSummary(w, t)}</div>
      </div>
      <ToggleButton active={w.active} onClick={() => onToggle(!w.active)} accent="green" title={t(w.active ? "alerts.pause" : "alerts.resume")}>
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: w.active ? "var(--green)" : "var(--text-dim)" }} />
        {t(w.active ? "alerts.on" : "alerts.off")}
      </ToggleButton>
      <button type="button" onClick={onDelete} title={t("alerts.delete")} aria-label={t("alerts.delete")} className="text-text-dim transition hover:text-red">✕</button>
    </div>
  );
}

// ---- painel ----

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function WishlistPanel({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  const [wishes, setWishes] = useState<Load<Watchlist[]>>({ status: "loading" });

  const load = async () => {
    try {
      const res = await fetch("/api/vip/watchlist", { cache: "no-store" });
      const j = (await res.json()) as { watchlists?: Watchlist[] };
      setWishes({ status: "ok", data: j.watchlists ?? [] });
    } catch {
      setWishes({ status: "error" });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id: string) => {
    if (wishes.status === "ok") setWishes({ status: "ok", data: wishes.data.filter((w) => w.id !== id) });
    await fetch(`/api/vip/watchlist?id=${id}`, { method: "DELETE" });
  };
  const toggle = async (id: string, active: boolean) => {
    if (wishes.status === "ok") setWishes({ status: "ok", data: wishes.data.map((w) => (w.id === id ? { ...w, active } : w)) });
    await fetch("/api/vip/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <NewWish
        creatures={creatures}
        onCreated={(w) => setWishes((s) => (s.status === "ok" ? { status: "ok", data: [w, ...s.data] } : s))}
      />

      <div className="card p-4">
        <h3 className="pixel flex items-center gap-2 text-[0.6rem] text-cyan">
          <Heart size={12} className="text-pink" /> {t("wish.list.title")}
        </h3>
        <div className="mt-3">
          {wishes.status === "loading" ? (
            <LoadingBall label={t("alerts.loading")} />
          ) : wishes.status === "error" ? (
            <p className="text-[0.72rem] text-text-dim">{t("alerts.error")}</p>
          ) : wishes.data.length === 0 ? (
            <p className="text-[0.72rem] text-text-dim">{t("wish.list.empty")}</p>
          ) : (
            <div className="grid gap-2">
              {wishes.data.map((w) => (
                <WishRow key={w.id} w={w} t={t} onDelete={() => remove(w.id)} onToggle={(a) => toggle(w.id, a)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
