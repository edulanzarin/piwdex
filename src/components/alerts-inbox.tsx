"use client";

// Aba Alertas (VIP): a CENTRAL de eventos — o "grosso", nao cada anuncio. Hoje resume
// os achados por desejo ("N Golem achados pro seu desejo"); clicar leva pra aba Desejos,
// onde ficam os pokemon em si. Nasce pronta pra crescer: com o robo, aqui vao cair
// eventos tipo "vendeu X itens", "foi pra hunt Y", "voltou pra cidade" — cada um com
// seu icone/cor. Leitura pura: os dados chegam pelo stream ao vivo (useVipLive).

import { useMemo } from "react";
import { spriteUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { useT } from "./locale-provider";
import { Bell, ChevronRight } from "./icons";
import { Panel } from "./ui/panel";
import { useVipLive } from "./vip-live";

// Um desejo com achados, agregado pro resumo.
interface Group {
  watchlistId: string;
  label: string | null;
  speciesId: number;
  total: number;
  unread: number;
}

function SummaryCard({ g, onOpen, t }: { g: Group; onOpen: () => void; t: (k: string, v?: Record<string, string | number>) => string }) {
  const name = g.label ?? t("alerts.anySpecies");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card card-link flex w-full items-center gap-3 p-3 text-left"
      style={{
        borderColor: g.unread > 0 ? "var(--green)" : "var(--border)",
        background: g.unread > 0 ? "color-mix(in srgb, var(--green) 8%, transparent)" : "transparent",
      }}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
        <Sprite src={g.speciesId ? spriteUrl(g.speciesId) : null} alt={name} size={40} />
        {g.unread > 0 && <span className="pulse-soft absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-green" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="field-label flex items-center gap-1 text-green">
          <Bell size={9} /> {t("alerts.kind.snipe")}
        </div>
        <div className="mt-0.5 pixel text-[1rem] text-text">{t("alerts.found", { n: g.total, name })}</div>
        {g.unread > 0 && <div className="mt-0.5 text-[0.82rem] text-green">{t("alerts.newCount", { n: g.unread })}</div>}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-[0.8rem] text-cyan">{t("alerts.see")} <ChevronRight size={10} /></span>
    </button>
  );
}

export function AlertsInbox({ onJumpToWish }: { onJumpToWish?: (watchlistId: string) => void }) {
  const t = useT();
  const { alerts, applyAlerts } = useVipLive();
  const notifications = alerts?.notifications ?? [];

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const n of notifications) {
      const d = (n.data ?? {}) as Record<string, unknown>;
      const wid = String(d.watchlistId ?? "");
      if (!wid) continue;
      const g = m.get(wid) ?? {
        watchlistId: wid,
        label: (d.wishLabel as string) ?? null,
        speciesId: Number(d.speciesId ?? 0),
        total: 0,
        unread: 0,
      };
      g.total++;
      if (!n.readAt) g.unread++;
      m.set(wid, g);
    }
    return [...m.values()].sort((a, b) => b.unread - a.unread || b.total - a.total);
  }, [notifications]);

  const markAll = async () => {
    // otimista: preenche readAt local e zera o contador; o stream confirma depois
    applyAlerts({ notifications: notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unread: 0 });
    await fetch("/api/vip/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  };

  const totalUnread = groups.reduce((a, g) => a + g.unread, 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel
        icon={<Bell size={12} />} accent="var(--green)"
        title={<span className="text-green">{t("alerts.inbox.title")}{totalUnread > 0 ? ` (${totalUnread})` : ""}</span>}
        right={totalUnread > 0 ? <button type="button" onClick={markAll} className="btn btn-ghost">{t("alerts.markAll")}</button> : undefined}
      >
        {alerts == null ? (
          <LoadingBall label={t("alerts.loading")} />
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-text-dim/50"><Bell size={40} /></span>
            <p className="max-w-sm text-[0.92rem] leading-relaxed text-text-dim">{t("alerts.inbox.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {groups.map((g) => (
              <SummaryCard key={g.watchlistId} g={g} t={t} onOpen={() => onJumpToWish?.(g.watchlistId)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
