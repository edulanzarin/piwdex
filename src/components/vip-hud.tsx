"use client";

// HUD fixo da area VIP: o monitor que fica em TODAS as telas. LED de conexao do robo,
// modo (manual/auto/plano), hunt atual com sprite, XP/h e kills ao vivo, recursos da conta
// (nivel + barra de XP, dolares, diamantes, pokebolas) e o progresso do plano de leveling.
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

const LED: Record<LiveStatus, string> = {
  idle: "var(--text-dim)",
  connecting: "var(--yellow)",
  running: "var(--green)",
  kicked: "var(--yellow)",
  error: "var(--red)",
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

function HudDivider() {
  return <span className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />;
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

  // rotulo do monitor: contestada > religando > cacando > conectado > status cru
  const statusLabel = contested
    ? t("vip.contested.status")
    : troubled
    ? (retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t(`robo.hunt.status.${status}`))
    : hunting ? t("vip.conn.hunting")
    : connected ? t("vip.conn.connected")
    : status === "connecting" ? t("robo.hunt.status.connecting")
    : t("vip.conn.off");

  return (
    <div className="hud flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      {/* monitor do robo: LED + status + reconexao + conectar rapido */}
      <span className="inline-flex min-w-0 items-center gap-2">
        <span
          className={`hud-led shrink-0 ${connected || status === "connecting" || hunt?.reconnecting ? "pulse-soft" : ""}`}
          style={{ "--led": troubled ? "var(--red)" : LED[status] } as React.CSSProperties}
        />
        <span className={`pixel text-sm uppercase tracking-wide ${troubled ? "text-red" : "text-text"}`}>{statusLabel}</span>
        {/* stream SSE caiu = aviso discreto (nao confundir com a conexao do robo) */}
        {link !== "open" && (
          <span className="inline-flex items-center gap-1 text-xs text-yellow" title={t("vip.hud.streamDown")}>
            <Signal size={10} className="pulse-soft" />
          </span>
        )}
      </span>

      {/* sessao contestada: a conta foi tomada (usuario entrou no jogo). O robo cedeu e
          pausou; um clique religa. Some quando religa. */}
      {contested && (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="flash-in inline-flex items-center gap-1.5 rounded border border-[color:var(--yellow)]/60 bg-[color:var(--yellow)]/10 px-2 py-1 text-sm text-yellow disabled:opacity-40"
          style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
          title={t("vip.contested.note")}
        >
          <span className="hud-led pulse-soft" style={{ "--led": "var(--yellow)" } as React.CSSProperties} />
          {t("vip.contested.hud")} · {t("vip.contested.resume")}
        </button>
      )}

      {/* vinculo com o jogo expirou: APITA e leva pro reconectar (uma vez so) */}
      {account?.reason === "expired" && (
        <a href="#conta" className="flash-in inline-flex items-center gap-1.5 rounded border border-red/60 bg-[color:var(--red)]/10 px-2 py-1 text-sm text-red"
          style={{ "--accent": "var(--red)" } as React.CSSProperties}>
          <span className="hud-led pulse-soft" style={{ "--led": "var(--red)" } as React.CSSProperties} />
          {t("vip.conn.expired")}
        </a>
      )}

      {/* conectar rapido direto do HUD */}
      {!holdOpen && status !== "connecting" && account?.reason !== "expired" && (
        <button type="button" onClick={() => void connect()} disabled={busy} className="btn btn-green !min-h-0 !px-2.5 !py-1 !text-xs disabled:opacity-40">
          {t("vip.conn.connect")}
        </button>
      )}

      {/* pokemon ATIVO (lider) ao vivo */}
      {leader && (
        <span className="inline-flex min-w-0 items-center gap-1.5" title={`IV ${leader.ivTotal} · Q ${leader.quality}`}>
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
            <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={22} />
            <span className="absolute -right-1 -top-1 text-yellow"><Star size={7} /></span>
          </span>
          <span className="truncate text-base text-yellow">{leader.name}</span>
          <span className="pixel text-xs text-text-dim">Lv{hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}</span>
        </span>
      )}

      {/* modo do cerebro (so enquanto caca) */}
      {hunt && hunting && (
        <span
          className="chip shrink-0"
          style={{
            background: hunt.mode === "manual" ? "var(--surface-2)" : hunt.mode === "auto" ? "var(--cyan)" : "var(--purple)",
            color: hunt.mode === "manual" ? "var(--text-dim)" : hunt.mode === "auto" ? "#06131a" : "#140a26",
          }}
        >
          {hunt.mode === "auto" && <Brain size={9} />}
          {hunt.mode === "leveling" && <Flag size={9} />}
          {t(`vip.hud.mode.${hunt.mode}`)}
        </span>
      )}

      {/* hunt atual + rendimento ao vivo */}
      {huntOpt && (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Target size={10} className="shrink-0 text-cyan" />
          {huntOpt.pokeId != null && <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={18} />}
          <span className="truncate text-base text-text">{huntOpt.name}</span>
        </span>
      )}
      {hunting && hunt?.analyzer && (
        <span className="hidden items-center gap-3 text-sm tabular-nums md:inline-flex">
          <span className="inline-flex items-center gap-1 text-cyan"><Xp size={10} />{fmt(hunt.analyzer.xpPerHour)}/h</span>
          <span className="inline-flex items-center gap-1 text-text-dim"><Skull size={10} />{fmt(hunt.analyzer.kills)}</span>
          <span className="inline-flex items-center gap-1 text-green"><Coin size={10} />{fmt(hunt.analyzer.goldPerHour)}/h</span>
        </span>
      )}

      {/* progresso do plano de leveling (sempre visivel enquanto ha plano) */}
      {lv && !lv.done && (
        <span className="inline-flex min-w-0 items-center gap-2" title={`${lv.name}: ${lv.currentLevel} / ${lv.targetLevel}`}>
          <Flag size={10} className="shrink-0 text-purple" />
          <span className="pixel text-xs text-purple">{lv.currentLevel}<span className="text-text-dim">/{lv.targetLevel}</span></span>
          <span className="hud-track w-16 shrink-0 sm:w-24">
            <span className="hud-fill block bg-purple" style={{ width: `${lvPct}%` }} />
          </span>
        </span>
      )}

      <span className="ms-auto" />

      {/* recursos da conta — ao vivo via stream */}
      {prof && (
        <>
          <span className="inline-flex items-center gap-2" title={`XP ${fmt(prof.xpInLevel)} / ${fmt(prof.xpForNext)}`}>
            <span className="pixel text-sm text-yellow">Lv{prof.level}</span>
            <span className="hud-track w-14 shrink-0 sm:w-20">
              <span className="hud-fill block bg-cyan" style={{ width: `${xpPct}%` }} />
            </span>
          </span>
          <HudDivider />
          <span className="inline-flex items-center gap-1 text-base tabular-nums text-green"><Coin size={11} />{fmt(prof.gold)}</span>
          <span className="inline-flex items-center gap-1 text-base tabular-nums text-cyan"><Diamond size={11} />{fmt(prof.diamonds)}</span>
          <span
            className={`inline-flex items-center gap-1 text-base tabular-nums ${ballLow ? "text-red" : "text-text"}`}
            title={balls.map((b) => `${b.name}: ${b.count}`).join(" · ")}
          >
            <Pokeball size={12} className={ballLow ? "pulse-soft" : ""} />{fmt(ballTotal)}
          </span>
        </>
      )}
    </div>
  );
}
