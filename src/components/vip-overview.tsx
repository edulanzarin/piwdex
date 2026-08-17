"use client";

// Painel (cockpit) da area VIP — modelo CONEXAO-PRIMEIRO:
//   "Ligar o robo" TOMA a sessao da conta e segura. A partir dai tudo opera na mesma
//   conexao: time ao vivo (com troca de lider em um clique), hunt/auto/leveling como
//   jobs, vendas, recursos. Se a conexao falhar, o painel APITA (banner vermelho +
//   countdown da proxima tentativa). Nada aqui faz fetch de leitura — tudo e o stream.

import { useEffect, useMemo, useState } from "react";
import { useVipLive, type LiveStatus } from "./vip-live";
import type { HuntOption } from "./hunt-analyzer";
import { TeamLive } from "./team-live";
import { StatTile } from "./stat-tile";
import { Sprite } from "./sprite";
import { Pokeball } from "./pokeball";
import {
  Coin, Diamond, Star, Xp, Skull, Clock, Signal, Brain, Flag, Target, Chart, Backpack,
  ChevronRight, Robot,
} from "./icons";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
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
  "item-bought": <Coin size={11} className="text-green" />,
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
  const { hunt, account, events, totals, applyHunt } = useVipLive();
  const [busy, setBusy] = useState(false);

  const status: LiveStatus = hunt?.status ?? "idle";
  const connected = !!hunt?.wsOpen;
  const holdOpen = !!hunt?.holdOpen;
  const hunting = connected && !!hunt?.slug;
  const troubled = holdOpen && !connected; // quer conectado mas nao esta -> APITA
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
  const balls = account?.account?.balls ?? [];
  const xpPct = prof && prof.xpForNext > 0 ? Math.min(100, (prof.xpInLevel / prof.xpForNext) * 100) : 0;

  const lvPct = lv
    ? Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100))
    : 0;
  const currentStep = lv && plan ? (plan.find((s) => lv.currentLevel >= s.from && lv.currentLevel <= s.to) ?? plan[plan.length - 1]) : null;

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (j && "status" in j) applyHunt(j);
    } finally { setBusy(false); }
  };

  // rotulo do estado da conexao (conectado != cacando)
  const statusLabel = troubled
    ? (retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t(`robo.hunt.status.${status}`))
    : hunting ? t("vip.conn.hunting")
    : connected ? t("vip.conn.connected")
    : status === "connecting" ? t("robo.hunt.status.connecting")
    : t("vip.conn.off");

  return (
    <div className="flex flex-col gap-4">
      {/* APITO: o jogo invalidou o vinculo — precisa do bookmark UMA vez de novo */}
      {account?.reason === "expired" && (
        <div className="flash-in flex flex-wrap items-center gap-3 rounded border border-red/60 bg-[color:var(--red)]/10 px-4 py-3"
          style={{ "--accent": "var(--red)" } as React.CSSProperties}>
          <span className="hud-led pulse-soft shrink-0" style={{ "--led": "var(--red)" } as React.CSSProperties} />
          <span className="pixel text-[0.62rem] text-red">{t("vip.conn.expired")}</span>
          <span className="text-[0.62rem] text-text-dim">{t("vip.conn.expiredHint")}</span>
          <span className="ms-auto" />
          <button type="button" onClick={() => onGo("conta")} className="btn btn-pink">
            {t("vip.conn.expiredCta")} <ChevronRight size={9} />
          </button>
        </div>
      )}

      {/* APITO: quer conectado mas a conexao falhou/caiu */}
      {troubled && (
        <div className="flash-in flex flex-wrap items-center gap-3 rounded border border-red/60 bg-[color:var(--red)]/10 px-4 py-3"
          style={{ "--accent": "var(--red)" } as React.CSSProperties}>
          <span className="hud-led pulse-soft shrink-0" style={{ "--led": "var(--red)" } as React.CSSProperties} />
          <span className="pixel text-[0.62rem] text-red">{t("vip.conn.alarm")}</span>
          <span className="text-[0.62rem] text-text-dim">
            {hunt?.error ? `${hunt.error} · ` : ""}
            {retryIn != null ? t("vip.hud.retry", { s: retryIn }) : t("vip.conn.retrying")}
          </span>
          <span className="ms-auto" />
          <button type="button" onClick={() => void send({ action: "connect" })} disabled={busy} className="btn btn-pink disabled:opacity-40">
            {t("vip.conn.forceRetry")}
          </button>
        </div>
      )}

      {/* linha 1: conexao/robo · time ativo · hunt + plano */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* O ROBO — conexao-primeiro */}
        <div className={`card flex flex-col gap-3 p-4 lg:col-span-4 ${connected ? "glow-pulse" : ""}`}
          style={{ "--accent": troubled ? "var(--red)" : "var(--green)" } as React.CSSProperties}>
          <div className="flex items-center gap-2.5">
            <span className={`hud-led ${connected || status === "connecting" || hunt?.reconnecting ? "pulse-soft" : ""}`}
              style={{ "--led": troubled ? "var(--red)" : LED[status] } as React.CSSProperties} />
            <h3 className="section-title flex items-center gap-1.5"><Robot size={13} className={connected ? "text-green" : "text-text-dim"} /> {t("vip.ov.robot")}</h3>
            <span className="ms-auto" />
            {holdOpen && (
              <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.keepAlive")}</span>
            )}
          </div>

          <div className="pixel text-[0.85rem]" style={{ color: troubled ? "var(--red)" : connected ? "var(--green)" : "var(--text-dim)" }}>
            {statusLabel}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.62rem] text-text-dim">
            {connected && hunt?.since && <span className="inline-flex items-center gap-1"><Clock size={10} />{hm(Math.floor((Date.now() - hunt.since) / 1000))}</span>}
            {prof && <span className="inline-flex items-center gap-1"><Signal size={10} className={connected ? "text-green" : ""} />{prof.name}</span>}
            {hunt?.mode && hunt.mode !== "manual" && hunting && (
              <span className="inline-flex items-center gap-1 text-cyan">
                {hunt.mode === "auto" ? <Brain size={10} /> : <Flag size={10} />}
                {t(`vip.hud.mode.${hunt.mode}`)}
              </span>
            )}
          </div>

          {!holdOpen ? (
            <>
              <p className="text-[0.62rem] leading-relaxed text-text-dim">{t("vip.conn.connectDesc")}</p>
              <button type="button" onClick={() => void send({ action: "connect" })} disabled={busy} className="btn btn-green mt-auto disabled:opacity-40">
                {t("vip.conn.connect")} <ChevronRight size={10} />
              </button>
            </>
          ) : (
            <div className="mt-auto flex flex-wrap gap-2">
              {!hunting && connected && (
                <button type="button" onClick={() => void send({ action: "auto" })} disabled={busy} className="btn btn-cyan disabled:opacity-40">
                  <Brain size={10} /> {t("robo.mode.autoStart")}
                </button>
              )}
              {hunting && (
                <button type="button" onClick={() => void send({ action: "stop" })} disabled={busy} className="btn btn-ghost disabled:opacity-40">
                  {t("vip.conn.stopHunt")}
                </button>
              )}
              <button type="button" onClick={() => void send({ action: "disconnect" })} disabled={busy} className="btn btn-ghost disabled:opacity-40">
                {t("vip.conn.disconnect")}
              </button>
            </div>
          )}
        </div>

        {/* TIME ATIVO ao vivo (summon em um clique) */}
        <div className="lg:col-span-4"><TeamLive /></div>

        {/* HUNT ATUAL + PLANO empilhados */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="card flex flex-col gap-2.5 p-4">
            <div className="flex items-center gap-2.5">
              <Target size={12} className="text-cyan" />
              <h3 className="section-title flex-1">{t("vip.ov.hunt")}</h3>
              {hunting && (
                <span className="inline-flex items-center gap-1.5 text-[0.55rem] uppercase text-green">
                  <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />{t("vip.ov.live")}
                </span>
              )}
            </div>
            {huntOpt ? (
              <div className="flex items-center gap-3">
                {huntOpt.pokeId != null && (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={38} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="pixel truncate text-[0.75rem] text-cyan">{huntOpt.name}</div>
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.64rem] text-text-dim">{t("vip.ov.noHunt")}</p>
                <button type="button" onClick={() => onGo("hunt")} className="btn btn-ghost shrink-0">{t("vip.ov.turnOn")} <ChevronRight size={9} /></button>
              </div>
            )}
          </div>

          <div className="card flex flex-1 flex-col gap-2.5 p-4">
            <div className="flex items-center gap-2.5">
              <Flag size={12} className="text-purple" />
              <h3 className="section-title flex-1">{t("vip.ov.plan")}</h3>
              {lv?.done && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span>}
            </div>
            {lv ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="pixel text-[0.75rem] text-purple">{lv.name}</span>
                  <span className="pixel text-[0.6rem] text-text">{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></span>
                </div>
                <div className="hud-track"><span className="hud-fill block bg-purple" style={{ width: `${lvPct}%` }} /></div>
                {currentStep && !lv.done && (
                  <div className="text-[0.6rem] text-text-dim">
                    {t("vip.ov.planStep")}: <span className="text-text">{currentStep.huntName}</span> ({currentStep.from}-{currentStep.to}) · ~{fmt(currentStep.xpH)} XP/h
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.64rem] text-text-dim">{t("vip.ov.noPlan")}</p>
                <button type="button" onClick={() => onGo("hunt")} className="btn btn-purple shrink-0">{t("vip.ov.makePlan")} <ChevronRight size={9} /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* linha 2: rendimento da hunt ao vivo */}
      {a && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <StatTile label={t("robo.hunt.kills")} value={fmt(a.kills)} icon={<Skull size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.hunt.time")} value={hm(a.seconds)} icon={<Clock size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.hunt.xph")} value={fmt(a.xpPerHour)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
          <StatTile label={t("robo.hunt.goldph")} value={fmt(a.goldPerHour)} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile label={t("robo.hunt.captures")} value={fmt(a.captures)} icon={<Pokeball size={11} />} />
          <StatTile label={t("robo.hunt.loot")} value={fmt(a.lootGold)} icon={<Coin size={11} />} />
          <StatTile label={t("robo.hunt.supply")} value={`-${fmt(a.supplyGold)}`} accent="var(--pink)" icon={<Coin size={11} />} />
          <StatTile label={t("robo.hunt.balance")} value={fmt(a.balance)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      )}

      {/* linha 3: recursos da conta (nivel/XP, moedas, bolas por tipo) */}
      {prof && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="card flex flex-col gap-2.5 p-4 lg:col-span-4">
            <div className="flex items-center gap-2">
              <Xp size={12} className="text-cyan" />
              <h3 className="section-title flex-1">{t("vip.res.progress")}</h3>
              <span className="pixel text-[0.72rem] text-yellow">Lv{prof.level}</span>
            </div>
            <div className="hud-track"><span className="hud-fill block bg-cyan" style={{ width: `${xpPct}%` }} /></div>
            <div className="flex justify-between text-[0.58rem] tabular-nums text-text-dim">
              <span>{fmt(prof.xpInLevel)} XP</span>
              <span>{fmt(prof.xpForNext)} XP</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label={t("vip.res.gold")} value={fmt(prof.gold)} accent="var(--green)" icon={<Coin size={11} />} />
              <StatTile label={t("vip.res.diamonds")} value={fmt(prof.diamonds)} accent="var(--cyan)" icon={<span className="text-cyan"><Diamond size={11} /></span>} />
            </div>
          </div>

          <div className="card flex flex-col gap-2.5 p-4 lg:col-span-8">
            <div className="flex items-center gap-2">
              <Pokeball size={13} />
              <h3 className="section-title flex-1">{t("vip.res.balls")}</h3>
              <button type="button" onClick={() => onGo("config")} className="icon-btn" aria-label={t("vip.sec.config")}><ChevronRight size={11} /></button>
            </div>
            {balls.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {balls.map((b) => {
                  const low = !b.infinite && b.count < 100;
                  return (
                    <div key={b.id} className={`well flex items-center gap-2 ${low ? "border-red/50" : ""}`}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                        {b.iconUrl ? <Sprite src={b.iconUrl} alt={b.name} size={24} /> : <Pokeball size={18} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.58rem] text-text-dim">{b.name}</span>
                        <span className={`pixel block text-[0.7rem] tabular-nums ${low ? "text-red" : "text-text"}`}>
                          {b.infinite ? "∞" : fmt(b.count)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-center text-[0.64rem] text-text-dim">{t("vip.res.noBalls")}</p>
            )}
          </div>
        </div>
      )}

      {/* linha 4: feed de kills AO VIVO + eventos recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <h3 className="section-title flex-1 text-cyan">{t("vip.ov.liveFeed")}</h3>
            {hunting && <span className="inline-flex items-center gap-1.5 text-[0.55rem] uppercase text-green"><span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />{t("vip.ov.live")}</span>}
          </div>
          {hunt?.recentKills?.length ? (
            <div className="flex flex-col gap-1.5">
              {hunt.recentKills.slice(0, 6).map((k, i) => {
                const pid = pokeByName.get(k.species.toLowerCase());
                const isCatch = k.kind === "catch";
                return (
                  <div key={`${k.at}-${i}`} className={`flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2 ${i === 0 ? "flash-in" : ""}`}
                    style={{ "--accent": isCatch ? "var(--green)" : "var(--cyan)" } as React.CSSProperties}>
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                      {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={28} />}
                      {k.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={8} /></span>}
                      {isCatch && <span className="absolute -bottom-1 -left-1"><Pokeball size={11} /></span>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.7rem]">{k.species}</span>
                    {isCatch ? (
                      <span className="shrink-0 text-[0.6rem] font-semibold text-green">{t("robo.hunt.caught")}</span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[0.62rem] text-cyan"><Xp size={9} />{fmt(k.xp)}</span>
                    )}
                    {!isCatch && k.loot.slice(0, 3).map((l, j) => {
                      const icon = itemIcons[l.name.toLowerCase()];
                      return icon ? <Sprite key={j} src={assetIconUrl(icon)} alt={l.name} size={14} /> : null;
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-[0.68rem] text-text-dim">{t("vip.ov.noKills")}</p>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="section-title text-yellow">{t("vip.ov.events")}</h3>
            <button type="button" onClick={() => onGo("alertas")} className="icon-btn" aria-label={t("vip.ov.allEvents")}>
              <ChevronRight size={11} />
            </button>
          </div>
          {events?.events?.length ? (
            <div className="flex flex-col gap-1.5">
              {events.events.slice(0, 6).map((ev) => (
                <div key={ev.id} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-2">
                    {EVENT_ICON[ev.kind] ?? <Chart size={11} className="text-text-dim" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.68rem] text-text">{ev.title}</div>
                    {ev.body && <div className="truncate text-[0.58rem] text-text-dim">{ev.body}</div>}
                  </div>
                  <span className="shrink-0 text-[0.55rem] text-text-dim">{ago(ev.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-[0.68rem] text-text-dim">{t("vip.ov.noEvents")}</p>
          )}
        </div>
      </div>

      {/* linha 5: acumulado de sempre + streak */}
      <div className="grid gap-4 lg:grid-cols-12">
        {totals && (
          <div className="card flex flex-col gap-2.5 p-4 lg:col-span-8">
            <div className="flex items-center gap-2">
              <Chart size={12} className="text-purple" />
              <h3 className="section-title flex-1">{t("vip.ov.totals")}</h3>
              <button type="button" onClick={() => onGo("estatisticas")} className="icon-btn" aria-label={t("vip.sec.estatisticas")}><ChevronRight size={11} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label={t("vip.ov.tHunts")} value={fmt(totals.hunts)} icon={<Target size={11} className="text-cyan" />} hover />
              <StatTile label={t("vip.ov.tKills")} value={fmt(totals.kills)} icon={<Skull size={11} className="text-text-dim" />} hover />
              <StatTile label={t("vip.ov.tXp")} value={fmt(totals.xpGained)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} hover />
              {/* so dolar RECEBIDO (vendas) — o valor do loot coletado vira venda depois, somar duplicaria */}
              <StatTile label={t("vip.ov.tGold")} value={fmt(totals.itemsGold + totals.pokesGold)} accent="var(--green)" icon={<Coin size={11} />} hover />
              <StatTile label={t("vip.ov.tCaptures")} value={fmt(totals.captures)} icon={<Pokeball size={11} />} hover />
              <StatTile label={t("vip.ov.tAcervo")} value={fmt(totals.acervo?.total ?? 0)} accent="var(--blue)" icon={<Backpack size={11} className="text-blue" />} hover />
            </div>
          </div>
        )}
        {account?.account && (
          <div className="card flex flex-col gap-2.5 p-4 lg:col-span-4">
            <div className="flex items-center gap-2">
              <Star size={12} className="text-yellow" />
              <h3 className="section-title flex-1">{t("vip.res.streakTitle")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label={t("vip.ov.streak")} value={fmt(account.account.streak.totalKills)} icon={<Skull size={11} className="text-yellow" />} />
              <StatTile label={t("vip.ov.bonusXp")} value={`+${account.account.streak.bonusExp}%`} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
              <StatTile label={t("vip.ov.bonusLoot")} value={`+${account.account.streak.bonusLoot}%`} accent="var(--green)" icon={<Coin size={11} />} />
              <StatTile label={t("vip.ov.bonusShiny")} value={`+${account.account.streak.bonusShiny}%`} accent="var(--yellow)" icon={<Star size={11} className="text-yellow" />} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
