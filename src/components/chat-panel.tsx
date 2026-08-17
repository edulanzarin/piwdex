"use client";

// Chat do jogo pela sessao que o robo segura (aba Chat). Feed AO VIVO via stream,
// envio de mensagem e ANUNCIO AUTOMATICO (divulgacao a cada N minutos, persistido).
// O formato dos frames de chat do jogo nao e documentado: se nada aparecer, o "modo
// descoberta" (acordeao no rodape) mostra os frames desconhecidos que chegaram — e
// como se calibra o parser. Envio: melhor palpite; a confirmacao e o ECO no feed.

import { useEffect, useMemo, useRef, useState } from "react";
import { useVipLive, type LiveChat } from "./vip-live";
import { Bubble, Check, ChevronRight, Clock, Signal, Star } from "./icons";
import { useT } from "./locale-provider";

// links de pokemon no chat: [poke!<base64 de {n,lv,sh,q,iv,pw,...}>] viram um chip
// legivel (nome + nivel + IV + Q) em vez do blob
function renderBody(text: string): React.ReactNode {
  const re = /\[poke!([A-Za-z0-9+/=]+)\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0, k = 0, mt: RegExpExecArray | null;
  while ((mt = re.exec(text))) {
    if (mt.index > last) parts.push(text.slice(last, mt.index));
    let chip: React.ReactNode = mt[0];
    try {
      const j = JSON.parse(atob(mt[1])) as { n?: string; lv?: number; iv?: number; q?: number; sh?: number };
      if (j.n) {
        chip = (
          <span key={k++} className="mx-0.5 inline-flex items-center gap-1 rounded border border-[color:var(--cyan)]/40 bg-[color:var(--cyan)]/10 px-1.5 py-0.5 text-[0.6rem] text-cyan">
            {j.sh ? <Star size={8} className="text-yellow" /> : null}
            {j.n} <span className="text-text-dim">Lv{j.lv ?? "?"} · IV {j.iv ?? "?"} · Q{typeof j.q === "number" ? j.q.toFixed(2) : "?"}</span>
          </span>
        );
      }
    } catch { /* base64 invalido: mostra cru */ }
    parts.push(chip);
    last = mt.index + mt[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

const CHANNELS = ["world", "trade", "help"] as const;
type Channel = (typeof CHANNELS)[number];
const CH_COLOR: Record<Channel, string> = { world: "var(--cyan)", trade: "var(--green)", help: "var(--yellow)" };

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatPanel() {
  const t = useT();
  const { chat, hunt, account, applyChat } = useVipLive();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<Channel>("world");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  // anuncio automatico (draft local; o efetivo vem do stream)
  const [annText, setAnnText] = useState("");
  const [annEvery, setAnnEvery] = useState("10");
  const [annChannel, setAnnChannel] = useState<Channel>("world");
  const [annBusy, setAnnBusy] = useState(false);
  const seeded = useRef(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const connected = !!hunt?.wsOpen;
  const selfName = account?.account?.profile?.name ?? null;
  const ann = chat?.announce ?? null;

  // 1a carga do draft do anuncio a partir do persistido
  useEffect(() => {
    if (seeded.current || !chat) return;
    seeded.current = true;
    if (chat.announce) {
      setAnnText(chat.announce.text);
      setAnnEvery(String(chat.announce.everyMin));
      setAnnChannel(chat.announce.channel);
    }
  }, [chat]);

  const msgs = useMemo(() => chat?.messages ?? [], [chat?.messages]);

  // autoscroll pro fim quando chega mensagem
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/vip/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as LiveChat | null;
    if (r.ok && j && "messages" in j) applyChat(j);
    return r.ok;
  };

  const sendMsg = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setSendErr(false);
    try {
      const ok = await post({ action: "send", text: text.trim(), channel });
      if (ok) setText(""); else setSendErr(true);
    } finally { setBusy(false); }
  };

  const saveAnnounce = async (on: boolean) => {
    setAnnBusy(true);
    try {
      await post({ action: "announce", on, text: annText.trim(), everyMin: Number(annEvery) || 10, channel: annChannel });
    } finally { setAnnBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan"><Bubble size={13} /> {t("vip.chat.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("vip.chat.desc")}</p>
      </div>

      {!connected && (
        <div className="flex items-center gap-2.5 rounded border border-yellow/40 bg-[color:var(--yellow)]/5 px-3.5 py-2">
          <Signal size={11} className="text-yellow" />
          <span className="text-[0.66rem] text-yellow">{t("vip.chat.needLive")}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* feed + envio */}
        <div className="card flex flex-col p-4 lg:col-span-8">
          <div className="mb-2.5 flex items-center gap-2">
            <h3 className="section-title flex-1">{t("vip.chat.feed")}</h3>
            {connected && (
              <span className="inline-flex items-center gap-1.5 text-[0.55rem] uppercase text-green">
                <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />
                {t("vip.ov.live")}
              </span>
            )}
          </div>

          <div ref={feedRef} className="flex h-[26rem] flex-col gap-1 overflow-y-auto rounded border border-border bg-[var(--well-bg)] p-2.5">
            {msgs.length === 0 ? (
              <p className="m-auto text-center text-[0.66rem] text-text-dim">
                {connected ? t("vip.chat.empty") : t("vip.chat.emptyOff")}
              </p>
            ) : (
              msgs.map((m, i) => {
                const self = selfName != null && m.from.toLowerCase() === selfName.toLowerCase();
                return (
                  <div key={`${m.at}-${i}`} className={`rounded px-2 py-1 text-[0.7rem] leading-relaxed ${self ? "bg-[color:var(--cyan)]/10" : ""} ${i === msgs.length - 1 ? "flash-in" : ""}`}
                    style={{ "--accent": "var(--cyan)" } as React.CSSProperties}>
                    <span className="mr-1.5 text-[0.55rem] tabular-nums text-text-dim">{hhmm(m.at)}</span>
                    <span className="mr-1 rounded px-1 text-[0.5rem] uppercase" style={{ color: CH_COLOR[(m.channel as Channel)] ?? "var(--text-dim)" }}>{m.channel}</span>
                    <span className={`mr-1 font-semibold ${m.admin ? "text-red" : self ? "text-cyan" : m.vip ? "text-yellow" : "text-text"}`}>{m.from}</span>
                    {m.level != null && <span className="mr-1.5 text-[0.52rem] tabular-nums text-text-dim">Lv{m.level}</span>}
                    <span className="break-words text-text-dim">{renderBody(m.text)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* envio */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {CHANNELS.map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  className={`tab ${channel === c ? "tab-active" : ""}`}
                  style={channel === c ? { color: CH_COLOR[c], borderColor: CH_COLOR[c] } : undefined}>
                  {t(`vip.chat.ch.${c}`)}
                </button>
              ))}
            </div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void sendMsg(); }}
              placeholder={connected ? t("vip.chat.ph") : t("vip.chat.phOff")}
              disabled={!connected}
              maxLength={300}
              className="input min-w-40 flex-1"
            />
            <button type="button" onClick={() => void sendMsg()} disabled={busy || !connected || !text.trim()} className="btn btn-cyan disabled:opacity-40">
              {busy ? "…" : t("vip.chat.send")} <ChevronRight size={9} />
            </button>
          </div>
          {sendErr && <p className="mt-1.5 text-[0.6rem] text-red">{t("vip.chat.sendErr")}</p>}
          {chat?.lastSentAt != null && !sendErr && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[0.58rem] text-text-dim">
              <Check size={9} className="text-green" /> {t("vip.chat.sentAt", { h: hhmm(chat.lastSentAt) })}
            </p>
          )}
        </div>

        {/* anuncio automatico */}
        <div className="card flex flex-col gap-3 p-4 lg:col-span-4">
          <div className="flex items-center gap-2">
            <Clock size={12} className={ann?.on ? "text-green" : "text-text-dim"} />
            <h3 className="section-title flex-1">{t("vip.chat.annTitle")}</h3>
            {ann?.on && <span className="chip glow-pulse" style={{ background: "var(--green)", color: "#052012", "--accent": "var(--green)" } as React.CSSProperties}>{t("vip.chat.annOn")}</span>}
          </div>
          <p className="text-[0.62rem] leading-relaxed text-text-dim">{t("vip.chat.annDesc")}</p>

          <div className="field-label">{t("vip.chat.annText")}</div>
          <textarea
            value={annText}
            onChange={(e) => setAnnText(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={t("vip.chat.annPh")}
            className="input resize-none !h-auto"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="field-label mb-1">{t("vip.chat.annEvery")}</div>
              <input value={annEvery} onChange={(e) => setAnnEvery(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="input" />
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
          {ann?.on && (
            <p className="text-[0.58rem] text-text-dim">{t("vip.chat.annRunning", { n: ann.everyMin, c: t(`vip.chat.ch.${ann.channel}`) })}</p>
          )}
        </div>
      </div>

      {/* modo descoberta: frames desconhecidos (calibragem do parser de chat) */}
      {(chat?.debugFrames?.length ?? 0) > 0 && (
        <div className="card p-4">
          <button type="button" onClick={() => setDebugOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
            <ChevronRight size={10} className={`transition-transform ${debugOpen ? "rotate-90" : ""}`} />
            <span className="section-title flex-1 text-text-dim">{t("vip.chat.debug", { n: chat!.debugFrames.length })}</span>
          </button>
          {debugOpen && (
            <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {chat!.debugFrames.slice().reverse().map((f, i) => (
                <div key={i} className="rounded border border-border bg-[var(--well-bg)] p-2 font-mono text-[0.58rem] text-text-dim">
                  <span className="mr-2 text-cyan">{f.type}</span>
                  <span className="mr-2 text-[0.5rem]">{hhmm(f.at)}</span>
                  <span className="break-all">{f.raw}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
