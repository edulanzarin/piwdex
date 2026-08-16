"use client";

// Aba Alertas (VIP): a CENTRAL de notificacoes. Hoje so tem snipe (anuncio do mercado
// que bateu um Desejo), mas e o lugar que une todo tipo de alerta — desenhada pra
// crescer: cada tipo tem seu icone pixel e cor. Clicar leva pro Mercado; dispensar some
// e nao volta (tombstone no banco); pausar/excluir o Desejo tira os alertas dele.

import { useEffect, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import type { Notification, NotifKind } from "@/lib/alerts";
import type { Currency } from "@/lib/game-account";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { useT } from "./locale-provider";
import { Bell, Coin, Diamond } from "./icons";

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

// Cor/rotulo por tipo de alerta (so snipe por ora; a central ja nasce pronta pra mais).
const KIND_ACCENT: Record<NotifKind, string> = { snipe: "var(--green)" };
const KIND_TEXT: Record<NotifKind, string> = { snipe: "text-green" };

function NotifItem({ n, onOpen, onDismiss }: { n: Notification; onOpen: () => void; onDismiss: () => void }) {
  const t = useT();
  const speciesId = typeof n.data?.speciesId === "number" ? (n.data.speciesId as number) : null;
  const shiny = Boolean(n.data?.shiny);
  const currency = n.data?.currency as Currency | undefined;
  const accent = KIND_ACCENT[n.kind] ?? "var(--cyan)";
  return (
    <div
      className="flex items-stretch gap-3 rounded border p-2.5 transition"
      style={{
        borderColor: n.readAt ? "var(--border)" : accent,
        background: n.readAt ? "transparent" : `color-mix(in srgb, ${accent} 8%, transparent)`,
      }}
    >
      <button type="button" onClick={onOpen} title={t("alerts.open")} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={speciesId ? spriteUrl(speciesId, shiny) : null} alt={n.title} size={40} />
          {!n.readAt && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: accent }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1 text-[0.5rem] uppercase tracking-wide ${KIND_TEXT[n.kind] ?? "text-cyan"}`}>
            <Bell size={9} /> {t("alerts.kind.snipe")}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-text">
            {currency === "DIAMONDS" ? <Diamond size={11} /> : <Coin size={11} />}
            <span className="truncate">{n.title}</span>
          </div>
          {n.body && <div className="mt-0.5 truncate text-[0.66rem] text-text-dim">{n.body}</div>}
          <div className="mt-1 text-[0.55rem] text-cyan">{t("alerts.open")} ›</div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <button type="button" onClick={onDismiss} title={t("alerts.dismiss")} aria-label={t("alerts.dismiss")} className="text-text-dim transition hover:text-red">✕</button>
        <span className="text-[0.55rem] text-text-dim">{ago(n.createdAt)}</span>
      </div>
    </div>
  );
}

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

export function AlertsInbox({
  onUnread,
  onJumpToMarket,
}: {
  onUnread?: (n: number) => void;
  onJumpToMarket?: (speciesId: number) => void;
}) {
  const t = useT();
  const [inbox, setInbox] = useState<Load<Notification[]>>({ status: "loading" });

  const load = async () => {
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInMarket = (n: Notification) => {
    const sp = typeof n.data?.speciesId === "number" ? (n.data.speciesId as number) : null;
    if (!n.readAt) {
      setInbox((s) => (s.status === "ok" ? { status: "ok", data: s.data.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) } : s));
      fetch("/api/vip/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) })
        .then((r) => r.json())
        .then((j: { unread?: number }) => onUnread?.(j.unread ?? 0))
        .catch(() => {});
    }
    if (sp != null) onJumpToMarket?.(sp);
  };
  const dismiss = async (id: string) => {
    if (inbox.status === "ok") setInbox({ status: "ok", data: inbox.data.filter((n) => n.id !== id) });
    const res = await fetch("/api/vip/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: [id] }),
    });
    const j = (await res.json().catch(() => ({}))) as { unread?: number };
    onUnread?.(j.unread ?? 0);
  };
  const markAll = async () => {
    if (inbox.status === "ok") setInbox({ status: "ok", data: inbox.data.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) });
    await fetch("/api/vip/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    onUnread?.(0);
  };

  const unread = inbox.status === "ok" ? inbox.data.filter((n) => !n.readAt).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-green">
          <Bell size={15} /> {t("alerts.inbox.title")}
          {unread > 0 && <span className="rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] text-[#06131a]">{unread}</span>}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("alerts.inbox.desc")}</p>
      </div>

      <div className="card p-4">
        {unread > 0 && (
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={markAll} className="btn btn-ghost">{t("alerts.markAll")}</button>
          </div>
        )}
        {inbox.status === "loading" ? (
          <LoadingBall label={t("alerts.loading")} />
        ) : inbox.status === "error" ? (
          <p className="text-[0.72rem] text-text-dim">{t("alerts.error")}</p>
        ) : inbox.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-text-dim/50"><Bell size={40} /></span>
            <p className="max-w-sm text-[0.72rem] leading-relaxed text-text-dim">{t("alerts.inbox.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {inbox.data.map((n) => (
              <NotifItem key={n.id} n={n} onOpen={() => openInMarket(n)} onDismiss={() => dismiss(n.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
