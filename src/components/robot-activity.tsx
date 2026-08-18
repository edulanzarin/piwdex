"use client";

// Atividade do robo na aba Alertas: o que a Hunt e a venda automatica fizeram enquanto
// rodavam, INCLUSIVE offline (gravado no banco). Le do stream ao vivo (useVipLive) e marca
// tudo como lido ao abrir. Texto localizado a partir do kind + data do evento.

import { useCallback, useEffect, useRef } from "react";
import { useT } from "./locale-provider";
import { Star, Coin, Loot, Skull, Brain, Signal, Flag } from "./icons";
import { useVipLive, type LiveEvent } from "./vip-live";
import { Panel } from "./ui/panel";
import { FeedRow, EmptyState } from "./ui/feed";

const num = (v: unknown) => Math.round(Number(v ?? 0)).toLocaleString("pt-BR");
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export function RobotActivity() {
  const t = useT();
  const { events: live, applyEvents } = useVipLive();
  const events = live?.events ?? [];

  // ao abrir a aba, marca tudo como lido no servidor e zera o contador local
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => {
    fetch("/api/vip/events", { method: "POST" })
      .then(() => applyEvents({ events: liveRef.current?.events ?? [], unread: 0 }))
      .catch(() => {});
  }, [applyEvents]);

  // limpa o feed inteiro (some tudo). Alem disso o backend expira sozinho o que passa de 48h.
  const clear = useCallback(async () => {
    applyEvents({ events: [], unread: 0 });
    try { await fetch("/api/vip/events", { method: "DELETE" }); } catch {}
  }, [applyEvents]);

  const render = (e: LiveEvent): { icon: React.ReactNode; text: string; tone?: string } => {
    const d = e.data ?? {};
    switch (e.kind) {
      case "shiny":
        return { icon: <Star size={13} className="text-yellow" />, text: t("evt.shiny").replace("{species}", String(d.species ?? "?")), tone: "text-yellow" };
      case "hunt-summary":
        return { icon: <Skull size={12} className="text-text-dim" />, text: t("evt.huntSummary").replace("{slug}", String(d.slug ?? "")).replace("{kills}", num(d.kills)).replace("{captures}", num(d.captures)).replace("{balance}", num(d.balance)) };
      case "poke-sold":
        return { icon: <Coin size={12} />, text: t("evt.pokeSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-sold":
        return { icon: <Loot size={12} />, text: t("evt.itemSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-bought":
        return { icon: <Loot size={12} />, text: e.title, tone: "text-text-dim" };
      case "brain":
        return { icon: <Brain size={13} className="text-cyan" />, text: e.title, tone: "text-cyan" };
      case "reconnect":
        return { icon: <Signal size={13} className="text-green" />, text: e.title, tone: "text-green" };
      case "goal":
        return { icon: <Flag size={13} className="text-purple" />, text: e.title, tone: "text-purple" };
      case "error":
        // falha operacional (venda/compra que nao rodou) — o corpo diz o motivo
        return { icon: <Skull size={13} className="text-red" />, text: e.body ? `${e.title} — ${e.body}` : e.title, tone: "text-red" };
      default:
        return { icon: null, text: e.title };
    }
  };

  // sempre os ultimos 10 (o backend ja limita/expira; corta aqui por garantia)
  const shown = events.slice(0, 10);

  return (
    <Panel
      title={<span className="text-cyan">{t("evt.title")}</span>}
      right={events.length > 0 ? <button type="button" onClick={clear} className="btn btn-ghost">{t("evt.clear")}</button> : undefined}
    >
      {shown.length === 0 ? (
        <EmptyState compact message={t("evt.empty")} />
      ) : (
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
          {shown.map((e, idx) => {
            const r = render(e);
            return (
              <FeedRow
                key={e.id}
                flash={idx === 0}
                leading={<span className="flex h-6 w-6 items-center justify-center">{r.icon}</span>}
                title={<span className={r.tone ?? "text-text"}>{r.text}</span>}
                right={<span className="tabular-nums text-[0.75rem] text-text-dim">{when(e.createdAt)}</span>}
              />
            );
          })}
        </div>
      )}
    </Panel>
  );
}
