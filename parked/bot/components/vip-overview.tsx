"use client";

// Painel (cockpit) da area VIP — modelo CONEXAO-PRIMEIRO:
//   "Ligar o robo" TOMA a sessao da conta e segura. A partir dai tudo opera na mesma
//   conexao: time ao vivo (com troca de lider em um clique), hunt/auto/leveling como
//   jobs, vendas, recursos. Se a conexao falhar, o painel APITA (faixa de alerta +
//   countdown da proxima tentativa). Nada aqui faz fetch de leitura — tudo e o stream.
//
// Estrutura: faixa de alerta (SLOT fixo, um alerta por vez) -> BARRA DE COMANDO do robo
// (duas linhas de altura fixa, botoes sempre no mesmo lugar) -> regua de rendimento
// (sempre renderizada, placeholders quando parado) -> grade time/hunt+plano/progresso
// (colunas com min-h, nada de flex-1 condicional) -> feeds com altura FIXA + scroll ->
// acumulado. Tudo montado com os primitivos de src/components/ui.

import { useEffect, useMemo, useState } from "react";
import { useVipLive, type LiveStatus } from "./vip-live";
import type { HuntOption } from "./hunt-analyzer";
import type { MarketDex } from "./market-advisor";
import { TeamLive } from "./team-live";
import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { Led, AlertBanner } from "./ui/status";
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
  kicked: "var(--yellow)", error: "var(--red)", blocked: "var(--red)",
};

const EVENT_ICON: Record<string, React.ReactNode> = {
  "shiny": <Star size={14} className="text-yellow" />,
  "hunt-summary": <Target size={14} className="text-cyan" />,
  "brain": <Brain size={14} className="text-cyan" />,
  "reconnect": <Signal size={14} className="text-green" />,
  "blocked": <Signal size={14} className="text-red" />,
  "goal": <Flag size={14} className="text-purple" />,
  "item-bought": <Loot size={14} className="text-green" />,
  "error": <Skull size={14} className="text-red" />,
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
  hunts, creatures, itemIcons, dex, onGo,
}: {
  hunts: HuntOption[];
  creatures: { pokeId: number; name: string }[];
  itemIcons: Record<string, string>;
  dex?: Record<number, MarketDex>; // stats base por especie (modal de stats do time/box)
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
  const streak = account?.account?.streak ?? null;
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
  const expired = account?.reason === "expired";
  // rendimento ao vivo so vale com hunt rodando — fora disso a regua fica em placeholder
  const rv = hunting && a ? a : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ===== FAIXA DE ALERTA: um alerta por vez (expirado > contestada > conexao
             caida). SEM alerta nao existe faixa nenhuma — reservar altura aqui so
             deixava um box vazio com um LED, que nao quer dizer nada pra quem le.
             Reserva de espaco vale pra dado que vai e volta toda hora (o HUD); alerta
             e evento raro e existe justamente pra interromper. ===== */}
      {expired ? (
        // APITO: o jogo invalidou o vinculo — precisa do bookmark UMA vez de novo
        <AlertBanner
          color="var(--red)"
          title={t("vip.conn.expired")}
          detail={t("vip.conn.expiredHint")}
          action={
            <button type="button" onClick={() => onGo("conta")} className="btn btn-pink">
              {t("vip.conn.expiredCta")} <ChevronRight size={14} />
            </button>
          }
        />
      ) : contested ? (
        // CEDEU A SESSAO: a conta foi tomada (usuario entrou no jogo). Um clique religa.
        <AlertBanner
          color="var(--yellow)"
          title={t("vip.contested.status")}
          detail={t("vip.contested.note")}
          action={
            <button type="button" onClick={() => void send({ action: "connect" }, t("toast.connected"))} disabled={busy} className="btn btn-yellow disabled:opacity-40">
              {t("vip.contested.resume")} <ChevronRight size={14} />
            </button>
          }
        />
      ) : troubled ? (
        // APITO: quer conectado mas a conexao falhou/caiu
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
      ) : null}

      {/* ===== BARRA DE COMANDO DO ROBO: duas linhas de ALTURA FIXA (como o HUD).
             Linha 1: led + status + chip keep-alive (invisible reserva o lugar).
             Linha 2: meta em slots + botoes SEMPRE nos mesmos lugares — o secundario
             (desligar) desabilita em vez de sumir; o primario alterna no MESMO slot. ===== */}
      <section
        className={`card ${connected ? "glow-pulse" : ""}`}
        style={{ "--accent": troubled ? "var(--red)" : "var(--green)" } as React.CSSProperties}
      >
        <div className="flex h-11 min-w-0 items-center gap-3 border-b border-border/60 px-4">
          <Led color={troubled ? "var(--red)" : LED[status]} pulse={connected || status === "connecting" || !!hunt?.reconnecting} />
          <Robot size={18} className={`shrink-0 ${connected ? "text-green" : "text-text-dim"}`} />
          <span className="pixel min-w-0 truncate text-lg" style={{ color: heroColor }}>{statusLabel}</span>
          <span className={`chip shrink-0 ${holdOpen ? "" : "invisible"}`} style={{ background: "var(--green)", color: "#052012" }}>
            {t("vip.ov.keepAlive")}
          </span>
        </div>

        {/* h FIXA + trilho rolavel (mesmo recurso do HUD): a 360px "Ligar o robo" +
            "Desligar o robo" em caixa alta somam ~360px e estouravam o card. Rolar na
            horizontal AQUI mantem a altura fechada e a pagina sem rolagem lateral. */}
        <div className="flex h-14 items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* meta (sm+): slots permanentes quando o robo esta ligado; desligado, o
              MESMO espaco explica o que o botao faz — um conteudo por vez, altura igual */}
          <span className="hidden min-w-0 flex-1 items-center gap-x-4 text-sm text-text-dim sm:flex">
            {holdOpen ? (
              <>
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                  <Clock size={14} />
                  <span className={connected && hunt?.since ? "" : "slot-empty"}>
                    {connected && hunt?.since ? hm(Math.floor((Date.now() - hunt.since) / 1000)) : "—"}
                  </span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Signal size={14} className={`shrink-0 ${connected ? "text-green" : ""}`} />
                  <span className={`truncate ${prof ? "" : "slot-empty"}`}>{prof ? prof.name : "—"}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  {hunt?.mode && hunt.mode !== "manual" && hunting ? (
                    <span className="inline-flex items-center gap-1 text-cyan">
                      {hunt.mode === "auto" ? <Brain size={14} /> : <Flag size={14} />}
                      {t(`vip.hud.mode.${hunt.mode}`)}
                    </span>
                  ) : (
                    <span className="slot-empty inline-flex items-center gap-1"><Brain size={14} />—</span>
                  )}
                </span>
              </>
            ) : (
              <span className="min-w-0 truncate">{t("vip.conn.connectDesc")}</span>
            )}
          </span>

          <span className="ms-auto flex shrink-0 items-center gap-2">
            {/* slot PRIMARIO: ligar > parar hunt > iniciar auto — um por vez, mesmo lugar */}
            {!holdOpen ? (
              <button type="button" onClick={() => void send({ action: "connect" }, t("toast.connected"))} disabled={busy} className="btn btn-green disabled:opacity-40">
                {t("vip.conn.connect")} <ChevronRight size={14} />
              </button>
            ) : hunting ? (
              <button type="button" onClick={() => void send({ action: "stop" }, t("toast.huntOff"))} disabled={busy} className="btn btn-ghost disabled:opacity-40">
                {t("vip.conn.stopHunt")}
              </button>
            ) : (
              <button type="button" onClick={() => void send({ action: "auto" }, t("toast.autoOn"))} disabled={busy || !connected} className="btn btn-cyan disabled:opacity-40">
                <Brain size={14} /> {t("robo.mode.autoStart")}
              </button>
            )}
            {/* slot SECUNDARIO: desligar sempre presente; desabilita quando ja desligado */}
            <button type="button" onClick={() => void send({ action: "disconnect" }, t("toast.disconnected"))} disabled={busy || !holdOpen} className="btn btn-ghost disabled:opacity-40">
              {t("vip.conn.disconnect")}
            </button>
          </span>
        </div>
      </section>

      {/* ===== regua de rendimento AO VIVO: grade estavel SEMPRE renderizada —
             sem hunt rodando, cada tile mostra o placeholder no MESMO slot.
             As 8 colunas so entram no xl: com a fonte nova (mais larga) rotulo tipo
             "Dolares / hora" nao cabe no tile de ~85px que o lg dava. Degraus 2-3-4-8
             (sem pular): a 360px sao duas colunas de ~150px, que seguram o valor. ===== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8">
        <StatTile live={!!rv} label={t("robo.hunt.kills")} value={rv ? fmt(rv.kills) : undefined} icon={<Skull size={14} className="text-text-dim" />} />
        <StatTile label={t("robo.hunt.time")} value={rv ? hm(rv.seconds) : undefined} icon={<Clock size={14} className="text-text-dim" />} />
        <StatTile live={!!rv} label={t("robo.hunt.xph")} value={rv ? fmt(rv.xpPerHour) : undefined} accent="var(--cyan)" icon={<Xp size={14} className="text-cyan" />} />
        <StatTile live={!!rv} label={t("robo.hunt.goldph")} value={rv ? fmt(rv.goldPerHour) : undefined} accent="var(--green)" icon={<Coin size={14} />} />
        <StatTile live={!!rv} label={t("robo.hunt.captures")} value={rv ? fmt(rv.captures) : undefined} icon={<Pokeball size={14} />} />
        <StatTile live={!!rv} label={t("robo.hunt.loot")} value={rv ? fmt(rv.lootGold) : undefined} icon={<Coin size={14} />} />
        <StatTile live={!!rv} label={t("robo.hunt.supply")} value={rv ? `-${fmt(rv.supplyGold)}` : undefined} accent="var(--pink)" icon={<Coin size={14} />} />
        <StatTile live={!!rv} label={t("robo.hunt.balance")} value={rv ? fmt(rv.balance) : undefined} accent="var(--green)" icon={<Coin size={14} />} />
      </div>

      {/* ===== linha principal: time · hunt+plano · progresso — paineis SEMPRE
             renderizados com min-h fechado; vazio/carregando ocupa o mesmo espaco ===== */}
      <div className="grid items-stretch gap-4 lg:grid-cols-12">
        <div className="flex lg:col-span-4 [&>*]:w-full"><TeamLive dex={dex} /></div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Panel icon={<Target size={18} />} accent="var(--cyan)" title={t("vip.ov.hunt")} live={hunting} className="min-h-[8rem]" bodyClassName="justify-center">
            {huntOpt ? (
              <div className="flex items-center gap-3">
                {/* slot do sprite sempre presente — hunt sem pokeId nao desloca o texto */}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                  {huntOpt.pokeId != null ? <Sprite src={spriteUrl(huntOpt.pokeId)} alt={huntOpt.name} size={38} /> : <span className="slot-empty"><Pokeball size={20} /></span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="pixel truncate text-base text-cyan">{huntOpt.name}</div>
                  <div className="text-sm text-text-dim">Lv{huntOpt.level} · {huntOpt.area}</div>
                </div>
                <div className="shrink-0 text-right text-sm tabular-nums">
                  <div className={`inline-flex items-center gap-1 ${a ? "text-cyan" : "slot-empty"}`}><Xp size={14} />{a ? `${fmt(a.xpPerHour)}/h` : "—/h"}</div>
                  <div className={`flex items-center justify-end gap-1 ${a ? "text-green" : "slot-empty"}`}><Coin size={14} />{a ? `${fmt(a.goldPerHour)}/h` : "—/h"}</div>
                </div>
              </div>
            ) : (
              <EmptyState
                compact
                message={t("vip.ov.noHunt")}
                action={<button type="button" onClick={() => onGo("hunt")} className="btn btn-ghost shrink-0">{t("vip.ov.turnOn")} <ChevronRight size={14} /></button>}
              />
            )}
          </Panel>

          <Panel
            icon={<Flag size={18} />} accent="var(--purple)" title={t("vip.ov.plan")}
            right={lv?.done ? <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span> : undefined}
            className="min-h-[9.5rem]" bodyClassName="justify-center"
          >
            {lv ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="pixel text-base text-purple">{lv.name}</span>
                  <span className="pixel text-base tabular-nums text-text">{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></span>
                </div>
                <ProgressBar pct={lvPct} color="var(--purple)" />
                {/* linha da etapa sempre presente enquanto ha plano — concluir nao encolhe o painel */}
                <div className="text-sm text-text-dim">
                  {currentStep && !lv.done ? (
                    <>{t("vip.ov.planStep")}: <span className="text-text">{currentStep.huntName}</span> ({currentStep.from}-{currentStep.to}) · ~{fmt(currentStep.xpH)} XP/h</>
                  ) : (
                    <span className="slot-empty">—</span>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                compact
                message={t("vip.ov.noPlan")}
                action={<button type="button" onClick={() => onGo("hunt")} className="btn btn-purple shrink-0">{t("vip.ov.makePlan")} <ChevronRight size={14} /></button>}
              />
            )}
          </Panel>

          {/* pokebolas fecham a altura da coluna; sem snapshot ainda = grade de slots
              esmaecidos com as MESMAS dimensoes (nada aparece do nada) */}
          <Panel
            icon={<Pokeball size={18} />} title={t("vip.res.balls")}
            right={<button type="button" onClick={() => onGo("config")} className="icon-btn" aria-label={t("vip.sec.config")}><ChevronRight size={16} /></button>}
            className="min-h-[9rem] flex-1"
          >
            {prof ? (
              balls.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {balls.map((b) => {
                    const low = !b.infinite && b.count < 100;
                    return (
                      <div key={b.id} className={`well flex items-center gap-2 ${low ? "border-red/50" : ""}`}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                          {b.iconUrl ? <Sprite src={b.iconUrl} alt={b.name} size={24} /> : <Pokeball size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-dim">{b.name}</span>
                          <span key={b.count} className={`pixel tick-glow block text-base tabular-nums ${low ? "text-red" : "text-text"}`}>
                            {b.infinite ? "∞" : fmt(b.count)}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState compact message={t("vip.res.noBalls")} />
              )
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="well flex items-center gap-2">
                    <span className="slot-empty flex h-7 w-7 shrink-0 items-center justify-center"><Pokeball size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="slot-empty block truncate text-sm">—</span>
                      <span className="slot-empty pixel block text-base tabular-nums">—</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex lg:col-span-4">
          <Panel
            icon={<Xp size={18} />} accent="var(--cyan)" title={t("vip.res.progress")}
            right={<span className={`pixel text-base ${prof ? "text-yellow" : "slot-empty"}`}>{prof ? `Lv${prof.level}` : "Lv —"}</span>}
            className="min-h-[9rem] w-full"
          >
            <ProgressBar
              pct={prof ? xpPct : 0}
              color="var(--cyan)"
              leftLabel={prof ? `${fmt(prof.xpInLevel)} XP` : "— XP"}
              rightLabel={prof ? `${fmt(prof.xpForNext)} XP` : "— XP"}
            />
            {/* grade fechada de 8 tiles: dado ausente vira placeholder no mesmo slot */}
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2">
              <StatTile live={!!prof} label={t("vip.res.gold")} value={prof ? fmt(prof.gold) : undefined} accent="var(--green)" icon={<Coin size={14} />} />
              <StatTile label={t("vip.res.diamonds")} value={prof ? fmt(prof.diamonds) : undefined} accent="var(--cyan)" icon={<span className="text-cyan"><Diamond size={14} /></span>} />
              <StatTile label={t("vip.ov.streak")} value={streak ? fmt(streak.totalKills) : undefined} icon={<Skull size={14} className="text-yellow" />} />
              <StatTile label={t("vip.ov.bonusXp")} value={streak ? `+${streak.bonusExp}%` : undefined} accent="var(--cyan)" icon={<Xp size={14} className="text-cyan" />} />
              <StatTile label={t("vip.ov.bonusLoot")} value={streak ? `+${streak.bonusLoot}%` : undefined} accent="var(--green)" icon={<Coin size={14} />} />
              <StatTile label={t("vip.ov.bonusShiny")} value={streak ? `+${streak.bonusShiny}%` : undefined} accent="var(--yellow)" icon={<Star size={14} className="text-yellow" />} />
              <StatTile label={t("vip.ov.tCaptures")} value={totals ? fmt(totals.captures) : undefined} icon={<Pokeball size={14} />} />
              <StatTile label={t("vip.ov.tAcervo")} value={totals ? fmt(totals.acervo?.total ?? 0) : undefined} accent="var(--blue)" icon={<Backpack size={14} className="text-blue" />} />
            </div>
          </Panel>
        </div>
      </div>

      {/* ===== feeds: kills ao vivo + eventos recentes — corpo com ALTURA FIXA e
             scroll interno; item novo chegando nunca estica o painel ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={<>{t("vip.ov.liveFeed")}</>} live={hunting}>
          <div className="h-[21rem] overflow-y-auto pr-1">
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
                          {k.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={14} /></span>}
                          {isCatch && <span className="absolute -bottom-1 -left-1"><Pokeball size={14} /></span>}
                        </>
                      }
                      title={k.species}
                      right={
                        <>
                          {isCatch ? (
                            <span className="text-sm text-green">{t("robo.hunt.caught")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm text-cyan"><Xp size={14} />{fmt(k.xp)}</span>
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
              <EmptyState className="h-full" message={t("vip.ov.noKills")} />
            )}
          </div>
        </Panel>

        <Panel
          title={<>{t("vip.ov.events")}</>}
          right={<button type="button" onClick={() => onGo("alertas")} className="icon-btn" aria-label={t("vip.ov.allEvents")}><ChevronRight size={16} /></button>}
        >
          <div className="h-[21rem] overflow-y-auto pr-1">
            {events?.events?.length ? (
              <div className="flex flex-col gap-1.5">
                {events.events.slice(0, 6).map((ev) => (
                  <FeedRow
                    key={ev.id}
                    leading={<span className="flex h-6 w-6 items-center justify-center rounded bg-surface-2">{EVENT_ICON[ev.kind] ?? <Chart size={14} className="text-text-dim" />}</span>}
                    title={ev.title}
                    sub={ev.body ?? undefined}
                    right={<span className="text-xs text-text-dim">{ago(ev.createdAt)}</span>}
                  />
                ))}
              </div>
            ) : (
              <EmptyState className="h-full" message={t("vip.ov.noEvents")} />
            )}
          </div>
        </Panel>
      </div>

      {/* ===== acumulado de sempre (expansivel — streak ja mora no Progresso).
             Sempre renderizado: sem totals ainda, os tiles ficam em placeholder ===== */}
      <Panel
        collapsible
        icon={<Chart size={18} />} accent="var(--purple)" title={t("vip.ov.totals")}
        right={<button type="button" onClick={(e) => { e.stopPropagation(); onGo("estatisticas"); }} className="icon-btn" aria-label={t("vip.sec.estatisticas")}><ChevronRight size={16} /></button>}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <StatTile label={t("vip.ov.tHunts")} value={totals ? fmt(totals.hunts) : undefined} icon={<Target size={14} className="text-cyan" />} hover />
          <StatTile label={t("vip.ov.tKills")} value={totals ? fmt(totals.kills) : undefined} icon={<Skull size={14} className="text-text-dim" />} hover />
          <StatTile label={t("vip.ov.tXp")} value={totals ? fmt(totals.xpGained) : undefined} accent="var(--cyan)" icon={<Xp size={14} className="text-cyan" />} hover />
          {/* so dolar RECEBIDO (vendas) — o valor do loot coletado vira venda depois, somar duplicaria */}
          <StatTile label={t("vip.ov.tGold")} value={totals ? fmt(totals.itemsGold + totals.pokesGold) : undefined} accent="var(--green)" icon={<Coin size={14} />} hover />
          <StatTile label={t("vip.ov.tCaptures")} value={totals ? fmt(totals.captures) : undefined} icon={<Pokeball size={14} />} hover />
          <StatTile label={t("vip.ov.tAcervo")} value={totals ? fmt(totals.acervo?.total ?? 0) : undefined} accent="var(--blue)" icon={<Backpack size={14} className="text-blue" />} hover />
        </div>
      </Panel>
    </div>
  );
}
