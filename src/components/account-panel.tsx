"use client";

import { useEffect, useState } from "react";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import type { Account, AccountItem, MarketMon } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Star } from "./icons";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const numI = (s: string) => { const v = parseInt(s.replace(/\D/g, ""), 10); return Number.isFinite(v) ? v : null; };
const ivColor = (v: number | null) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const pct = (n: number) => `${n > 0 ? "+" : ""}${+n.toFixed(1)}%`;

type State =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; account: Account };

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

// --- blocos text-forward (rótulo escrito, sem ícone em cada coisa) ---
function Stat({ label, value, color = "text-text" }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
      <div className="text-[0.5rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`mt-0.5 pixel text-[0.72rem] ${color}`}>{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-[0.58rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="text-right text-[0.72rem] text-text">{value}</span>
    </div>
  );
}
function Section({ title, color, extra, children }: { title: string; color: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`pixel text-[0.6rem] ${color}`}>{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}
const OnOff = ({ on }: { on: boolean }) => {
  const t = useT();
  return <span className={on ? "text-green" : "text-text-dim"}>{t(on ? "account.on" : "account.off")}</span>;
};

function Overview({ account }: { account: Account }) {
  const t = useT();
  const p = account.profile;
  const xpPct = p.xpForNext > 0 ? Math.min(100, (p.xpInLevel / p.xpForNext) * 100) : 0;
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="pixel text-[0.8rem] text-green">{p.name}</span>
        {account.trainer.vip && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>}
        <span className="text-[0.55rem] uppercase tracking-wide text-text-dim">{t(`account.gender.${account.trainer.gender}`)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("account.profile.level")} value={fmt(p.level)} color="text-cyan" />
        <Stat label={t("account.profile.gold")} value={fmt(p.gold)} color="text-yellow" />
        <Stat label={t("account.profile.diamonds")} value={fmt(p.diamonds)} color="text-cyan" />
        <Stat label={t("account.profile.catches")} value={fmt(p.catches)} />
        <Stat label={t("account.profile.pokedex")} value={<span className="text-green">{p.pokedexCount}<span className="text-text-dim">/{p.pokedexTotal}</span></span>} />
        <Stat label={t("account.f.rank")} value={p.rank > 0 ? `#${fmt(p.rank)}` : "—"} />
      </div>
      {p.xpForNext > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[0.55rem] text-text-dim">
            <span>XP · {t("account.profile.level")} {p.level}</span>
            <span className="tabular-nums">{fmt(p.xpInLevel)} / {fmt(p.xpForNext)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-[rgba(8,14,28,0.7)]">
            <div className="h-full rounded bg-[color:var(--green)]" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function TrainerCard({ account }: { account: Account }) {
  const t = useT();
  const tr = account.trainer;
  return (
    <Section title={t("account.sec.trainer")} color="text-cyan">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Row label={t("account.f.skin")} value={`#${tr.lookType}`} />
        <Row label={t("account.f.clan")} value={tr.clan ? `${tr.clan} · #${tr.clanRank}` : "—"} />
        <Row label={t("account.f.profession")} value={tr.profession ? `${tr.profession}${tr.professionRankName ? " · " + tr.professionRankName : ""}` : "—"} />
        <Row label={t("account.f.catchBonus")} value={<span className="text-green">{pct(tr.catchBonusPct)}</span>} />
        <Row label={t("account.f.vipUntil")} value={tr.vipUntil ? fmtDate(tr.vipUntil) : "—"} />
        <Row label={t("account.f.breedingSlots")} value={fmt(tr.breedingSlots)} />
        <Row label={t("account.f.diamondsBought")} value={fmt(tr.diamondsPurchased)} />
        <Row label={t("account.f.referral")} value={tr.referralCode ?? "—"} />
      </div>
    </Section>
  );
}

function AutomationCard({ account, nameById }: { account: Account; nameById: (id: number) => string | undefined }) {
  const t = useT();
  const a = account.auto;
  const ballName = (id: number) => account.balls.find((b) => b.id === id)?.name ?? `#${id}`;
  return (
    <Section title={t("account.sec.auto")} color="text-purple">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Row label={t("account.f.autoCatch")} value={<span><OnOff on={a.autoCatch} /> · {ballName(a.autoCatchBallId)}</span>} />
        <Row label={t("account.f.autoCatchShiny")} value={<span><OnOff on={a.autoCatchShiny} /> · {ballName(a.autoCatchShinyBallId)}</span>} />
        <Row label={t("account.f.autoPotion")} value={<span><OnOff on={a.autoPotion} /> · {a.autoPotionThreshold}%</span>} />
        <Row label={t("account.f.autoRevive")} value={<OnOff on={a.autoRevive} />} />
        <Row label={t("account.f.selectedBall")} value={ballName(a.selectedBallId)} />
        <Row label={t("account.f.starter")} value={nameById(a.starterId) ?? `#${a.starterId}`} />
      </div>
    </Section>
  );
}

function StreakCard({ account }: { account: Account }) {
  const t = useT();
  const s = account.streak;
  return (
    <Section title={t("account.sec.streak")} color="text-yellow">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t("account.f.streakPoints")} value={fmt(s.available)} color="text-yellow" />
        <Stat label={t("account.f.streakKills")} value={fmt(s.totalKills)} />
        <Stat label={t("account.f.streakBonus")} value={<span className="text-green">{pct(s.bonusExp + s.bonusLoot + s.bonusShiny)}</span>} />
        <Stat label="EXP · Loot · Shiny" value={<span className="text-green">{pct(s.bonusExp)} · {pct(s.bonusLoot)} · {pct(s.bonusShiny)}</span>} />
      </div>
    </Section>
  );
}

function BreedingCard({ account }: { account: Account }) {
  const t = useT();
  const b = account.breeding;
  if (!b.unlocked && b.eggs.length === 0 && b.usedSlots === 0 && b.pheromones === 0) return null;
  return (
    <Section title={t("account.sec.breeding")} color="text-pink">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("account.f.breedSlots")} value={`${b.usedSlots}/${b.maxSlots}`} />
        <Stat label={t("account.f.pheromones")} value={fmt(b.pheromones)} />
        <Stat label={t("account.f.eggs")} value={fmt(b.eggs.length)} />
      </div>
      {b.eggs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {b.eggs.map((e) => (
            <span key={e.id} className="chip inline-flex items-center gap-1">
              {e.name}{e.dexId ? ` · #${e.dexId}` : ""}{e.shiny && <span className="text-yellow"><Star size={9} /></span>}{e.ready && <span className="text-green">✓</span>}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}

function ItemsCard({ title, color, items }: { title: string; color: string; items: AccountItem[] }) {
  if (!items.length) return null;
  return (
    <Section title={`${title} (${items.length})`} color={color}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 rounded border border-border bg-[rgba(8,14,28,0.5)] px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Sprite src={assetIconUrl(it.icon)} alt={it.name} size={26} />
            </span>
            <div className="min-w-0 text-[0.6rem] leading-tight">
              <div className="truncate">{it.name}</div>
              <div className="tabular-nums text-text-dim">x{fmt(it.quantity)}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BallsCard({ account }: { account: Account }) {
  const t = useT();
  const balls = account.balls.filter((b) => b.count > 0 || b.selected || b.infinite);
  if (!balls.length) return null;
  return (
    <Section title={t("account.sec.balls")} color="text-cyan">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {balls.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 ${b.selected ? "border-[color:var(--cyan)] bg-[rgba(57,211,230,0.08)]" : "border-border bg-[rgba(8,14,28,0.5)]"}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <Sprite src={b.iconUrl ? assetIconUrl(b.iconUrl) : null} alt={b.name} size={22} />
            </span>
            <div className="min-w-0 text-[0.6rem] leading-tight">
              <div className={`truncate ${b.selected ? "text-cyan" : "text-text"}`}>{b.name}</div>
              <div className="tabular-nums text-text-dim">{b.infinite ? "∞" : `x${fmt(b.count)}`}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
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

export function AccountPanel({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });
  const nameById = (id: number) => creatures.find((c) => c.pokeId === id)?.name;

  const load = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/collection", { cache: "no-store" });
      if (res.status === 401) return setState({ status: "disconnected" });
      const j = (await res.json()) as { connected?: boolean; account?: Account };
      if (j.connected && j.account) setState({ status: "connected", account: j.account });
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

  const account = state.account;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pixel text-[0.72rem] text-green">{t("account.connected.title")}</h2>
        <button type="button" onClick={disconnect} className="btn btn-ghost">{t("account.disconnect")}</button>
      </div>
      <Overview account={account} />
      <TrainerCard account={account} />
      <AutomationCard account={account} nameById={nameById} />
      <StreakCard account={account} />
      <BreedingCard account={account} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ItemsCard title={t("account.sec.inventory")} color="text-green" items={account.inventory} />
        <ItemsCard title={t("account.sec.depot")} color="text-yellow" items={account.depot} />
      </div>
      <BallsCard account={account} />
      <MarketAdvisor creatures={creatures} />
    </div>
  );
}
