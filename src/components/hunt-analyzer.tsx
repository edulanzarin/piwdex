"use client";

// Hunt Analyzer ao vivo (secao do Robo). Liga/desliga a sessao que o piwdex segura no
// servidor (POST /api/vip/hunt) e faz poll do estado (GET) a cada 5s enquanto ao vivo.
// Ver src/lib/game-hunt-session.ts. Single-session: ligar desconecta o jogo no browser.

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./locale-provider";
import { Coin, Star } from "./icons";

interface Analyzer {
  kills: number; seconds: number; xpGained: number;
  lootGold: number; supplyGold: number; balance: number;
  goldPerHour: number; xpPerHour: number; captures: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
interface KillLog { at: number; species: string; shiny: boolean; xp: number; loot: { name: string; qty: number }[] }
type Status = "idle" | "connecting" | "running" | "kicked" | "error";
interface HuntState { status: Status; slug: string | null; analyzer: Analyzer | null; recentKills: KillLog[] }

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const hm = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const STATUS_COLOR: Record<Status, string> = { idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)", kicked: "var(--yellow)", error: "var(--pink)" };

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`mt-1 pixel text-[0.7rem] ${accent ? "text-yellow" : "text-text"}`}>{value}</div>
    </div>
  );
}

export function HuntAnalyzer() {
  const t = useT();
  const [st, setSt] = useState<HuntState | null>(null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/vip/hunt", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as HuntState | null;
      if (j) { setSt(j); if (j.slug && !slug) setSlug(j.slug); }
    } catch {}
  }, [slug]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // poll continuo (2s) — reflete o analyzer ao vivo sem depender de estado intermediario
  useEffect(() => {
    timer.current = setInterval(load, 2000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [load]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => null)) as HuntState | null;
      if (j && "status" in j) setSt(j);
    } finally { setBusy(false); }
  };

  const status = st?.status ?? "idle";
  const running = status === "running" || status === "connecting";
  const a = st?.analyzer ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-yellow"><Star size={13} /> {t("robo.hunt.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.hunt.desc")}</p>
      </div>

      {/* controle */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
          {t(`robo.hunt.status.${status}`)}
        </span>
        {!running ? (
          <>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t("robo.hunt.slugPh")}
              className="input w-40"
            />
            <button type="button" onClick={() => slug.trim() && send({ action: "start", slug: slug.trim() })} disabled={busy || !slug.trim()} className="btn btn-cyan disabled:opacity-40">
              {t("robo.hunt.start")} ›
            </button>
          </>
        ) : (
          <button type="button" onClick={() => send({ action: "stop" })} disabled={busy} className="btn btn-ghost">{t("robo.hunt.stop")}</button>
        )}
      </div>

      {/* stats */}
      {a && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t("robo.hunt.kills")} value={fmt(a.kills)} />
          <Stat label={t("robo.hunt.time")} value={hm(a.seconds)} />
          <Stat label={t("robo.hunt.xph")} value={fmt(a.xpPerHour)} />
          <Stat label={t("robo.hunt.goldph")} value={fmt(a.goldPerHour)} accent />
          <Stat label={t("robo.hunt.loot")} value={fmt(a.lootGold)} />
          <Stat label={t("robo.hunt.supply")} value={`-${fmt(a.supplyGold)}`} />
          <Stat label={t("robo.hunt.captures")} value={fmt(a.captures)} />
          <Stat label={t("robo.hunt.balance")} value={fmt(a.balance)} accent />
        </div>
      )}

      {/* ultimos kills ao vivo */}
      {st?.recentKills && st.recentKills.length > 0 && (
        <div className="card p-4">
          <h3 className="pixel mb-2 text-[0.6rem] text-cyan">{t("robo.hunt.recent")}</h3>
          <div className="flex max-h-56 flex-col gap-1 overflow-auto pr-1">
            {st.recentKills.map((k, i) => (
              <div key={k.at + "-" + i} className="flex items-center gap-2 text-[0.72rem]">
                {k.shiny && <span className="text-yellow"><Star size={9} /></span>}
                <span className="min-w-0 flex-1 truncate">{k.species}</span>
                {k.loot.length > 0 && <span className="truncate text-text-dim">{k.loot.map((l) => `${l.name} x${l.qty}`).join(", ")}</span>}
                <span className="shrink-0 inline-flex items-center gap-1 text-yellow"><Coin size={10} />{fmt(k.xp)} xp</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
