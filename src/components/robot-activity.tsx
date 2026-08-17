"use client";

// Atividade do robo na aba Alertas: o que a Hunt e a venda automatica fizeram enquanto
// rodavam, INCLUSIVE offline (gravado no banco). Le /api/vip/events (poll 5s) e marca
// tudo como lido ao abrir. Texto localizado a partir do kind + data do evento.

import { useCallback, useEffect, useState } from "react";
import { useT } from "./locale-provider";
import { Star, Coin, Skull } from "./icons";

interface Ev { id: string; kind: string; title: string; body: string | null; data: Record<string, unknown> | null; createdAt: string; readAt: string | null }

const num = (v: unknown) => Math.round(Number(v ?? 0)).toLocaleString("pt-BR");
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export function RobotActivity() {
  const t = useT();
  const [events, setEvents] = useState<Ev[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/events", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { events?: Ev[] } | null;
      if (j?.events) setEvents(j.events);
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  // ao abrir a aba, marca tudo como lido
  useEffect(() => { fetch("/api/vip/events", { method: "POST" }).catch(() => {}); }, []);

  // limpa o feed inteiro (some tudo). Alem disso o backend expira sozinho o que passa de 48h.
  const clear = useCallback(async () => {
    setEvents([]);
    try { await fetch("/api/vip/events", { method: "DELETE" }); } catch {}
  }, []);

  const render = (e: Ev): { icon: React.ReactNode; text: string; tone?: string } => {
    const d = e.data ?? {};
    switch (e.kind) {
      case "shiny":
        return { icon: <Star size={13} className="text-yellow" />, text: t("evt.shiny").replace("{species}", String(d.species ?? "?")), tone: "text-yellow" };
      case "hunt-summary":
        return { icon: <Skull size={12} className="text-text-dim" />, text: t("evt.huntSummary").replace("{slug}", String(d.slug ?? "")).replace("{kills}", num(d.kills)).replace("{captures}", num(d.captures)).replace("{balance}", num(d.balance)) };
      case "poke-sold":
        return { icon: <Coin size={12} />, text: t("evt.pokeSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-sold":
        return { icon: <Coin size={12} />, text: t("evt.itemSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-bought":
        return { icon: <Coin size={12} />, text: e.title, tone: "text-text-dim" };
      default:
        return { icon: null, text: e.title };
    }
  };

  // sempre os ultimos 10 (o backend ja limita/expira; corta aqui por garantia)
  const shown = events.slice(0, 10);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="section-title text-cyan">{t("evt.title")}</h3>
        {events.length > 0 && (
          <button type="button" onClick={clear} className="btn btn-ghost">{t("evt.clear")}</button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-[0.72rem] text-text-dim">{t("evt.empty")}</p>
      ) : (
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
          {shown.map((e) => {
            const r = render(e);
            return (
              <div key={e.id} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">{r.icon}</span>
                <span className={`min-w-0 flex-1 truncate text-[0.72rem] ${r.tone ?? "text-text"}`}>{r.text}</span>
                <span className="shrink-0 tabular-nums text-[0.55rem] text-text-dim">{when(e.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
