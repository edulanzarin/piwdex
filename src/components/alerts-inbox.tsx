"use client";

// Aba Alertas (VIP): a CENTRAL de eventos — o "grosso", nao cada anuncio. Hoje resume
// os achados por desejo ("N Golem achados pro seu desejo"); clicar leva pra aba Desejos,
// onde ficam os pokemon em si. Nasce pronta pra crescer: com o robo, aqui vao cair
// eventos tipo "vendeu X itens", "foi pra hunt Y", "voltou pra cidade" — cada um com
// seu icone/cor. Leitura pura: os dados chegam pelo stream ao vivo (useVipLive).

import { useMemo } from "react";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
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
  itemIcon: string | null; // desejo de ITEM: icone do catalogo (name -> icon)
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
        // com achados novos o vidro ganha um veu verde; sem eles fica o vidro puro do
        // .card (nada de "transparent" aqui: apagava a superficie e chapava o card)
        background: g.unread > 0 ? "color-mix(in srgb, var(--green) 12%, var(--surface))" : undefined,
      }}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
        {g.itemIcon
          ? <Sprite src={assetIconUrl(g.itemIcon)} alt={name} size={34} />
          : <Sprite src={g.speciesId ? spriteUrl(g.speciesId) : null} alt={name} size={40} />}
        {g.unread > 0 && <span className="pulse-soft absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-green" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="field-label flex items-center gap-1 text-green">
          <Bell size={14} /> {t("alerts.kind.snipe")}
        </div>
        <div className="mt-0.5 truncate pixel text-base text-text" title={t("alerts.found", { n: g.total, name })}>{t("alerts.found", { n: g.total, name })}</div>
        {/* linha de nao lidos SEMPRE presente: sem novos vira slot esmaecido (card de altura fixa) */}
        <div className={`mt-0.5 text-sm ${g.unread > 0 ? "text-green" : "slot-empty"}`}>
          {g.unread > 0 ? t("alerts.newCount", { n: g.unread }) : "—"}
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-cyan">{t("alerts.see")} <ChevronRight size={14} /></span>
    </button>
  );
}

export function AlertsInbox({ onJumpToWish, itemIcons }: { onJumpToWish?: (watchlistId: string) => void; itemIcons?: Record<string, string> }) {
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
        itemIcon: d.kind === "item" ? (itemIcons?.[String(d.name ?? "").toLowerCase()] ?? null) : null,
        total: 0,
        unread: 0,
      };
      g.total++;
      if (!n.readAt) g.unread++;
      m.set(wid, g);
    }
    return [...m.values()].sort((a, b) => b.unread - a.unread || b.total - a.total);
  }, [notifications, itemIcons]);

  const markAll = async () => {
    // otimista: preenche readAt local e zera o contador; o stream confirma depois
    applyAlerts({ notifications: notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unread: 0 });
    await fetch("/api/vip/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  };

  const totalUnread = groups.reduce((a, g) => a + g.unread, 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel
        icon={<Bell size={18} />} accent="var(--green)"
        title={<>{t("alerts.inbox.title")}{totalUnread > 0 ? ` (${totalUnread})` : ""}</>}
        // botao sempre no slot: invisible reserva o espaco (o cabecalho nao muda de altura)
        right={<button type="button" onClick={markAll} className={`btn btn-ghost btn-sm ${totalUnread > 0 ? "" : "invisible"}`}>{t("alerts.markAll")}</button>}
      >
        {/* feed vivo: ALTURA FIXA com rolagem propria — grupo novo chegando nao empurra a pagina.
            Carregando e vazio ocupam exatamente a mesma caixa. */}
        {alerts == null ? (
          <div className="flex h-80 items-center justify-center"><LoadingBall label={t("alerts.loading")} /></div>
        ) : groups.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
            <span className="text-text-dim/50"><Bell size={40} /></span>
            <p className="max-w-sm text-base leading-relaxed text-text-dim">{t("alerts.inbox.empty")}</p>
          </div>
        ) : (
          <div className="grid h-80 content-start gap-2 overflow-y-auto pr-1">
            {groups.map((g) => (
              <SummaryCard key={g.watchlistId} g={g} t={t} onOpen={() => onJumpToWish?.(g.watchlistId)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
