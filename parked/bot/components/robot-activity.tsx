"use client";

// Atividade do robo na aba Alertas: o que a Hunt e a venda automatica fizeram enquanto
// rodavam, INCLUSIVE offline (gravado no banco). Le do stream ao vivo (useVipLive) e marca
// tudo como lido ao abrir. Texto localizado a partir do kind + data do evento.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./locale-provider";
import { Star, Coin, Loot, Skull, Brain, Signal, Flag, Heart } from "./icons";
import { useVipLive, type LiveEvent } from "./vip-live";
import { Panel } from "./ui/panel";
import { FeedRow, EmptyState } from "./ui/feed";

const num = (v: unknown) => Math.round(Number(v ?? 0)).toLocaleString("pt-BR");
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Quantos kinds o filtro oferece. Sem filtro, procurar "por que o robo parou ontem"
 *  e rolar 300 linhas de resumo de hunt. */
const FILTERS = ["all", "problema", "hunt", "venda", "cerebro"] as const;
type Filter = (typeof FILTERS)[number];

const GROUP: Record<string, Filter> = {
  error: "problema", blocked: "problema", reconnect: "problema", heal: "problema",
  "hunt-summary": "hunt", goal: "hunt", brain: "cerebro",
  "poke-sold": "venda", "item-sold": "venda", "item-bought": "venda", shiny: "hunt",
};

export function RobotActivity() {
  const t = useT();
  const { events: live, applyEvents } = useVipLive();
  // `more` = historico completo puxado sob demanda; enquanto nao pedirem, vale o do stream
  const [more, setMore] = useState<LiveEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const events = more ?? live?.events ?? [];

  // ao abrir a aba, marca tudo como lido no servidor e zera o contador local
  const liveRef = useRef(live);
  liveRef.current = live;
  useEffect(() => {
    fetch("/api/vip/events", { method: "POST" })
      .then(() => applyEvents({ events: liveRef.current?.events ?? [], unread: 0 }))
      .catch(() => {});
  }, [applyEvents]);

  // limpa o feed inteiro (some tudo). Alem disso o backend expira sozinho o que envelhece.
  const clear = useCallback(async () => {
    applyEvents({ events: [], unread: 0 });
    setMore(null);
    try { await fetch("/api/vip/events", { method: "DELETE" }); } catch {}
  }, [applyEvents]);

  // o stream manda os ultimos 40; o resto do historico so vem quando se pede
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vip/events?limit=800", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { events?: LiveEvent[] } | null;
      if (j?.events) setMore(j.events);
    } catch { /* fica com o que o stream deu */ } finally { setLoading(false); }
  }, []);

  const render = (e: LiveEvent): { icon: React.ReactNode; text: string; tone?: string } => {
    const d = e.data ?? {};
    switch (e.kind) {
      case "shiny":
        return { icon: <Star size={16} className="text-yellow" />, text: t("evt.shiny").replace("{species}", String(d.species ?? "?")), tone: "text-yellow" };
      case "hunt-summary":
        return { icon: <Skull size={16} className="text-text-dim" />, text: t("evt.huntSummary").replace("{slug}", String(d.slug ?? "")).replace("{kills}", num(d.kills)).replace("{captures}", num(d.captures)).replace("{balance}", num(d.balance)) };
      case "poke-sold":
        return { icon: <Coin size={16} />, text: t("evt.pokeSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-sold":
        return { icon: <Loot size={16} />, text: t("evt.itemSold").replace("{count}", num(d.count)).replace("{gold}", num(d.gold)) };
      case "item-bought":
        return { icon: <Loot size={16} />, text: e.title, tone: "text-text-dim" };
      case "brain":
        return { icon: <Brain size={16} className="text-cyan" />, text: e.title, tone: "text-cyan" };
      case "reconnect":
        return { icon: <Signal size={16} className="text-green" />, text: e.title, tone: "text-green" };
      case "heal":
        // passou na enfermeira Joy (pokemon desmaiado nao entra em campo)
        return { icon: <Heart size={16} className="text-red" />, text: e.body ? `${e.title} — ${e.body}` : e.title, tone: "text-red" };
      case "goal":
        return { icon: <Flag size={16} className="text-purple" />, text: e.title, tone: "text-purple" };
      case "error":
        // falha operacional (venda/compra que nao rodou) — o corpo diz o motivo
        return { icon: <Skull size={16} className="text-red" />, text: e.body ? `${e.title} — ${e.body}` : e.title, tone: "text-red" };
      default:
        return { icon: null, text: e.title };
    }
  };

  const shown = useMemo(
    () => (filter === "all" ? events : events.filter((e) => GROUP[e.kind] === filter)),
    [events, filter],
  );

  return (
    <Panel
      title={t("evt.title")}
      // botao sempre no slot: invisible reserva o espaco (cabecalho de altura estavel)
      right={<button type="button" onClick={clear} className={`btn btn-ghost btn-sm ${events.length > 0 ? "" : "invisible"}`}>{t("evt.clear")}</button>}
    >
      {/* filtro por assunto: achar "o que deu errado" sem rolar os resumos de hunt */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`chip ${filter === f ? "bg-cyan text-[#06131a]" : "bg-[var(--surface-2)] text-text-dim"}`}
          >
            {t(`evt.filter.${f}`)}
          </button>
        ))}
        <span className="ms-auto text-xs text-text-dim">{t("evt.count", { n: shown.length })}</span>
      </div>
      {/* feed vivo: ALTURA FIXA com rolagem propria — evento novo nao empurra a pagina.
          O estado vazio ocupa exatamente a mesma caixa. */}
      {shown.length === 0 ? (
        <div className="flex h-80 items-center justify-center"><EmptyState message={t("evt.empty")} /></div>
      ) : (
        <div className="flex h-[26rem] flex-col gap-1.5 overflow-y-auto pr-1">
          {shown.map((e, idx) => {
            const r = render(e);
            return (
              <FeedRow
                key={e.id}
                flash={idx === 0}
                leading={<span className="flex h-6 w-6 items-center justify-center">{r.icon}</span>}
                title={<span className={r.tone ?? "text-text"}>{r.text}</span>}
                right={<span className="tabular-nums text-xs text-text-dim">{when(e.createdAt)}</span>}
              />
            );
          })}
        </div>
      )}

      {/* o stream so traz os recentes; o historico inteiro (14 dias) vem sob demanda */}
      {more == null && (
        <button type="button" onClick={loadAll} disabled={loading} className="btn btn-ghost btn-sm w-full justify-center disabled:opacity-40">
          {loading ? `${t("evt.loading")}...` : t("evt.loadAll")}
        </button>
      )}
    </Panel>
  );
}
