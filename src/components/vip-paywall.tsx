"use client";

// Paywall do VIP: o ROBO e o heroi (ja esta pronto — caca/venda/compra no automatico,
// cerebro de hunt, analyzer ao vivo). Card de destaque no topo + lista do que vem junto,
// preco e botao Assinar. O botao chama /api/vip/checkout, que devolve a URL do Mercado
// Pago (PIX). Banner de status pelo ?status da volta.

import { useState } from "react";
import { useT } from "./locale-provider";
import { Star, ChevronRight, Robot, Brain, Chart, Dollar, Signal } from "./icons";

// o que vem junto do robo (bullets da lista). Icone + chave de texto.
const FEATURES: { Icon: (p: { size?: number; className?: string }) => React.ReactNode; k: string }[] = [
  { Icon: Brain, k: "vip.feat.brain" },
  { Icon: Chart, k: "vip.feat.analyzer" },
  { Icon: Dollar, k: "vip.feat.market" }, // "$" herda currentColor (cyan) — combina com os outros
  { Icon: Signal, k: "vip.feat.alerts" },
];

// chips do heroi: o que o robo faz sozinho
const ROBOT_CHIPS = ["vip.chip.247", "vip.chip.catch", "vip.chip.sell", "vip.chip.buy", "vip.chip.pickhunt", "vip.chip.level"] as const;

// classes estaticas (Tailwind nao ve string interpolada).
const BANNERS: Record<string, { cls: string; k: string }> = {
  approved: { cls: "border-[color:var(--green)]/50 text-green", k: "vip.status.approved" },
  pending: { cls: "border-[color:var(--yellow)]/50 text-yellow", k: "vip.status.pending" },
  failure: { cls: "border-[color:var(--red)]/50 text-red", k: "vip.status.failure" },
};

export function VipPaywall({ status }: { status: string | null }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subscribe = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/vip/checkout", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      setErr(t(`vip.err.${j.error ?? "failed"}`));
    } catch {
      setErr(t("vip.err.failed"));
    } finally {
      setBusy(false);
    }
  };

  const banner = status ? BANNERS[status] : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <div className="text-center">
        <h1 className="pixel text-2xl text-yellow sm:text-3xl">{t("vip.paywall.title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-text-dim">{t("vip.paywall.desc")}</p>
      </div>

      {banner && <div className={`glass rounded border px-4 py-2 text-base ${banner.cls}`}>{t(banner.k)}</div>}

      {/* HERO do robo — o carro-chefe, ja pronto */}
      <div
        className="glow-pulse card relative overflow-hidden p-5 sm:p-6"
        style={{ "--accent": "var(--yellow)", borderColor: "color-mix(in srgb, var(--yellow) 55%, transparent)", background: "color-mix(in srgb, var(--yellow) 8%, var(--surface))" } as React.CSSProperties}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[color:var(--yellow)]/50 bg-[var(--well-bg)] text-yellow">
            <Robot size={40} />
          </div>
          <div className="min-w-0">
            <div className="section-title mb-1 flex items-center gap-2 text-yellow">
              <Star size={18} /> {t("vip.hero.badge")}
            </div>
            <h2 className="pixel text-xl leading-snug text-yellow">{t("vip.hero.robot.title")}</h2>
            <p className="mt-2 text-base leading-relaxed text-text-dim">{t("vip.hero.robot.desc")}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ROBOT_CHIPS.map((k) => (
            <span key={k} className="chip border border-[color:var(--yellow)]/40 text-sm" style={{ color: "var(--yellow)" }}>
              {t(k)}
            </span>
          ))}
        </div>
      </div>

      {/* o que mais vem junto */}
      <div className="card flex flex-col gap-4 p-5 sm:p-6">
        <div className="section-title text-cyan">{t("vip.included")}</div>
        <ul className="flex flex-col gap-3">
          {FEATURES.map(({ Icon, k }) => (
            <li key={k} className="flex items-start gap-3 text-base">
              <span className="mt-0.5 shrink-0 text-cyan"><Icon size={16} /></span>
              <span className="leading-relaxed">{t(k)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="pixel text-lg text-yellow">{t("vip.price")}</div>
            <div className="text-sm text-text-dim">{t("vip.priceNote")}</div>
          </div>
          {/* min-w cabe o rotulo mais largo ("Assinando...") em caixa alta: trocar de
              estado nao muda a largura do botao. No celular ele ocupa a linha inteira —
              a 360px os 11rem do botao nao deixavam calha pro preco do lado. */}
          <button type="button" onClick={subscribe} disabled={busy} className="btn btn-yellow w-full shrink-0 disabled:opacity-50 sm:w-auto sm:min-w-[11rem]">
            {busy ? `${t("vip.subscribing")}...` : <>{t("vip.subscribe")} <ChevronRight size={14} /></>}
          </button>
        </div>
        {/* slot do erro sempre reservado: a mensagem aparecer nao empurra o card */}
        <p className={`min-h-[1.5rem] text-base ${err ? "text-red" : "slot-empty"}`}>{err ?? "—"}</p>
      </div>
    </div>
  );
}
