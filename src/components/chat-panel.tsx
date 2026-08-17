"use client";

// Chat do jogo pela sessao que o robo segura (aba Chat). Feed AO VIVO via stream,
// envio de mensagem e ANUNCIO AUTOMATICO (divulgacao a cada N minutos, persistido).
// O formato dos frames de chat do jogo nao e documentado: se nada aparecer, o "modo
// descoberta" (acordeao no rodape) mostra os frames desconhecidos que chegaram — e
// como se calibra o parser. Envio: melhor palpite; a confirmacao e o ECO no feed.

import { useEffect, useMemo, useRef, useState } from "react";
import { useVipLive, type LiveChat } from "./vip-live";
import { Bubble, Check, ChevronRight, Clock, Signal, Star, Xp } from "./icons";
import { Modal } from "./modal";
import { CloseButton } from "./icon-button";
import { Sprite } from "./sprite";
import { StatTile } from "./stat-tile";
import { TypeBadges } from "./badges";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { useT } from "./locale-provider";

// pokemon linkado no chat: [poke!<base64>] carrega o bicho INTEIRO — nome, nivel, shiny,
// Q, IV, poder e os STATS REAIS naquele nivel. O chip e clicavel e abre um modal no
// mesmo dialeto do mercado (igual o hover do jogo, so que melhor: com os stats).
interface PokeLink {
  n: string; lv?: number; sh?: number; q?: number; iv?: number; pw?: number;
  t1?: string; t2?: string;
  st?: { hp?: number; atk?: number; def?: number; spAtk?: number; spDef?: number; speed?: number };
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
          className="mx-0.5 inline-flex items-center gap-1 rounded border border-[color:var(--cyan)]/40 bg-[color:var(--cyan)]/10 px-1.5 py-0.5 text-[0.6rem] text-cyan transition hover:border-cyan hover:bg-[color:var(--cyan)]/20">
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

const fmtN = (n: number) => Math.round(n).toLocaleString("pt-BR");
const ivColor = (v?: number) => (v == null ? "text-text-dim" : v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

// modal do pokemon linkado — mesmo dialeto do modal do mercado (sprite + tiles + stats)
function PokeLinkModal({ poke, speciesId, onClose }: { poke: PokeLink; speciesId: number | null; onClose: () => void }) {
  const t = useT();
  const st = poke.st ?? {};
  const STATS: [string, number | undefined][] = [
    ["HP", st.hp], ["ATK", st.atk], ["DEF", st.def],
    ["SP.ATK", st.spAtk], ["SP.DEF", st.spDef], ["SPEED", st.speed],
  ];
  const max = Math.max(1, ...STATS.map(([, v]) => v ?? 0));
  return (
    <Modal onClose={onClose} className="w-full max-w-md gap-5 p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
          {speciesId != null && <Sprite src={spriteUrl(speciesId, !!poke.sh)} alt={poke.n} size={72} />}
          {!!poke.sh && <span className="absolute right-1 top-1 text-yellow"><Star size={13} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate pixel text-[0.9rem] text-text">{poke.n}</h3>
            <span className="text-[0.62rem] text-text-dim">Lv.{poke.lv ?? "?"}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {poke.t1 && <TypeBadges t1={poke.t1 as PokeType} t2={(poke.t2 as PokeType) ?? null} />}
            {!!poke.sh && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>}
          </div>
        </div>
        <CloseButton onClick={onClose} className="shrink-0 self-start" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t("account.col.power")} value={<span className="text-yellow">{poke.pw != null ? fmtN(poke.pw) : "—"}</span>} icon={<Xp size={10} className="text-yellow" />} />
        <StatTile label={t("account.col.iv")} value={poke.iv != null ? <span className={ivColor(poke.iv)}>{poke.iv}<span className="text-[0.62rem] text-text-dim">/192</span></span> : "—"} />
        <StatTile label={t("account.col.quality")} value={<span className="text-cyan">{poke.q != null ? poke.q.toFixed(3) : "—"}</span>} />
      </div>

      {/* stats REAIS no nivel do anuncio (vem no proprio link) */}
      <div className="flex flex-col gap-1.5 rounded border border-border bg-[var(--well-bg)] p-3">
        <div className="field-label mb-1">{t("vip.chat.statsAt", { lv: poke.lv ?? "?" })}</div>
        {STATS.map(([label, v]) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className="w-14 shrink-0 text-[0.58rem] uppercase text-text-dim">{label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-[rgba(8,14,28,0.8)]">
              <div className="h-full rounded-sm bg-cyan" style={{ width: `${((v ?? 0) / max) * 100}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right text-[0.66rem] tabular-nums text-text">{v != null ? fmtN(v) : "—"}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

const CHANNELS = ["world", "trade", "help"] as const;
type Channel = (typeof CHANNELS)[number];
const CH_COLOR: Record<Channel, string> = { world: "var(--cyan)", trade: "var(--green)", help: "var(--yellow)" };

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatPanel({ creatures }: { creatures: { pokeId: number; name: string }[] }) {
  const t = useT();
  const { chat, hunt, account, applyChat } = useVipLive();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<Channel>("world");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState(false);
  const [pokeModal, setPokeModal] = useState<PokeLink | null>(null);
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
  // nome -> speciesId, pro sprite do modal do pokemon linkado
  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);

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
                const self = m.mine || (selfName != null && m.from.toLowerCase() === selfName.toLowerCase());
                return (
                  <div key={`${m.at}-${i}`} className={`rounded px-2 py-1 text-[0.7rem] leading-relaxed ${self ? "bg-[color:var(--cyan)]/10" : ""} ${i === msgs.length - 1 ? "flash-in" : ""}`}
                    style={{ "--accent": "var(--cyan)" } as React.CSSProperties}>
                    <span className="mr-1.5 text-[0.55rem] tabular-nums text-text-dim">{hhmm(m.at)}</span>
                    <span className="mr-1 rounded px-1 text-[0.5rem] uppercase" style={{ color: CH_COLOR[(m.channel as Channel)] ?? "var(--text-dim)" }}>{m.channel}</span>
                    <span className={`mr-1 font-semibold ${m.admin ? "text-red" : self ? "text-cyan" : m.vip ? "text-yellow" : "text-text"}`}>{m.from}</span>
                    {m.level != null && <span className="mr-1.5 text-[0.52rem] tabular-nums text-text-dim">Lv{m.level}</span>}
                    <span className="break-words text-text-dim">{renderBody(m.text, setPokeModal)}</span>
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

      {/* modal do pokemon linkado (clique no chip) — mesmo dialeto do modal do mercado */}
      {pokeModal && (
        <PokeLinkModal
          poke={pokeModal}
          speciesId={pokeByName.get(pokeModal.n.toLowerCase()) ?? null}
          onClose={() => setPokeModal(null)}
        />
      )}
    </div>
  );
}
