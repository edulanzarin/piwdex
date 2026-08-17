"use client";

// Paywall do VIP: lista o que destrava, preco e botao Assinar. O botao chama
// /api/vip/checkout, que devolve a URL do Mercado Pago (ou, em dev sem credencial,
// libera direto e devolve /vip?status=test). Banner de status pelo ?status da volta.

import { useState } from "react";
import { useT } from "./locale-provider";
import { Star, ChevronRight } from "./icons";

const BENEFITS = ["vip.benefit.market", "vip.benefit.alerts", "vip.benefit.robot"] as const;

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
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-4">
      <div className="text-center">
        <div className="eyebrow mb-2">{t("vip.eyebrow")}</div>
        <h1 className="pixel text-xl text-yellow">{t("vip.paywall.title")}</h1>
        <p className="mt-3 text-sm text-text-dim">{t("vip.paywall.desc")}</p>
      </div>

      {banner && <div className={`rounded border px-4 py-2 text-[0.75rem] ${banner.cls}`}>{t(banner.k)}</div>}

      <div className="card flex flex-col gap-4 p-6">
        <ul className="flex flex-col gap-2.5">
          {BENEFITS.map((k) => (
            <li key={k} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 text-yellow"><Star size={12} /></span>
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="pixel text-lg text-yellow">{t("vip.price")}</div>
            <div className="text-[0.6rem] text-text-dim">{t("vip.priceNote")}</div>
          </div>
          <button type="button" onClick={subscribe} disabled={busy} className="btn btn-cyan disabled:opacity-50">
            {busy ? `${t("vip.subscribing")}...` : <>{t("vip.subscribe")} <ChevronRight size={10} /></>}
          </button>
        </div>
        {err && <p className="text-[0.72rem] font-semibold text-red">{err}</p>}
      </div>
    </div>
  );
}
