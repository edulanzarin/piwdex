"use client";

// Painel (visao geral) da area VIP: o cockpit que resume TUDO ao vivo — conexao do robo,
// hunt atual com rendimento, plano de leveling em progresso, feed de kills em tempo real,
// totalizadores e ultimos eventos. Nada aqui faz fetch: e tudo do VipLiveProvider (SSE).

import { useMemo } from "react";
import { useVipLive, type LiveStatus } from "./vip-live";
import type { HuntOption } from "./hunt-analyzer";
import { StatTile } from "./stat-tile";
import { Sprite } from "./sprite";
import { Pokeball } from "./pokeball";
import {
  Coin, Star, Xp, Skull, Clock, Signal, Brain, Flag, Target, Chart, Backpack, ChevronRight,
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

export function VipOverview({
  hunts, creatures, itemIcons, onGo,
}: {
  hunts: HuntOption[];
  creatures: { pokeId: number; name: string }[];
  itemIcons: Record<string, string>;
  onGo: (section: string) => void;
}) {
  const t = useT();
  const { hunt, account, events, totals } = useVipLive();

  const status: LiveStatus = hunt?.status ?? "idle";
  const running = status === "running";
  const a = hunt?.analyzer ?? null;
  const lv = hunt?.leveling ?? null;
  const plan = hunt?.plan ?? null;

  const huntOpt = useMemo(
    () => (hunt?.slug ? (hunts.find((h) => h.slug === hunt.slug) ?? null) : null),
    [hunts, hunt?.slug],
  );
  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);

  const lvPct = lv
    ? Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100))
    : 0;
  const currentStep = lv && plan ? (plan.find((s) => lv.currentLevel >= s.from && lv.currentLevel <= s.to) ?? plan[plan.length - 1]) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* linha 1: monitor do robo · hunt atual · plano */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* monitor do robo */}
        <div className={`card flex flex-col gap-3 p-4 ${running ? "glow-pulse" : ""}`} style={{ "--accent": "var(--green)" } as React.CSSProperties}>
          <div className="flex items-center gap-2.5">
            <span className={`hud-led ${running || hunt?.reconnecting ? "pulse-soft" : ""}`} style={{ "--led": hunt?.reconnecting ? "var(--yellow)" : LED[status] } as React.CSSProperties} />
            <h3 className="section-title flex-1">{t("vip.ov.robot")}</h3>
            <Signal size={12} className={running ? "text-green" : "text-text-dim"} />
          </div>
          <div className="pixel text-[0.8rem]" style={{ color: hunt?.reconnecting ? "var(--yellow)" : LED[status] }}>
            {hunt?.reconnecting ? t("vip.ov.reconnecting") : t(`robo.hunt.status.${status}`)}
          </div>
          <div className="flex flex-wrap gap-2 text-[0.62rem] text-text-dim">
            {hunt?.desiredOn && <span className="chip bg-surface-2 !text-text-dim">{t("vip.ov.keepAlive")}</span>}
            {hunt?.since && running && <span className="inline-flex items-center gap-1"><Clock size={10} />{hm(Math.floor((Date.now() - hunt.since) / 1000))}</span>}
            {hunt?.error && !running && <span className="text-red">{hunt.error}</span>}
          </div>
          {!hunt?.desiredOn && (
            <button type="button" onClick={() => onGo("hunt")} className="btn btn-green mt-auto self-start">
              {t("vip.ov.turnOn")} <ChevronRight size={10} />
            </button>
          )}
        </div>

        {/* hunt atual */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <Target size={12} className="text-cyan" />
            <h3 className="section-title flex-1">{t("vip.ov.hunt")}</h3>
            {hunt?.mode && hunt.desiredOn && (
              <span className="chip" style={{ background: hunt.mode === "manual" ? "var(--surface-2)" : hunt.mode === "auto" ? "var(--cyan)" : "var(--purple)", color: hunt.mode === "manual" ? "var(--text-dim)" : "#06131a" }}>
                {t(`vip.hud.mode.${hunt.mode}`)}
              </span>
            )}
          </div>
          {huntOpt ? (
            <>
              <div className="flex items-center gap-3">
                {huntOpt.pokeId != null && (
                  <span className="flex h-12 w-12 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={40} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="pixel truncate text-[0.78rem] text-cyan">{huntOpt.name}</div>
                  <div className="text-[0.62rem] text-text-dim">Lv{huntOpt.level} · {huntOpt.area}</div>
                </div>
              </div>
              {a && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.66rem] tabular-nums">
                  <span className="inline-flex items-center gap-1 text-cyan"><Xp size={10} />{fmt(a.xpPerHour)}/h</span>
                  <span className="inline-flex items-center gap-1 text-green"><Coin size={10} />{fmt(a.goldPerHour)}/h</span>
                  <span className="inline-flex items-center gap-1 text-text-dim"><Skull size={10} />{fmt(a.killsPerHour)}/h</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-[0.7rem] text-text-dim">{t("vip.ov.noHunt")}</p>
          )}
        </div>

        {/* plano de leveling */}
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <Flag size={12} className="text-purple" />
            <h3 className="section-title flex-1">{t("vip.ov.plan")}</h3>
            {lv?.done && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span>}
          </div>
          {lv ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="pixel text-[0.78rem] text-purple">{lv.name}</span>
                <span className="pixel text-[0.62rem] text-text">{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></span>
              </div>
              <div className="hud-track">
                <span className="hud-fill block bg-purple" style={{ width: `${lvPct}%` }} />
              </div>
              {currentStep && !lv.done && (
                <div className="text-[0.62rem] text-text-dim">
                  {t("vip.ov.planStep")}: <span className="text-text">{currentStep.huntName}</span> ({currentStep.from}-{currentStep.to}) · ~{fmt(currentStep.xpH)} XP/h
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[0.7rem] text-text-dim">{t("vip.ov.noPlan")}</p>
              <button type="button" onClick={() => onGo("hunt")} className="btn btn-purple mt-auto self-start">
                {t("vip.ov.makePlan")} <ChevronRight size={10} />
              </button>
            </>
          )}
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

      {/* linha 3: feed de kills AO VIVO + eventos recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <h3 className="section-title flex-1 text-cyan">{t("vip.ov.liveFeed")}</h3>
            {running && <span className="inline-flex items-center gap-1.5 text-[0.55rem] uppercase text-green"><span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />{t("vip.ov.live")}</span>}
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

      {/* linha 4: totalizadores de sempre (cumulativo) */}
      {totals && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Chart size={11} className="text-purple" />
            <span className="field-label">{t("vip.ov.totals")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label={t("vip.ov.tHunts")} value={fmt(totals.hunts)} icon={<Target size={11} className="text-cyan" />} hover />
            <StatTile label={t("vip.ov.tKills")} value={fmt(totals.kills)} icon={<Skull size={11} className="text-text-dim" />} hover />
            <StatTile label={t("vip.ov.tXp")} value={fmt(totals.xpGained)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} hover />
            <StatTile label={t("vip.ov.tGold")} value={fmt(totals.itemsGold + totals.pokesGold + totals.lootGold)} accent="var(--green)" icon={<Coin size={11} />} hover />
            <StatTile label={t("vip.ov.tCaptures")} value={fmt(totals.captures)} icon={<Pokeball size={11} />} hover />
            <StatTile label={t("vip.ov.tAcervo")} value={fmt(totals.acervo?.total ?? 0)} accent="var(--blue)" icon={<Backpack size={11} className="text-blue" />} hover />
          </div>
        </div>
      )}

      {/* streak/conta rapida */}
      {account?.account && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={t("vip.ov.streak")} value={`${fmt(account.account.streak.totalKills)}`} icon={<Skull size={11} className="text-yellow" />} />
          <StatTile label={t("vip.ov.bonusXp")} value={`+${account.account.streak.bonusExp}%`} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
          <StatTile label={t("vip.ov.bonusLoot")} value={`+${account.account.streak.bonusLoot}%`} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile label={t("vip.ov.bonusShiny")} value={`+${account.account.streak.bonusShiny}%`} accent="var(--yellow)" icon={<Star size={11} className="text-yellow" />} />
        </div>
      )}
    </div>
  );
}
