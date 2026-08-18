"use client";

// Painel (cockpit) da area VIP — modelo CONEXAO-PRIMEIRO:
//   "Ligar o robo" TOMA a sessao da conta e segura. A partir dai tudo opera na mesma
//   conexao: time ao vivo (com troca de lider em um clique), hunt/auto/leveling como
//   jobs, vendas, recursos. Se a conexao falhar, o painel APITA (banner vermelho +
//   countdown da proxima tentativa). Nada aqui faz fetch de leitura — tudo e o stream.
//
// Estrutura: banners de alerta -> BARRA DE COMANDO do robo (hero, largura cheia) ->
// grade time/hunt+plano/progresso -> régua de rendimento ao vivo -> pokebolas ->
// feeds (kills + eventos) -> acumulado + streak. Tudo montado com os primitivos de
// src/components/ui (Panel, FeedRow, EmptyState, ProgressBar, Led/LiveBadge/AlertBanner).

import { useEffect, useMemo, useState } from "react";
import { useVipLive, type LiveStatus } from "./vip-live";
import type { HuntOption } from "./hunt-analyzer";
import { TeamLive } from "./team-live";
import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { Led, LiveBadge, AlertBanner } from "./ui/status";
import { ProgressBar } from "./ui/progress";
import { FeedRow, EmptyState } from "./ui/feed";
import { Sprite } from "./sprite";
import { Pokeball } from "./pokeball";
import {
  Coin, Loot, Diamond, Star, Xp, Skull, Clock, Signal, Brain, Flag, Target, Chart, Backpack,
  ChevronRight, Robot,
} from "./icons";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const hm = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};

// Master Ball (id 5): o jogo lista no catalogo mas nao vende e ninguem tem — so ocupava
// espaco (sempre x0 em vermelho). Fora do painel.
const MASTER_BALL_ID = 5;

const LED: Record<LiveStatus, string> = {
  idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)",
  kicked: "var(--yellow)", error: "var(--red)",
};

const EVENT_ICON: Record<string, React.ReactNode> = {
  "shiny": <Star size={11} className="text-yellow" />,
  "hunt-summary": <Target size={11} className="text-cyan" />,
  "brain": <Brain size={11} className="text-cyan" />,
  "reconnect": <Signal size={11} className="text-green" />,
  "goal": <Flag size={11} className="text-purple" />,
  "item-bought": <Loot size={11} className="text-green" />,
  "error": <Skull size={11} className="text-red" />,
};

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

export function VipOverview({
  hunts, creatures, itemIcons, onGo,
}: {
  hunts: HuntOption[];
  creatures: { pokeId: number; name: string }[];
  itemIcons: Record<string, string>;
  onGo: (section: string) => void;
}) {
  const t = useT();
  const toast = useToast();
  const { hunt, account, events, totals, applyHunt } = useVipLive();
  const [busy, setBusy] = useState(false);

  const status: LiveStatus = hunt?.status ?? "idle";
  const connected = !!hunt?.wsOpen;
  const holdOpen = !!hunt?.holdOpen;
  const hunting = connected && !!hunt?.slug;
  const contested = !!hunt?.contested; // conta tomada (usuario no jogo) -> robo cedeu e pausou
  const troubled = holdOpen && !connected && !contested; // quer conectado mas nao esta -> APITA
  const a = hunt?.analyzer ?? null;
  const lv = hunt?.leveling ?? null;
  const plan = hunt?.plan ?? null;
  const retryIn = useCountdown(hunt?.reconnecting ? hunt.nextRetryAt : null);

  const huntOpt = useMemo(
    () => (hunt?.slug ? (hunts.find((h) => h.slug === hunt.slug) ?? null) : null),
    [hunts, hunt?.slug],
  );
  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);

  const prof = account?.account?.profile ?? null;
  const balls = (account?.account?.balls ?? []).filter((b) => b.id !== MASTER_BALL_ID);
  const xpPct = prof && prof.xpForNext > 0 ? Math.min(100, (prof.xpInLevel / prof.xpForNext) * 100) : 0;

  const lvPct = lv
    ? Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100))
    : 0;
  const currentStep = lv && plan ? (plan.find((s) => lv.currentLevel >= s.from && lv.currentLevel <= s.to) ?? plan[plan.length - 1]) : null;

  const send = async (body: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (j && "status" in j) applyHunt(j);
      if (r.ok && okMsg) toast.success(okMsg);
      else if (!r.ok) toast.error(t("toast.err"));
    } finally { setBusy(false); }
  };

  // rotulo do estado da conexao (conectado != cacando)
  const statusLabel = troubled
    ? (retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t(`robo.hunt.status.${status}`))
    : hunting ? t("vip.conn.hunting")
    : connected ? t("vip.conn.connected")
    : status === "connecting" ? t("robo.hunt.status.connecting")
    : t("vip.conn.off");

  const heroColor = troubled ? "var(--red)" : connected ? "var(--green)" : "var(--text-dim)";

  return (
    <div className="flex flex-col gap-4">
      {/* APITO: o jogo invalidou o vinculo — precisa do bookmark UMA vez de novo */}
      {account?.reason === "expired" && (
        <AlertBanner
          color="var(--red)"
          title={t("vip.conn.expired")}
          detail={t("vip.conn.expiredHint")}
          action={
            <button type="button" onClick={() => onGo("conta")} className="btn btn-pink">
              {t("vip.conn.expiredCta")} <ChevronRight size={9} />
            </button>
          }
        />
      )}

      {/* CEDEU A SESSAO: a conta foi tomada (usuario entrou no jogo). Um clique religa. */}
      {contested && (
        <AlertBanner
          color="var(--yellow)"
          title={t("vip.contested.status")}
          detail={t("vip.contested.note")}
          action={
            <button type="button" onClick={() => void send({ action: "connect" }, t("toast.connected"))} disabled={busy} className="btn btn-yellow disabled:opacity-40">
              {t("vip.contested.resume")} <ChevronRight size={9} />
            </button>
          }
        />
      )}

      {/* APITO: quer conectado mas a conexao falhou/caiu */}
      {troubled && (
        <AlertBanner
          color="var(--red)"
          title={t("vip.conn.alarm")}
          detail={<>{hunt?.error ? `${hunt.error} · ` : ""}{retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t("vip.conn.retrying")}</>}
          action={
            <button type="button" onClick={() => void send({ action: "connect" })} disabled={busy} className="btn btn-pink disabled:opacity-40">
              {t("vip.conn.forceRetry")}
            </button>
          }
        />
      )}

      {/* ===== BARRA DE COMANDO DO ROBO: uma linha, status + meta + acoes ===== */}
      <section
        className={`card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${connected ? "glow-pulse" : ""}`}
        style={{ "--accent": troubled ? "var(--red)" : "var(--green)" } as React.CSSProperties}
      >
        <Led color={troubled ? "var(--red)" : LED[status]} pulse={connected || status === "connecting" || !!hunt?.reconnecting} />
        <Robot size={14} className={connected ? "text-green" : "text-text-dim"} />
        <span className="pixel text-[1.05rem]" style={{ color: heroColor }}>{statusLabel}</span>
        {holdOpen && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.keepAlive")}</span>}
        <span className="hidden flex-wrap items-center gap-x-3 text-[0.62rem] text-text-dim sm:flex">
          {connected && hunt?.since && <span className="inline-flex items-center gap-1"><Clock size={10} />{hm(Math.floor((Date.now() - hunt.since) / 1000))}</span>}
          {prof && <span className="inline-flex items-center gap-1"><Signal size={10} className={connected ? "text-green" : ""} />{prof.name}</span>}
          {hunt?.mode && hunt.mode !== "manual" && hunting && (
            <span className="inline-flex items-center gap-1 text-cyan">
              {hunt.mode === "auto" ? <Brain size={10} /> : <Flag size={10} />}
              {t(`vip.hud.mode.${hunt.mode}`)}
            </span>
          )}
          {!holdOpen && <span>{t("vip.conn.connectDesc")}</span>}
        </span>
        <span className="ms-auto" />
        {!holdOpen ? (
          <button type="button" onClick={() => void send({ action: "connect" }, t("toast.connected"))} disabled={busy} className="btn btn-green disabled:opacity-40">
            {t("vip.conn.connect")} <ChevronRight size={10} />
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!hunting && connected && (
              <button type="button" onClick={() => void send({ action: "auto" }, t("toast.autoOn"))} disabled={busy} className="btn btn-cyan disabled:opacity-40">
                <Brain size={10} /> {t("robo.mode.autoStart")}
              </button>
            )}
            {hunting && (
              <button type="button" onClick={() => void send({ action: "stop" }, t("toast.huntOff"))} disabled={busy} className="btn btn-ghost disabled:opacity-40">
                {t("vip.conn.stopHunt")}
              </button>
            )}
            <button type="button" onClick={() => void send({ action: "disconnect" }, t("toast.disconnected"))} disabled={busy} className="btn btn-ghost disabled:opacity-40">
              {t("vip.conn.disconnect")}
            </button>
          </div>
        )}
      </section>

      {/* ===== régua de rendimento AO VIVO (hunt rodando) ===== */}
      {hunting && a && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <StatTile live label={t("robo.hunt.kills")} value={fmt(a.kills)} icon={<Skull size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.hunt.time")} value={hm(a.seconds)} icon={<Clock size={11} className="text-text-dim" />} />
          <StatTile live label={t("robo.hunt.xph")} value={fmt(a.xpPerHour)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
          <StatTile live label={t("robo.hunt.goldph")} value={fmt(a.goldPerHour)} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.captures")} value={fmt(a.captures)} icon={<Pokeball size={11} />} />
          <StatTile live label={t("robo.hunt.loot")} value={fmt(a.lootGold)} icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.supply")} value={`-${fmt(a.supplyGold)}`} accent="var(--pink)" icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.balance")} value={fmt(a.balance)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      )}

      {/* ===== linha principal: time · hunt+plano · progresso — colunas de MESMA altura,
             vazios em linha compacta (nada de caixa em branco) ===== */}
      <div className="grid items-stretch gap-4 lg:grid-cols-12">
        <div className="flex lg:col-span-4 [&>*]:w-full"><TeamLive /></div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Panel icon={<Target size={12} />} accent="var(--cyan)" title={t("vip.ov.hunt")} live={hunting} className={huntOpt ? "flex-1" : ""}>
            {huntOpt ? (
              <div className="flex items-center gap-3">
                {huntOpt.pokeId != null && (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={38} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="pixel truncate text-[0.95rem] text-cyan">{huntOpt.name}</div>
                  <div className="text-[0.6rem] text-text-dim">Lv{huntOpt.level} · {huntOpt.area}</div>
                </div>
                {a && (
                  <div className="shrink-0 text-right text-[0.62rem] tabular-nums">
                    <div className="inline-flex items-center gap-1 text-cyan"><Xp size={9} />{fmt(a.xpPerHour)}/h</div>
                    <div className="inline-flex items-center gap-1 text-green"><Coin size={9} />{fmt(a.goldPerHour)}/h</div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                compact
                message={t("vip.ov.noHunt")}
                action={<button type="button" onClick={() => onGo("hunt")} className="btn btn-ghost shrink-0">{t("vip.ov.turnOn")} <ChevronRight size={9} /></button>}
              />
            )}
          </Panel>

          <Panel
            icon={<Flag size={12} />} accent="var(--purple)" title={t("vip.ov.plan")}
            right={lv?.done ? <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span> : undefined}
            className={lv ? "flex-1" : ""}
          >
            {lv ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="pixel text-[0.95rem] text-purple">{lv.name}</span>
                  <span className="pixel text-[0.8rem] text-text">{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></span>
                </div>
                <ProgressBar pct={lvPct} color="var(--purple)" />
                {currentStep && !lv.done && (
                  <div className="text-[0.6rem] text-text-dim">
                    {t("vip.ov.planStep")}: <span className="text-text">{currentStep.huntName}</span> ({currentStep.from}-{currentStep.to}) · ~{fmt(currentStep.xpH)} XP/h
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                compact
                message={t("vip.ov.noPlan")}
                action={<button type="button" onClick={() => onGo("hunt")} className="btn btn-purple shrink-0">{t("vip.ov.makePlan")} <ChevronRight size={9} /></button>}
              />
            )}
          </Panel>

          {/* pokebolas entram na coluna do meio pra fechar a altura sem sobra */}
          {prof && (
            <Panel
              icon={<Pokeball size={13} />} title={t("vip.res.balls")}
              right={<button type="button" onClick={() => onGo("config")} className="icon-btn" aria-label={t("vip.sec.config")}><ChevronRight size={11} /></button>}
              className="flex-1"
            >
              {balls.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {balls.map((b) => {
                    const low = !b.infinite && b.count < 100;
                    return (
                      <div key={b.id} className={`well flex items-center gap-2 ${low ? "border-red/50" : ""}`}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                          {b.iconUrl ? <Sprite src={b.iconUrl} alt={b.name} size={24} /> : <Pokeball size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.58rem] text-text-dim">{b.name}</span>
                          <span key={b.count} className={`pixel tick-glow block text-[0.9rem] tabular-nums ${low ? "text-red" : "text-text"}`}>
                            {b.infinite ? "∞" : fmt(b.count)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState compact message={t("vip.res.noBalls")} />
              )}
            </Panel>
          )}
        </div>

        <div className="flex lg:col-span-4">
          {prof && (
            <Panel
              icon={<Xp size={12} />} accent="var(--cyan)" title={t("vip.res.progress")}
              right={<span className="pixel text-[0.95rem] text-yellow">Lv{prof.level}</span>}
              className="w-full"
            >
              <ProgressBar pct={xpPct} color="var(--cyan)" leftLabel={`${fmt(prof.xpInLevel)} XP`} rightLabel={`${fmt(prof.xpForNext)} XP`} />
              <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2">
                <StatTile live label={t("vip.res.gold")} value={fmt(prof.gold)} accent="var(--green)" icon={<Coin size={11} />} />
                <StatTile label={t("vip.res.diamonds")} value={fmt(prof.diamonds)} accent="var(--cyan)" icon={<span className="text-cyan"><Diamond size={11} /></span>} />
                {account?.account && (
                  <>
                    <StatTile label={t("vip.ov.streak")} value={fmt(account.account.streak.totalKills)} icon={<Skull size={11} className="text-yellow" />} />
                    <StatTile label={t("vip.ov.bonusXp")} value={`+${account.account.streak.bonusExp}%`} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
                    <StatTile label={t("vip.ov.bonusLoot")} value={`+${account.account.streak.bonusLoot}%`} accent="var(--green)" icon={<Coin size={11} />} />
                    <StatTile label={t("vip.ov.bonusShiny")} value={`+${account.account.streak.bonusShiny}%`} accent="var(--yellow)" icon={<Star size={11} className="text-yellow" />} />
                  </>
                )}
                {totals && (
                  <>
                    <StatTile label={t("vip.ov.tCaptures")} value={fmt(totals.captures)} icon={<Pokeball size={11} />} />
                    <StatTile label={t("vip.ov.tAcervo")} value={fmt(totals.acervo?.total ?? 0)} accent="var(--blue)" icon={<Backpack size={11} className="text-blue" />} />
                  </>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* ===== feeds: kills ao vivo + eventos recentes ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={<span className="text-cyan">{t("vip.ov.liveFeed")}</span>} live={hunting}>
          {hunt?.recentKills?.length ? (
            <div className="flex flex-col gap-1.5">
              {hunt.recentKills.slice(0, 6).map((k, i) => {
                const pid = pokeByName.get(k.species.toLowerCase());
                const isCatch = k.kind === "catch";
                return (
                  <FeedRow
                    key={`${k.at}-${i}`}
                    flash={i === 0}
                    accent={isCatch ? "var(--green)" : "var(--cyan)"}
                    leading={
                      <>
                        {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={28} />}
                        {k.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={8} /></span>}
                        {isCatch && <span className="absolute -bottom-1 -left-1"><Pokeball size={11} /></span>}
                      </>
                    }
                    title={k.species}
                    right={
                      <>
                        {isCatch ? (
                          <span className="text-[0.6rem] font-semibold text-green">{t("robo.hunt.caught")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[0.62rem] text-cyan"><Xp size={9} />{fmt(k.xp)}</span>
                        )}
                        {!isCatch && k.loot.slice(0, 3).map((l, j) => {
                          const icon = itemIcons[l.name.toLowerCase()];
                          return icon ? <Sprite key={j} src={assetIconUrl(icon)} alt={l.name} size={14} /> : null;
                        })}
                      </>
                    }
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState message={t("vip.ov.noKills")} />
          )}
        </Panel>

        <Panel
          title={<span className="text-yellow">{t("vip.ov.events")}</span>}
          right={<button type="button" onClick={() => onGo("alertas")} className="icon-btn" aria-label={t("vip.ov.allEvents")}><ChevronRight size={11} /></button>}
        >
          {events?.events?.length ? (
            <div className="flex flex-col gap-1.5">
              {events.events.slice(0, 6).map((ev) => (
                <FeedRow
                  key={ev.id}
                  leading={<span className="flex h-6 w-6 items-center justify-center rounded bg-surface-2">{EVENT_ICON[ev.kind] ?? <Chart size={11} className="text-text-dim" />}</span>}
                  title={ev.title}
                  sub={ev.body ?? undefined}
                  right={<span className="text-[0.55rem] text-text-dim">{ago(ev.createdAt)}</span>}
                />
              ))}
            </div>
          ) : (
            <EmptyState compact message={t("vip.ov.noEvents")} />
          )}
        </Panel>
      </div>

      {/* ===== acumulado de sempre (expansivel — streak ja mora no Progresso) ===== */}
      {totals && (
        <Panel
          collapsible
          icon={<Chart size={12} />} accent="var(--purple)" title={t("vip.ov.totals")}
          right={<button type="button" onClick={(e) => { e.stopPropagation(); onGo("estatisticas"); }} className="icon-btn" aria-label={t("vip.sec.estatisticas")}><ChevronRight size={11} /></button>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label={t("vip.ov.tHunts")} value={fmt(totals.hunts)} icon={<Target size={11} className="text-cyan" />} hover />
            <StatTile label={t("vip.ov.tKills")} value={fmt(totals.kills)} icon={<Skull size={11} className="text-text-dim" />} hover />
            <StatTile label={t("vip.ov.tXp")} value={fmt(totals.xpGained)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} hover />
            {/* so dolar RECEBIDO (vendas) — o valor do loot coletado vira venda depois, somar duplicaria */}
            <StatTile label={t("vip.ov.tGold")} value={fmt(totals.itemsGold + totals.pokesGold)} accent="var(--green)" icon={<Coin size={11} />} hover />
            <StatTile label={t("vip.ov.tCaptures")} value={fmt(totals.captures)} icon={<Pokeball size={11} />} hover />
            <StatTile label={t("vip.ov.tAcervo")} value={fmt(totals.acervo?.total ?? 0)} accent="var(--blue)" icon={<Backpack size={11} className="text-blue" />} hover />
          </div>
        </Panel>
      )}
    </div>
  );
}
