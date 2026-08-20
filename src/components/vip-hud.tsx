"use client";

// HUD fixo da area VIP: o monitor que fica em TODAS as telas. Duas linhas de ALTURA
// FIXA em que cada dado tem um slot permanente — valor ausente vira placeholder
// esmaecido no MESMO lugar (classe slot-empty). O HUD e sticky: se a altura mudasse
// quando um dado chega/some, a pagina inteira pulava. Nada aqui e renderizado
// condicionalmente fora do seu slot; o unico conteudo que se alterna e o slot de
// acao (contestada > vinculo expirado > conectar), um por vez.
// Tudo vem do VipLiveProvider (SSE) — zero fetch proprio, zero F5.

import { useEffect, useMemo, useState } from "react";
import { useVipLive, type LiveStatus } from "./vip-live";
import type { HuntOption } from "./hunt-analyzer";
import { Coin, Diamond, Xp, Skull, Signal, Brain, Flag, Target, Star } from "./icons";
import { Pokeball } from "./pokeball";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
// numeros grandes (ouro, xp/h) em notacao compacta: largura limitada, valor cheio no title
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtC = (n: number) => (Math.abs(n) >= 100_000 ? compact.format(Math.round(n)) : fmt(n));

const LED: Record<LiveStatus, string> = {
  idle: "var(--text-dim)",
  connecting: "var(--yellow)",
  running: "var(--green)",
  kicked: "var(--yellow)",
  error: "var(--red)",
  blocked: "var(--red)", // o jogo recusou a conta: nao ha reconexao em curso
};

// contagem regressiva ate a proxima tentativa de reconexao (atualiza a cada 1s)
function useCountdown(untilMs: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!untilMs) { setLeft(null); return; }
    const tick = () => setLeft(Math.max(0, Math.ceil((untilMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [untilMs]);
  return left;
}

export function VipHud({ hunts }: { hunts: HuntOption[] }) {
  const t = useT();
  const { link, hunt, account, applyHunt } = useVipLive();
  const [busy, setBusy] = useState(false);

  const status: LiveStatus = hunt?.status ?? "idle";
  const connected = !!hunt?.wsOpen;
  const holdOpen = !!hunt?.holdOpen;
  const hunting = connected && !!hunt?.slug;
  const troubled = holdOpen && !connected;
  const retryIn = useCountdown(hunt?.reconnecting ? hunt.nextRetryAt : null);

  const huntOpt = useMemo(
    () => (hunt?.slug ? (hunts.find((h) => h.slug === hunt.slug) ?? null) : null),
    [hunts, hunt?.slug],
  );
  // pokemon ATIVO (lider): time ao vivo da sessao segurada; fallback snapshot do banco
  const leader = useMemo(() => {
    const team = (connected && hunt?.team?.length ? hunt.team : null) ?? account?.team?.list ?? [];
    return team.find((p) => p.leader) ?? null;
  }, [connected, hunt?.team, account?.team]);

  const prof = account?.account?.profile ?? null;
  const balls = account?.account?.balls ?? [];
  const ballTotal = balls.reduce((s, b) => s + b.count, 0);
  const ballLow = balls.length > 0 && ballTotal < 100;
  const xpPct = prof && prof.xpForNext > 0 ? Math.min(100, (prof.xpInLevel / prof.xpForNext) * 100) : 0;

  const lv = hunt?.leveling ?? null;
  const lvOn = !!lv && !lv.done;
  const lvPct = lv
    ? Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100))
    : 0;

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect" }) });
      const j = await r.json().catch(() => null);
      if (j && "status" in j) applyHunt(j);
    } finally { setBusy(false); }
  };

  const contested = !!hunt?.contested;
  const expired = account?.reason === "expired";

  // rotulo do monitor: contestada > religando > cacando > conectado > status cru
  const statusLabel = contested
    ? t("vip.contested.status")
    : troubled
    ? (retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t(`robo.hunt.status.${status}`))
    : hunting ? t("vip.conn.hunting")
    : connected ? t("vip.conn.connected")
    : status === "connecting" ? t("robo.hunt.status.connecting")
    : t("vip.conn.off");

  const rates = hunting && hunt?.analyzer ? hunt.analyzer : null;

  return (
    <div className="hud overflow-hidden">
      {/* ---- linha 1 (h fixa; rola na horizontal se apertar): monitor do robo + slot de acao | recursos da conta ---- */}
      <div className="flex h-11 min-w-0 items-center gap-3 overflow-x-auto border-b border-border/60 px-3 [scrollbar-width:none] sm:gap-4 sm:px-4 [&::-webkit-scrollbar]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className={`hud-led shrink-0 ${connected || status === "connecting" || hunt?.reconnecting ? "pulse-soft" : ""}`}
            style={{ "--led": troubled ? "var(--red)" : LED[status] } as React.CSSProperties}
          />
          {/* frase de status: peso real da Chakra, sem caixa alta nem tracking de muleta */}
          <span className={`pixel truncate text-sm ${troubled ? "text-red" : "text-text"}`}>{statusLabel}</span>
          {/* stream SSE caiu = aviso discreto; invisible reserva o espaco quando esta ok */}
          <span
            className={`inline-flex w-4 shrink-0 items-center text-yellow ${link !== "open" ? "" : "invisible"}`}
            title={t("vip.hud.streamDown")}
          >
            <Signal size={14} className="pulse-soft" />
          </span>
        </span>

        {/* slot de ACAO: um estado por vez, sempre no mesmo lugar. h-8 = mesma altura
            fechada do btn-sm (--control-h-sm), pra os tres estados nao mudarem a linha. */}
        <span className="inline-flex h-8 shrink-0 items-center">
          {contested ? (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="flash-in inline-flex h-8 items-center gap-1.5 rounded border border-[color:var(--yellow)]/60 bg-[color:var(--yellow)]/10 px-2 text-xs text-yellow disabled:opacity-40"
              style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
              title={t("vip.contested.note")}
            >
              <span className="hud-led pulse-soft" style={{ "--led": "var(--yellow)" } as React.CSSProperties} />
              {t("vip.contested.hud")} · {t("vip.contested.resume")}
            </button>
          ) : expired ? (
            <a
              href="#conta"
              className="flash-in inline-flex h-8 items-center gap-1.5 rounded border border-red/60 bg-[color:var(--red)]/10 px-2 text-xs text-red"
              style={{ "--accent": "var(--red)" } as React.CSSProperties}
            >
              <span className="hud-led pulse-soft" style={{ "--led": "var(--red)" } as React.CSSProperties} />
              {t("vip.conn.expired")}
            </a>
          ) : !holdOpen && status !== "connecting" ? (
            <button type="button" onClick={() => void connect()} disabled={busy} className="btn btn-green btn-sm disabled:opacity-40">
              {t("vip.conn.connect")}
            </button>
          ) : null}
        </span>

        <span className="ms-auto" />

        {/* recursos da conta — slots permanentes; sem dado = placeholder esmaecido.
            Larguras calibradas pra Chakra Petch (bem mais larga que a fonte antiga) em
            base 16px: cabe o pior caso compacto ("123,4 mi") com folga. */}
        <span
          className="hidden shrink-0 items-center gap-2 sm:inline-flex"
          title={prof ? `XP ${fmt(prof.xpInLevel)} / ${fmt(prof.xpForNext)}` : undefined}
        >
          <span className={`pixel min-w-[2.75rem] text-sm ${prof ? "text-yellow" : "slot-empty"}`}>{prof ? `Lv${prof.level}` : "Lv —"}</span>
          <span className="hud-track w-16 shrink-0 sm:w-24">
            <span className="hud-fill block bg-cyan" style={{ width: `${prof ? xpPct : 0}%` }} />
          </span>
        </span>
        <span className={`inline-flex min-w-[5.25rem] shrink-0 items-center justify-end gap-1 text-sm font-bold tabular-nums ${prof ? "text-green" : "slot-empty"}`} title={prof ? fmt(prof.gold) : undefined}>
          <Coin size={14} />{prof ? fmtC(prof.gold) : "—"}
        </span>
        <span className={`inline-flex min-w-[4.25rem] shrink-0 items-center justify-end gap-1 text-sm font-bold tabular-nums ${prof ? "text-cyan" : "slot-empty"}`} title={prof ? fmt(prof.diamonds) : undefined}>
          <Diamond size={14} />{prof ? fmtC(prof.diamonds) : "—"}
        </span>
        <span
          className={`inline-flex min-w-[4rem] shrink-0 items-center justify-end gap-1 text-sm font-bold tabular-nums ${!prof ? "slot-empty" : ballLow ? "text-red" : "text-text"}`}
          title={balls.length ? balls.map((b) => `${b.name}: ${b.count}`).join(" · ") : undefined}
        >
          <Pokeball size={14} className={ballLow ? "pulse-soft" : ""} />{prof ? fmt(ballTotal) : "—"}
        </span>
      </div>

      {/* ---- linha 2 (h fixa; rola na horizontal se apertar): lider | modo | hunt | rendimento | plano ---- */}
      <div className="flex h-11 items-center gap-3 overflow-x-auto px-3 [scrollbar-width:none] sm:gap-4 sm:px-4 [&::-webkit-scrollbar]:hidden">
        {/* lider (pokemon ativo) */}
        <span
          className="inline-flex shrink-0 items-center gap-1.5"
          title={leader ? `IV ${leader.ivTotal} · Q ${leader.quality}` : undefined}
        >
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
            {leader ? (
              <>
                <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={22} />
                {/* estrela = shiny. O ativo ja se identifica pelo nome em amarelo. */}
                {leader.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={14} /></span>}
              </>
            ) : (
              <span className="slot-empty"><Pokeball size={16} /></span>
            )}
          </span>
          {/* nome do pokemon: nome proprio, sem caixa alta. Slot mais largo porque a
              Chakra come mais horizontal que a condensada antiga. */}
          <span className={`w-24 truncate text-sm sm:w-32 ${leader ? "text-yellow" : "slot-empty"}`}>{leader ? leader.name : "—"}</span>
          <span className={`pixel shrink-0 text-xs ${leader ? "text-text-dim" : "slot-empty"}`}>
            {leader ? `Lv${hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}` : "Lv —"}
          </span>
        </span>

        {/* modo do cerebro — slot fechado que cabe o rotulo mais largo ("Plano" + icone) */}
        <span className="inline-flex w-24 shrink-0 justify-center">
          {hunt && hunting ? (
            <span
              className="chip"
              style={{
                background: hunt.mode === "manual" ? "var(--surface-2)" : hunt.mode === "auto" ? "var(--cyan)" : "var(--purple)",
                color: hunt.mode === "manual" ? "var(--text-dim)" : hunt.mode === "auto" ? "#06131a" : "#140a26",
              }}
            >
              {hunt.mode === "auto" && <Brain size={14} />}
              {hunt.mode === "leveling" && <Flag size={14} />}
              {t(`vip.hud.mode.${hunt.mode}`)}
            </span>
          ) : (
            <span className="chip slot-empty bg-surface-2">—</span>
          )}
        </span>

        {/* hunt atual */}
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <Target size={14} className={`shrink-0 ${huntOpt ? "text-cyan" : "slot-empty"}`} />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {huntOpt?.pokeId != null && <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={18} />}
          </span>
          <span className={`w-28 truncate text-sm sm:w-36 ${huntOpt ? "text-text" : "slot-empty"}`}>{huntOpt ? huntOpt.name : "—"}</span>
        </span>

        {/* rendimento ao vivo (md+) */}
        <span className="hidden items-center gap-3 text-sm tabular-nums md:inline-flex">
          <span className={`inline-flex min-w-[5.25rem] items-center gap-1 ${rates ? "text-cyan" : "slot-empty"}`} title={rates ? `${fmt(rates.xpPerHour)} XP/h` : undefined}>
            <Xp size={14} />{rates ? `${fmtC(rates.xpPerHour)}/h` : "—/h"}
          </span>
          <span className={`inline-flex min-w-[4.25rem] items-center gap-1 ${rates ? "text-text-dim" : "slot-empty"}`}>
            <Skull size={14} />{rates ? fmt(rates.kills) : "—"}
          </span>
          <span className={`inline-flex min-w-[5.25rem] items-center gap-1 ${rates ? "text-green" : "slot-empty"}`} title={rates ? `${fmt(rates.goldPerHour)} ouro/h` : undefined}>
            <Coin size={14} />{rates ? `${fmtC(rates.goldPerHour)}/h` : "—/h"}
          </span>
        </span>

        <span className="ms-auto" />

        {/* progresso do plano de leveling */}
        <span
          className="inline-flex shrink-0 items-center gap-2"
          title={lvOn && lv ? `${lv.name}: ${lv.currentLevel} / ${lv.targetLevel}` : undefined}
        >
          <Flag size={14} className={`shrink-0 ${lvOn ? "text-purple" : "slot-empty"}`} />
          {/* "123/456" e "—/—" ocupam o mesmo slot: a barra ao lado nao desliza */}
          <span className={`pixel min-w-[3.75rem] text-center text-xs tabular-nums ${lvOn ? "text-purple" : "slot-empty"}`}>
            {lvOn && lv ? <>{lv.currentLevel}<span className="text-text-dim">/{lv.targetLevel}</span></> : "—/—"}
          </span>
          <span className="hud-track w-20 shrink-0 sm:w-28">
            <span className="hud-fill block bg-purple" style={{ width: `${lvOn ? lvPct : 0}%` }} />
          </span>
        </span>
      </div>
    </div>
  );
}
