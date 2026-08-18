"use client";

// Chat do jogo pela sessao que o robo segura (aba Chat). Feed AO VIVO via stream,
// envio de mensagem e ANUNCIO AUTOMATICO (divulgacao a cada N minutos, persistido).
// O formato dos frames de chat do jogo nao e documentado: se nada aparecer, o "modo
// descoberta" (acordeao no rodape) mostra os frames desconhecidos que chegaram — e
// como se calibra o parser. Envio: melhor palpite; a confirmacao e o ECO no feed.

import { useEffect, useMemo, useRef, useState } from "react";
import { useVipLive, type LiveChat } from "./vip-live";
import { Bubble, ChevronRight, Clock, Star } from "./icons";
import { Panel } from "./ui/panel";
import { EmptyState } from "./ui/feed";
import { MarketMonModal, type MarketDex } from "./market-advisor";
import type { MarketMon } from "@/lib/game-account";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

// pokemon linkado no chat: [poke!<base64>] carrega o bicho INTEIRO — nome, nivel, shiny,
// Q, IV, poder. O chip e clicavel e abre O MESMO modal do mercado (MarketMonModal),
// sem a parte de preco (o link nao traz preco).
interface PokeLink {
  n: string; lv?: number; sh?: number; q?: number; iv?: number; pw?: number;
  t1?: string; t2?: string;
  st?: { hp?: number; atk?: number; def?: number; spAtk?: number; spDef?: number; speed?: number };
}

// vira um MarketMon "sem anuncio" (price 0 esconde o bloco de preco no modal)
function toMarketMon(j: PokeLink, speciesId: number): MarketMon {
  return {
    listingId: "chat-link", speciesId, name: j.n, level: j.lv ?? 1, shiny: !!j.sh,
    ivTotal: j.iv ?? null, quality: j.q ?? null, power: j.pw ?? null,
    type1: j.t1 ?? null, type2: j.t2 ?? null,
    stats: null,
    price: 0, currency: "GOLD", belowNpc: false, sellers: 0, fairPrice: null,
  };
}

const decodePoke = (b64: string): PokeLink | null => {
  try {
    const j = JSON.parse(atob(b64)) as PokeLink;
    return j && typeof j.n === "string" && j.n ? j : null;
  } catch { return null; }
};

// texto do chat com os links viram chips clicaveis (abre o modal de detalhe)
function renderBody(text: string, onPoke: (p: PokeLink) => void): React.ReactNode {
  const re = /\[poke!([A-Za-z0-9+/=]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0, k = 0, mt: RegExpExecArray | null;
  while ((mt = re.exec(text))) {
    if (mt.index > last) parts.push(text.slice(last, mt.index));
    const j = decodePoke(mt[1]);
    parts.push(
      j ? (
        <button key={k++} type="button" onClick={() => onPoke(j)}
          className="mx-0.5 inline-flex items-center gap-1 rounded border border-[color:var(--cyan)]/40 bg-[color:var(--cyan)]/10 px-1.5 py-0.5 text-sm text-cyan transition hover:border-cyan hover:bg-[color:var(--cyan)]/20">
          {j.sh ? <Star size={8} className="text-yellow" /> : null}
          {j.n} <span className="text-text-dim">Lv{j.lv ?? "?"} · IV {j.iv ?? "?"} · Q{typeof j.q === "number" ? j.q.toFixed(2) : "?"}</span>
        </button>
      ) : (
        mt[0]
      ),
    );
    last = mt.index + mt[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

const COOLDOWN_S = 60; // limite anti-flood do chat do jogo (~1 msg/min)

const CHANNELS = ["world", "trade", "help"] as const;
type Channel = (typeof CHANNELS)[number];
const CH_COLOR: Record<Channel, string> = { world: "var(--cyan)", trade: "var(--green)", help: "var(--yellow)" };

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
// intervalo do anuncio (segundos) -> rotulo humano: "90s" -> "1min 30s", "600" -> "10min"
const fmtEvery = (s: number): string => {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}min ${r}s` : `${m}min`;
};

export function ChatPanel({ creatures, dex }: { creatures: { pokeId: number; name: string }[]; dex: Record<number, MarketDex> }) {
  const t = useT();
  const toast = useToast();
  const { chat, hunt, account, applyChat } = useVipLive();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<Channel>("world");
  const [busy, setBusy] = useState(false);
  const [pokeModal, setPokeModal] = useState<PokeLink | null>(null);
  // "quanto valeria": estimativa do motor de preco justo (/api/vip/value) pro bicho do
  // chip — o link do chat nao traz preco, entao o modal mostra o valor estimado.
  const [pokeValue, setPokeValue] = useState<number | null>(null);
  // cooldown anti-flood: contador a partir do ultimo envio (o servidor tambem barra)
  const [cooldownLeft, setCooldownLeft] = useState(0);
  // anuncio automatico (draft local; o efetivo vem do stream)
  const [annText, setAnnText] = useState("");
  const [annEvery, setAnnEvery] = useState("600"); // segundos
  const [annChannel, setAnnChannel] = useState<Channel>("world");
  const [annBusy, setAnnBusy] = useState(false);
  const seeded = useRef(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const connected = !!hunt?.wsOpen;
  const selfName = account?.account?.profile?.name ?? null;
  const ann = chat?.announce ?? null;
  // nome -> speciesId, pro sprite do modal do pokemon linkado
  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);

  // busca a estimativa de valor ao abrir o chip; o cleanup descarta resposta atrasada
  // de um chip anterior (trocou de modal antes do fetch voltar)
  useEffect(() => {
    setPokeValue(null);
    if (!pokeModal) return;
    const sid = pokeByName.get(pokeModal.n.toLowerCase());
    if (sid == null) return;
    let stale = false;
    const params = new URLSearchParams({ sp: String(sid) });
    if (typeof pokeModal.iv === "number") params.set("iv", String(pokeModal.iv));
    if (typeof pokeModal.q === "number") params.set("q", String(pokeModal.q));
    if (pokeModal.sh) params.set("shiny", "1");
    void fetch(`/api/vip/value?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { gold?: number | null } | null) => {
        if (!stale && d && typeof d.gold === "number" && d.gold > 0) setPokeValue(d.gold);
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [pokeModal, pokeByName]);

  // 1a carga do draft do anuncio a partir do persistido
  useEffect(() => {
    if (seeded.current || !chat) return;
    seeded.current = true;
    if (chat.announce) {
      setAnnText(chat.announce.text);
      setAnnEvery(String(chat.announce.everySec));
      setAnnChannel(chat.announce.channel);
    }
  }, [chat]);

  const msgs = useMemo(() => chat?.messages ?? [], [chat?.messages]);

  // autoscroll pro fim quando chega mensagem
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  // contador do cooldown a partir do lastSentAt do stream
  useEffect(() => {
    const tick = () => {
      const last = chat?.lastSentAt ?? 0;
      setCooldownLeft(Math.max(0, COOLDOWN_S - Math.floor((Date.now() - last) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [chat?.lastSentAt]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/vip/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as (LiveChat & { error?: string; waitMs?: number }) | null;
    if (r.ok && j && "messages" in j) applyChat(j);
    return { ok: r.ok, error: j?.error, waitMs: j?.waitMs };
  };

  const sendMsg = async () => {
    if (!text.trim() || busy || cooldownLeft > 0) return;
    setBusy(true);
    try {
      // o POST so volta com o VEREDITO do jogo: aceita (eco no feed) ou recusada
      const r = await post({ action: "send", text: text.trim(), channel });
      if (r.ok) { setText(""); toast.success(t("toast.chatSent")); }
      else if (r.error === "cooldown") toast.info(t("toast.chatCooldown", { s: Math.ceil((r.waitMs ?? 0) / 1000) }));
      else if (r.error === "rejected") toast.error(t("toast.chatRejected")); // texto fica pra corrigir
      else if (r.error === "no_echo") toast.error(t("toast.chatNoEcho"));
      else toast.error(t("vip.chat.sendErr"));
    } finally { setBusy(false); }
  };

  const saveAnnounce = async (on: boolean) => {
    setAnnBusy(true);
    try {
      const r = await post({ action: "announce", on, text: annText.trim(), everySec: Number(annEvery) || 600, channel: annChannel });
      if (r.ok) { if (on) toast.success(t("toast.annOn")); else toast.info(t("toast.annOff")); }
      else toast.error(t("toast.err"));
    } finally { setAnnBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan"><Bubble size={13} /> {t("vip.chat.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("vip.chat.desc")}</p>
      </div>

      {/* aviso de robo desligado: slot permanente (invisible quando conectado) — o
          estado da conexao muda ao vivo e nao pode empurrar o feed pra baixo */}
      <div className={`flex min-h-10 items-center gap-2.5 rounded border border-yellow/40 bg-[color:var(--yellow)]/5 px-3.5 py-2 ${connected ? "invisible" : ""}`}>
        <span className="text-base text-yellow">{t("vip.chat.needLive")}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* feed + envio */}
        <Panel icon={<Bubble size={12} />} accent="var(--cyan)" title={t("vip.chat.feed")} live={connected} className="lg:col-span-8">
          {/* altura fixa mas com teto responsivo: nunca passa de 60dvh no celular */}
          <div ref={feedRef} className="flex h-[min(26rem,60dvh)] flex-col gap-1 overflow-y-auto rounded border border-border bg-[var(--well-bg)] p-2.5">
            {msgs.length === 0 ? (
              <EmptyState className="m-auto" message={connected ? t("vip.chat.empty") : t("vip.chat.emptyOff")} />
            ) : (
              msgs.map((m, i) => {
                const self = m.mine || (selfName != null && m.from.toLowerCase() === selfName.toLowerCase());
                return (
                  <div key={`${m.at}-${i}`} className={`rounded px-2 py-1 text-base leading-relaxed ${self ? "bg-[color:var(--cyan)]/10" : ""} ${i === msgs.length - 1 ? "flash-in" : ""}`}
                    style={{ "--accent": "var(--cyan)" } as React.CSSProperties}>
                    <span className="mr-1.5 text-xs tabular-nums text-text-dim">{hhmm(m.at)}</span>
                    <span className="mr-1 rounded px-1 text-xs uppercase" style={{ color: CH_COLOR[(m.channel as Channel)] ?? "var(--text-dim)" }}>{m.channel}</span>
                    <span className={`mr-1 ${m.from === "?" ? "italic text-yellow" : m.admin ? "text-red" : self ? "text-cyan" : m.vip ? "text-yellow" : "text-text"}`}>
                      {m.from === "?" ? t("vip.chat.system") : m.from}
                    </span>
                    {m.level != null && <span className="mr-1.5 text-xs tabular-nums text-text-dim">Lv{m.level}</span>}
                    <span className="break-words text-text-dim">{renderBody(m.text, setPokeModal)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* envio: linhas de altura estavel — trilho de canais rolavel, depois input +
              botao. O botao tem largura minima fixa: o rotulo alterna (enviar / Ns / …)
              sem mexer o input do lado. */}
          <div className="mt-3 flex flex-nowrap gap-1 overflow-x-auto">
            {CHANNELS.map((c) => (
              <button key={c} type="button" onClick={() => setChannel(c)}
                className={`tab min-h-9 shrink-0 ${channel === c ? "tab-active" : ""}`}
                style={channel === c ? { color: CH_COLOR[c], borderColor: CH_COLOR[c] } : undefined}>
                {t(`vip.chat.ch.${c}`)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void sendMsg(); }}
              placeholder={connected ? t("vip.chat.ph") : t("vip.chat.phOff")}
              disabled={!connected}
              maxLength={300}
              className="input min-w-0 flex-1"
            />
            <button type="button" onClick={() => void sendMsg()} disabled={busy || !connected || !text.trim() || cooldownLeft > 0} className="btn btn-cyan min-w-[7rem] shrink-0 tabular-nums disabled:opacity-40">
              {busy ? "…" : cooldownLeft > 0 ? `${cooldownLeft}s` : t("vip.chat.send")} <ChevronRight size={9} />
            </button>
          </div>
          {/* dica do cooldown: linha sempre reservada (invisible fora do cooldown) */}
          <p className={`mt-1.5 flex h-5 items-center gap-1 text-sm text-text-dim ${cooldownLeft > 0 ? "" : "invisible"}`}>
            <Clock size={9} className="text-yellow" /> {t("vip.chat.cooldownHint", { s: cooldownLeft })}
          </p>
        </Panel>

        {/* anuncio automatico */}
        <Panel
          icon={<Clock size={12} />} accent={ann?.on ? "var(--green)" : undefined} title={t("vip.chat.annTitle")}
          right={ann?.on ? <span className="chip glow-pulse" style={{ background: "var(--green)", color: "#052012", "--accent": "var(--green)" } as React.CSSProperties}>{t("vip.chat.annOn")}</span> : undefined}
          className="lg:col-span-4" bodyClassName="gap-3"
        >
          <p className="text-sm leading-relaxed text-text-dim">{t("vip.chat.annDesc")}</p>

          <div className="field-label">{t("vip.chat.annText")}</div>
          <textarea
            value={annText}
            onChange={(e) => setAnnText(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={t("vip.chat.annPh")}
            className="input resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="field-label mb-1">{t("vip.chat.annEvery")}</div>
              <input value={annEvery} onChange={(e) => setAnnEvery(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input" placeholder="600" />
              <div className="mt-1 text-xs text-text-dim">{fmtEvery(Number(annEvery) || 0)} · {t("vip.chat.annFloor")}</div>
            </div>
            <div>
              <div className="field-label mb-1">{t("vip.chat.annChannel")}</div>
              <select value={annChannel} onChange={(e) => setAnnChannel(e.target.value as Channel)} className="input">
                {CHANNELS.map((c) => <option key={c} value={c}>{t(`vip.chat.ch.${c}`)}</option>)}
              </select>
            </div>
          </div>
          {ann?.on ? (
            <button type="button" onClick={() => void saveAnnounce(false)} disabled={annBusy} className="btn btn-ghost disabled:opacity-40">
              {t("vip.chat.annStop")}
            </button>
          ) : (
            <button type="button" onClick={() => void saveAnnounce(true)} disabled={annBusy || !annText.trim()} className="btn btn-green disabled:opacity-40">
              {t("vip.chat.annStart")} <ChevronRight size={9} />
            </button>
          )}
          {/* linha de status do anuncio: slot permanente — ligar/desligar nao muda a altura */}
          <p className={`text-sm ${ann?.on ? "text-text-dim" : "slot-empty"}`}>
            {ann?.on ? t("vip.chat.annRunning", { n: fmtEvery(ann.everySec), c: t(`vip.chat.ch.${ann.channel}`) }) : "—"}
          </p>
        </Panel>
      </div>

      {/* pokemon linkado (clique no chip) — O MESMO modal do mercado; sem preco no link,
          o fairPrice estimado (motor de preco justo) vira o "valeria ~X" */}
      {pokeModal && (() => {
        const sid = pokeByName.get(pokeModal.n.toLowerCase());
        if (sid == null) return null;
        return (
          <MarketMonModal
            mon={{ ...toMarketMon(pokeModal, sid), fairPrice: pokeValue }}
            dex={dex[sid]}
            onClose={() => setPokeModal(null)}
          />
        );
      })()}
    </div>
  );
}
