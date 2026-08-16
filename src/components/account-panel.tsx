"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { AccountMon } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { useT } from "./locale-provider";

const q3 = (n: number | null) => (n == null ? "—" : n.toFixed(3));
const ivColor = (v: number) => (v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

type State =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; mons: AccountMon[]; raw: unknown };

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const t = useT();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) {
        onConnected();
        return;
      }
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
      <textarea
        className="input mt-4 h-24 w-full font-mono text-[0.72rem]"
        placeholder={t("account.connect.placeholder")}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        spellCheck={false}
      />
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

function MonCard({ mon }: { mon: AccountMon }) {
  const t = useT();
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
        <Sprite src={mon.pokeId ? spriteUrl(mon.pokeId, mon.shiny) : null} alt={mon.name} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{mon.name}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.62rem] text-text-dim">
          <span>{t("account.col.level")} <span className="text-text">{mon.level ?? "—"}</span></span>
          <span>{t("account.col.quality")} <span className="text-cyan">{q3(mon.quality)}</span></span>
          {mon.power != null && <span>{t("account.col.power")} <span className="text-yellow">{mon.power.toLocaleString("pt-BR")}</span></span>}
          {mon.ivTotal != null && <span>{t("account.col.iv")} <span className={ivColor(mon.ivTotal)}>{mon.ivTotal}</span>/192</span>}
        </div>
      </div>
    </div>
  );
}

export function AccountPanel() {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const load = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/collection?raw=1", { cache: "no-store" });
      if (res.status === 401) {
        setState({ status: "disconnected" });
        return;
      }
      const j = (await res.json()) as { connected?: boolean; mons?: AccountMon[]; raw?: unknown };
      if (j.connected) setState({ status: "connected", mons: j.mons ?? [], raw: j.raw });
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

  const mons = state.status === "connected" ? state.mons : [];
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query ? mons.filter((m) => m.name.toLowerCase().includes(query)) : mons;
    return [...list].sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
  }, [mons, search]);

  if (state.status === "loading") return <div className="card p-8"><LoadingBall label={t("account.loading")} /></div>;
  if (state.status === "disconnected") return <ConnectForm onConnected={load} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pixel text-[0.72rem] text-green">{t("account.connected.title")}</h2>
        <button type="button" onClick={disconnect} className="btn btn-ghost">{t("account.disconnect")}</button>
      </div>

      {mons.length === 0 ? (
        <div className="card p-6 text-sm text-text-dim">{t("account.empty")}</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.62rem] text-text-dim">{t("account.count", { n: mons.length })}</span>
            <input className="input max-w-xs" placeholder={t("account.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m, i) => <MonCard key={`${m.pokeId}-${m.name}-${i}`} mon={m} />)}
          </div>
        </>
      )}

      {/* dado bruto — pra finalizar o mapeamento de campos com a resposta real */}
      <div className="card p-4">
        <button type="button" onClick={() => setShowRaw((s) => !s)} className="pixel text-[0.58rem] text-text-dim hover:text-cyan">
          {t("account.rawToggle")} {showRaw ? "−" : "+"}
        </button>
        {showRaw && (
          <>
            <p className="mt-2 text-[0.6rem] leading-relaxed text-text-dim">{t("account.rawNote")}</p>
            <pre className="mt-2 max-h-96 overflow-auto rounded border border-border bg-[rgba(8,14,28,0.6)] p-3 text-[0.62rem] leading-relaxed text-text-dim">
              {JSON.stringify(state.raw, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
