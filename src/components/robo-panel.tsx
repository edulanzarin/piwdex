"use client";

// Aba Robo (VIP) — 1a capacidade: configurar a AUTOMACAO NATIVA do jogo (Auto-Helper).
// Cada controle grava na conta REAL na hora (POST /api/vip/auto -> auto-helper). So
// config, reversivel. Auto-buy/sell dos desejos vem depois (nota no fim).

import { useEffect, useRef, useState } from "react";
import { LoadingBall } from "./loaders";
import { ToggleButton } from "./toggle-button";
import { Caret, Infinity_ } from "./icons";
import { useT } from "./locale-provider";

interface Auto {
  autoCatch: boolean;
  autoCatchBallId: number;
  autoCatchShiny: boolean;
  autoCatchShinyBallId: number;
  autoPotion: boolean;
  autoPotionThreshold: number;
  autoRevive: boolean;
  selectedBallId: number;
  isVip: boolean;
}
interface Ball {
  id: number;
  name: string;
  iconUrl: string;
  count: number;
  infinite: boolean;
}
type Field = "autoCatch" | "autoCatchBallId" | "autoCatchShiny" | "autoCatchShinyBallId" | "autoPotion" | "autoPotionThreshold" | "autoRevive" | "selectedBallId";

type Load = { s: "loading" } | { s: "error"; code: string } | { s: "ok"; auto: Auto; balls: Ball[] };

// ---- seletor de bola (icone + nome + quantidade) ----

function BallSelect({ balls, value, onChange, disabled }: { balls: Ball[]; value: number; onChange: (id: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = balls.find((b) => b.id === value);
  return (
    <div ref={box} className="relative w-full sm:w-56">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2 disabled:opacity-40"
      >
        <span className="flex min-w-0 items-center gap-2">
          {cur?.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.iconUrl} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
          )}
          <span className="truncate">{cur?.name ?? `#${value}`}</span>
        </span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={9} />
        </span>
      </button>
      {open && (
        <div role="listbox" className="card fadein absolute z-30 mt-1 max-h-64 w-full overflow-auto p-1" style={{ background: "var(--surface-solid)" }}>
          {balls.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onChange(b.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${b.id === value ? "bg-surface-2" : ""}`}
            >
              {b.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.iconUrl} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
              )}
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="flex shrink-0 items-center text-[0.6rem] text-text-dim">{b.infinite ? <Infinity_ size={13} /> : b.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- linha de config: label + descricao + controle ----

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="mt-0.5 text-[0.68rem] text-text-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function RoboPanel() {
  const t = useT();
  const [st, setSt] = useState<Load>({ s: "loading" });
  const [busy, setBusy] = useState<Field | null>(null);
  const [threshold, setThreshold] = useState(50); // local pro slider (commit no soltar)

  const load = async () => {
    try {
      const res = await fetch("/api/vip/auto", { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { auto?: Auto; balls?: Ball[]; error?: string };
      if (res.ok && j.auto) {
        setSt({ s: "ok", auto: j.auto, balls: j.balls ?? [] });
        setThreshold(j.auto.autoPotionThreshold);
      } else {
        setSt({ s: "error", code: j.error ?? "failed" });
      }
    } catch {
      setSt({ s: "error", code: "failed" });
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const set = async (field: Field, value: number | boolean) => {
    setBusy(field);
    try {
      const res = await fetch("/api/vip/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const j = (await res.json().catch(() => ({}))) as { auto?: Auto; balls?: Ball[] };
      if (res.ok && j.auto) {
        setSt({ s: "ok", auto: j.auto, balls: j.balls ?? [] });
        setThreshold(j.auto.autoPotionThreshold);
      }
    } finally {
      setBusy(null);
    }
  };

  if (st.s === "loading") return <div className="card p-6"><LoadingBall label={t("robo.loading")} /></div>;
  if (st.s === "error") {
    const msg = st.code === "not_connected" || st.code === "expired" ? t("robo.connect") : t("robo.error");
    return <div className="card p-6 text-sm text-text-dim">{msg}</div>;
  }

  const a = st.auto;
  const sw = (field: Field, on: boolean, disabled?: boolean) => (
    <ToggleButton active={on} accent="green" onClick={() => !disabled && set(field, !on)} title={disabled ? t("robo.vipOnly") : undefined}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "pulse-soft" : ""}`} style={{ background: on ? "var(--green)" : "var(--text-dim)" }} />
      {busy === field ? "…" : on ? t("robo.on") : t("robo.off")}
    </ToggleButton>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="section-title text-yellow">{t("robo.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.desc")}</p>
      </div>

      <div className="card z-20 flex flex-col p-5">
        <Row title={t("robo.autoCatch")} desc={a.isVip ? t("robo.autoCatch.desc") : t("robo.vipOnly")}>
          {sw("autoCatch", a.autoCatch, !a.isVip)}
        </Row>
        {a.autoCatch && a.isVip && (
          <Row title={t("robo.catchBall")} desc={t("robo.catchBall.desc")}>
            <BallSelect balls={st.balls} value={a.autoCatchBallId} onChange={(id) => set("autoCatchBallId", id)} disabled={busy === "autoCatchBallId"} />
          </Row>
        )}

        <Row title={t("robo.autoShiny")} desc={t("robo.autoShiny.desc")}>
          {sw("autoCatchShiny", a.autoCatchShiny, !a.isVip)}
        </Row>
        {a.autoCatchShiny && a.isVip && (
          <Row title={t("robo.shinyBall")} desc={t("robo.shinyBall.desc")}>
            <BallSelect balls={st.balls} value={a.autoCatchShinyBallId} onChange={(id) => set("autoCatchShinyBallId", id)} disabled={busy === "autoCatchShinyBallId"} />
          </Row>
        )}

        <Row title={t("robo.autoPotion")} desc={t("robo.autoPotion.desc")}>
          {sw("autoPotion", a.autoPotion)}
        </Row>
        {a.autoPotion && (
          <Row title={t("robo.threshold")} desc={t("robo.threshold.desc", { n: threshold })}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={95}
                step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onPointerUp={() => threshold !== a.autoPotionThreshold && set("autoPotionThreshold", threshold)}
                onKeyUp={() => threshold !== a.autoPotionThreshold && set("autoPotionThreshold", threshold)}
                className="w-40 accent-[color:var(--yellow)]"
              />
              <span className="w-9 text-right text-sm font-semibold tabular-nums text-yellow">{threshold}%</span>
            </div>
          </Row>
        )}

        <Row title={t("robo.autoRevive")} desc={t("robo.autoRevive.desc")}>
          {sw("autoRevive", a.autoRevive)}
        </Row>

        <Row title={t("robo.selectedBall")} desc={t("robo.selectedBall.desc")}>
          <BallSelect balls={st.balls} value={a.selectedBallId} onChange={(id) => set("selectedBallId", id)} disabled={busy === "selectedBallId"} />
        </Row>
      </div>
    </div>
  );
}
