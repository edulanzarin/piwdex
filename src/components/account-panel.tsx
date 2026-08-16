"use client";

import { useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { DexEntry, MarketMon, Profile } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Coin, Diamond, Star } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => { const v = parseInt(s.replace(/\D/g, ""), 10); return Number.isFinite(v) ? v : null; };
const ivColor = (v: number | null) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

const Money = ({ currency, size = 12 }: { currency: string; size?: number }) =>
  currency === "DIAMONDS" ? <span className="text-cyan"><Diamond size={size} /></span> : <Coin size={size} />;

type State =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; profile: Profile | null; pokedex: DexEntry[] };

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const t = useT();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) return onConnected();
      setErr(t(`account.err.${j.error ?? "unauthorized"}`));
    } catch {
      setErr(t("account.err.unreachable"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-5">
      <h2 className="pixel text-[0.72rem] text-cyan">{t("account.connect.title")}</h2>
      <p className="mt-3 text-sm text-text-dim">{t("account.connect.help")}</p>
      <ol className="mt-3 flex flex-col gap-1.5 text-[0.72rem] leading-relaxed text-text-dim">
        {["step1", "step2", "step3"].map((s) => (
          <li key={s} className="flex gap-2"><span className="text-cyan">›</span><span>{t(`account.connect.${s}`)}</span></li>
        ))}
      </ol>
      <textarea className="input mt-4 h-24 w-full font-mono text-[0.72rem]" placeholder={t("account.connect.placeholder")} value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} />
      {err && <p className="mt-2 text-[0.72rem] font-semibold text-red">{err}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.6rem] leading-relaxed text-text-dim">{t("account.privacy")}</p>
        <button type="button" onClick={submit} disabled={busy || raw.trim().length < 10} className="btn btn-cyan shrink-0 disabled:opacity-40">
          {busy ? `${t("account.connect.connecting")}...` : `${t("account.connect.btn")} ›`}
        </button>
      </div>
    </div>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const t = useT();
  const box = (label: string, value: React.ReactNode) => (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
      <div className="text-[0.52rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-0.5 inline-flex items-center gap-1 pixel text-[0.72rem]">{value}</div>
    </div>
  );
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="pixel text-[0.72rem] text-green">{profile.name}</span>
        {profile.vip && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {box(t("account.profile.level"), <span className="text-cyan">{fmt(profile.level)}</span>)}
        {box(t("account.profile.gold"), <span className="text-yellow inline-flex items-center gap-1"><Coin />{fmt(profile.gold)}</span>)}
        {box(t("account.profile.diamonds"), <span className="text-cyan inline-flex items-center gap-1"><Diamond />{fmt(profile.diamonds)}</span>)}
        {box(t("account.profile.catches"), <span className="text-text">{fmt(profile.catches)}</span>)}
      </div>
      {profile.pokedexTotal > 0 && (
        <div className="mt-2 text-[0.62rem] text-text-dim">
          {t("account.profile.pokedex")} <span className="pixel text-[0.68rem] text-green">{profile.pokedexCount}</span>/{profile.pokedexTotal}
        </div>
      )}
    </div>
  );
}

function MarketAdvisor({ creatures }: { creatures: ComboCreature[] }) {
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
            <span className="inline-flex items-center gap-1 text-[0.55rem] uppercase tracking-wide text-text-dim"><Coin />{t("account.market.maxGold")}</span>
            <input className="input" inputMode="numeric" placeholder="—" value={maxGold} onChange={(e) => setMaxGold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[0.55rem] uppercase tracking-wide text-text-dim"><span className="text-cyan"><Diamond /></span>{t("account.market.maxDiamonds")}</span>
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
                  <Money currency={m.currency} />{fmt(m.price)}
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

function DexGrid({ pokedex }: { pokedex: DexEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="pixel text-[0.6rem] text-text-dim hover:text-cyan">
        {t("account.dex.title")} ({pokedex.length}) {open ? "−" : "+"}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {pokedex.map((e) => (
            <div key={e.dexId} className="flex items-center gap-2 rounded border border-border bg-[rgba(8,14,28,0.5)] px-2 py-1.5">
              <Sprite src={spriteUrl(e.dexId)} alt={e.name} size={30} />
              <div className="min-w-0 text-[0.58rem] leading-tight">
                <div className="truncate">{e.name}</div>
                <div className="text-text-dim">{t("account.dex.tier")} {e.tier} · {e.count}x</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountPanel({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });

  const load = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/collection", { cache: "no-store" });
      if (res.status === 401) return setState({ status: "disconnected" });
      const j = (await res.json()) as { connected?: boolean; profile?: Profile | null; pokedex?: DexEntry[] };
      if (j.connected) setState({ status: "connected", profile: j.profile ?? null, pokedex: j.pokedex ?? [] });
      else setState({ status: "disconnected" });
    } catch {
      setState({ status: "disconnected" });
    }
  };
  useEffect(() => { load(); }, []);

  const disconnect = async () => {
    await fetch("/api/disconnect", { method: "POST" });
    setState({ status: "disconnected" });
  };

  if (state.status === "loading") return <div className="card p-8"><LoadingBall label={t("account.loading")} /></div>;
  if (state.status === "disconnected") return <ConnectForm onConnected={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pixel text-[0.72rem] text-green">{t("account.connected.title")}</h2>
        <button type="button" onClick={disconnect} className="btn btn-ghost">{t("account.disconnect")}</button>
      </div>
      {state.profile && <ProfileHeader profile={state.profile} />}
      <MarketAdvisor creatures={creatures} />
      {state.pokedex.length > 0 && <DexGrid pokedex={state.pokedex} />}
    </div>
  );
}
