"use client";

// Centro de comando da HUNT (secao do Robo). Tres modos:
//   MANUAL — voce escolhe a hunt (seletor por area) e os drops pra vender.
//   AUTO   — o cerebro escolhe a melhor hunt pro seu lider e re-escolhe a cada level-up.
//   UPAR   — plano de leveling: escolha um pokemon do time e o nivel alvo; o robo calcula a
//            sequencia otima de hunts (preview) e segue sozinho ate bater a meta.
// O estado vem TODO do VipLiveProvider (SSE) — sem polling proprio. Os POSTs devolvem o
// HuntState novo e aplicam na hora via applyHunt (o stream confirma em seguida).
// Single-session: ligar desconecta o jogo no browser.

import { useMemo, useState } from "react";
import { useT } from "./locale-provider";
import { useVipLive, type LiveHunt, type LivePlanStep, type LiveTeamPoke } from "./vip-live";
import { Coin, Star, Xp, Skull, Clock, Check, ChevronRight, Brain, Flag, Target, Plus, Close } from "./icons";
import { Modal } from "./modal";
import { CloseButton } from "./icon-button";
import { Sprite } from "./sprite";
import { Pokeball } from "./pokeball";
import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { Led } from "./ui/status";
import { useToast } from "./toast";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";
import { RISK_COLOR, type RiskLevel } from "@/lib/combat";

// Uma hunt do catalogo do jogo: o `slug` e exatamente o que o enter-hunt come; o resto
// e detalhe pro seletor (nivel, area, sprite do pokemon daquele ponto).
export interface HuntOption { slug: string; name: string; level: number; area: string; pokeId: number | null }
// Um drop vendavel daquela hunt (pro modal de venda automatica ao ligar).
export interface DropOption { itemId: number; name: string; icon: string; npcPrice: number }

const MAX_PLANS = 3; // espelha MAX_GOALS do servidor (robot-session-store)
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
// numeros grandes (xp/h, ouro/h) em notacao compacta: o slot nao estica quando o valor cresce
const compactFmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtC = (n: number) => (Math.abs(n) >= 100_000 ? compactFmt.format(Math.round(n)) : fmt(n));
const hm = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const STATUS_COLOR: Record<string, string> = { idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)", kicked: "var(--yellow)", error: "var(--pink)" };

// A venda de pokemon e configurada SO em Configuracoes (robot_sessions.poke_sell_cfg);
// o servidor aplica a config salva em todo inicio de hunt sozinho — esta tela nao tem
// mais interruptor proprio (o checkbox daqui duplicava o das Configuracoes).

export function HuntAnalyzer({ hunts, creatures, itemIcons, lootByPoke }: { hunts: HuntOption[]; creatures: { pokeId: number; name: string }[]; itemIcons: Record<string, string>; lootByPoke: Record<number, DropOption[]> }) {
  const t = useT();
  const toast = useToast();
  const { hunt: st, account, applyHunt } = useVipLive();

  const [detail, setDetail] = useState<LiveHunt["recentKills"][number] | null>(null);
  const [dropsOpen, setDropsOpen] = useState(false); // modal de opcoes do modo manual
  const [sellDropIds, setSellDropIds] = useState<Set<number>>(new Set());
  const [bestPoke, setBestPoke] = useState<{ pokeId: string; speciesId: number; name: string; level: number; power: number; eff: number; risk: RiskLevel; killsPerLife: number } | null>(null);
  const [summonState, setSummonState] = useState<"idle" | "busy" | "done" | "fail">("idle");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  // leveling: modal de plano
  const [planOpen, setPlanOpen] = useState(false);
  const [planPoke, setPlanPoke] = useState<LiveTeamPoke | null>(null);
  const [planTarget, setPlanTarget] = useState("");
  const [planSteps, setPlanSteps] = useState<LivePlanStep[] | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planErr, setPlanErr] = useState<string | null>(null);
  // FILA de planos: o que voce ja empilhou. O plano em edicao (planPoke/planTarget) conta
  // como o ULTIMO da fila na hora de iniciar — o que esta na tela e o que vai.
  const [planQueue, setPlanQueue] = useState<{ poke: LiveTeamPoke; target: number; steps: number }[]>([]);

  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);
  const itemIcon = (name: string) => itemIcons[name.toLowerCase()] ?? null;
  const pokeIdOf = (species: string) => pokeByName.get(species.toLowerCase());

  const selected = hunts.find((h) => h.slug === slug) ?? null;
  // time pro plano de leveling: o AO VIVO da sessao segurada; senao o snapshot do banco
  const team = (st?.wsOpen && st.team?.length ? st.team : null)
    ?? account?.team?.list?.filter((p) => p.team) ?? [];

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filt = needle ? hunts.filter((h) => h.name.toLowerCase().includes(needle) || h.slug.includes(needle)) : hunts;
    const byArea = new Map<string, HuntOption[]>();
    for (const h of filt) { const a = byArea.get(h.area) ?? []; a.push(h); byArea.set(h.area, a); }
    return [...byArea.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([area, list]) => [area, [...list].sort((x, y) => x.level - y.level)] as const);
  }, [hunts, q]);

  const send = async (body: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => null)) as LiveHunt | null;
      if (j && "status" in j) applyHunt(j);
      if (res.ok && okMsg) toast.success(okMsg);
      else if (!res.ok) toast.error(t("toast.err"));
      return res.ok;
    } finally { setBusy(false); }
  };

  const status = st?.status ?? "idle";
  // conexao-primeiro: hunt LIGADA = tem slug. A conexao pode estar viva SEM hunt (holdOpen).
  const huntOn = !!st?.slug;
  const connected = !!st?.wsOpen;
  const huntStatus = huntOn ? status : "idle";
  const running = huntOn && (status === "running" || status === "connecting");
  const a = st?.analyzer ?? null;
  const mode = st?.mode ?? "manual";
  const lv = st?.leveling ?? null;
  const plan = st?.plan ?? null;
  const queue = st?.queue ?? [];

  // a config de venda NAO viaja mais no start: o servidor aplica a config SALVA (banco)
  // em todo inicio de hunt, venha de onde vier.
  const startHunt = (ids: number[]) => {
    if (!slug.trim()) return;
    void send({ action: "start", slug: slug.trim(), sellItemIds: ids }, t("toast.huntOn"));
  };
  const startAuto = () => void send({ action: "auto" }, t("toast.autoOn"));

  const huntDrops = (selected?.pokeId != null ? lootByPoke[selected.pokeId] : undefined) ?? [];
  const openStart = () => {
    setSellDropIds(new Set()); setBestPoke(null); setSummonState("idle"); setDropsOpen(true);
    if (selected?.pokeId != null) {
      fetch(`/api/vip/best-poke?pokeId=${selected.pokeId}`, { cache: "no-store" })
        .then((r) => r.json()).then((j) => setBestPoke(j?.best ?? null)).catch(() => {});
    }
  };

  const summon = async (pokeId: string) => {
    setSummonState("busy");
    try {
      const r = await fetch("/api/vip/summon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pokeId }) });
      setSummonState(r.ok ? "done" : "fail");
    } catch { setSummonState("fail"); }
  };

  // preview do plano de leveling (GET /api/vip/plan) — mostra a rota antes de confirmar
  const previewPlan = async () => {
    if (!planPoke) return;
    const target = Number(planTarget);
    if (!Number.isFinite(target) || target <= planPoke.level) { setPlanErr(t("robo.lv.badTarget")); return; }
    setPlanBusy(true); setPlanErr(null); setPlanSteps(null);
    try {
      const r = await fetch(`/api/vip/plan?pokeId=${encodeURIComponent(planPoke.id)}&target=${Math.floor(target)}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { steps?: LivePlanStep[]; error?: string } | null;
      if (r.ok && j?.steps?.length) setPlanSteps(j.steps);
      else setPlanErr(t("robo.lv.noRoute"));
    } catch { setPlanErr(t("robo.lv.noRoute")); } finally { setPlanBusy(false); }
  };

  // metas que serao enviadas: a fila + o plano em edicao (se ja tem rota calculada)
  const planGoals = () => {
    const list = planQueue.map((g) => ({ pokeId: g.poke.id, targetLevel: g.target }));
    if (planPoke && planSteps) list.push({ pokeId: planPoke.id, targetLevel: Math.floor(Number(planTarget)) });
    return list;
  };

  // empilha o plano em edicao e limpa o formulario pro proximo
  const queuePlan = () => {
    if (!planPoke || !planSteps || planQueue.length >= MAX_PLANS - 1) return;
    setPlanQueue([...planQueue, { poke: planPoke, target: Math.floor(Number(planTarget)), steps: planSteps.length }]);
    setPlanPoke(null); setPlanTarget(""); setPlanSteps(null); setPlanErr(null);
  };

  const startLeveling = async () => {
    const goals = planGoals();
    if (!goals.length) return;
    const ok = await send({ action: "leveling", goals }, t("toast.planOn"));
    if (ok) { setPlanOpen(false); setPlanSteps(null); setPlanPoke(null); setPlanTarget(""); setPlanQueue([]); }
  };

  const openPlanModal = () => {
    setPlanPoke(team.find((p) => p.leader) ?? team[0] ?? null);
    setPlanTarget(""); setPlanSteps(null); setPlanErr(null); setPlanQueue([]); setPlanOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2"><Star size={18} /> {t("robo.hunt.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.hunt.desc")}</p>
      </div>

      {/* linha de estado da conexao: SEMPRE renderizada na area de configuracao com
          altura fixa — conectado acende o verde, desligado mostra o placeholder no
          mesmo lugar (nada empurra os paineis quando a conexao chega/cai) */}
      {!huntOn && (
        <div className={`well flex min-h-11 items-center gap-2.5 px-3.5 ${connected ? "border-[color:var(--green)]/40 bg-[color:var(--green)]/5" : ""}`}>
          <Led color={connected ? "var(--green)" : "var(--text-dim)"} pulse={connected} />
          <span className={`text-base ${connected ? "text-green" : "slot-empty"}`}>{connected ? t("vip.conn.readyHint") : t("vip.conn.off")}</span>
        </div>
      )}

      {/* controle: desligado = 3 modos; ligado = hero da hunt viva (alternancia por
          estado macro do usuario — dentro de cada area nada muda de estrutura) */}
      {!huntOn ? (
        <div className="grid gap-3 md:grid-cols-3">
          {/* AUTO — o destaque: um botao e o robo se vira */}
          <Panel icon={<Brain size={18} />} accent="var(--cyan)" title={t("robo.mode.auto")} className="card-link">
            <p className="flex-1 text-base leading-relaxed text-text-dim">{t("robo.mode.autoDesc")}</p>
            <button type="button" onClick={startAuto} disabled={busy} className="btn btn-cyan self-start disabled:opacity-40">
              {t("robo.mode.autoStart")} <ChevronRight size={14} />
            </button>
          </Panel>

          {/* UPAR — plano de leveling */}
          <Panel icon={<Flag size={18} />} accent="var(--purple)" title={t("robo.mode.leveling")} className="card-link">
            <p className="flex-1 text-base leading-relaxed text-text-dim">{t("robo.mode.levelingDesc")}</p>
            <button type="button" onClick={openPlanModal} disabled={busy || team.length === 0} className="btn btn-purple self-start disabled:opacity-40" title={team.length === 0 ? t("robo.lv.needTeam") : undefined}>
              {t("robo.mode.levelingStart")} <ChevronRight size={14} />
            </button>
          </Panel>

          {/* MANUAL — voce escolhe */}
          <Panel icon={<Target size={18} />} title={t("robo.mode.manual")} className="card-link">
            <div className="flex flex-1 items-start">
              <button type="button" onClick={() => setPickerOpen(true)} className="btn btn-ghost inline-flex max-w-full items-center gap-2">
                {selected ? (
                  <>
                    {selected.pokeId != null && <Sprite src={spriteUrl(selected.pokeId)} alt={selected.name} size={18} />}
                    <span className="max-w-[11rem] truncate">{selected.name}</span>
                    <span className="shrink-0 text-text-dim">Lv{selected.level}</span>
                  </>
                ) : (
                  t("robo.hunt.pick")
                )}
              </button>
            </div>
            <button type="button" onClick={openStart} disabled={busy || !slug.trim()} className="btn btn-ghost self-start disabled:opacity-40">
              {t("robo.hunt.start")} <ChevronRight size={14} />
            </button>
          </Panel>

        </div>
      ) : (() => {
        // HERO da hunt viva: estrutura FIXA de slots — sprite (pokeball esmaecida sem
        // alvo), nome + modo em linha de altura fixa, status + rendimento em trilho
        // rolavel com placeholders ("—/h" ate o analyzer chegar). Nada pula ao vivo.
        const cur = hunts.find((h) => h.slug === st?.slug) ?? null;
        return (
          <section
            className={`card flex min-h-[7rem] items-center gap-3 p-4 sm:gap-4 ${running ? "glow-pulse" : ""}`}
            style={{ "--accent": STATUS_COLOR[huntStatus] } as React.CSSProperties}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
              {cur?.pokeId != null ? (
                <Sprite src={spriteUrl(cur.pokeId)} alt={cur.name} size={40} />
              ) : (
                <span className="slot-empty"><Pokeball size={24} /></span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex h-8 min-w-0 items-center gap-2">
                <span className="pixel min-w-0 truncate text-base text-cyan">{cur?.name ?? st?.slug}</span>
                <span className="chip shrink-0" style={{ background: mode === "manual" ? "var(--surface-2)" : mode === "auto" ? "var(--cyan)" : "var(--purple)", color: mode === "manual" ? "var(--text-dim)" : mode === "auto" ? "#06131a" : "#140a26" }}>
                  {mode === "auto" && <Brain size={14} />}
                  {mode === "leveling" && <Flag size={14} />}
                  {t(`vip.hud.mode.${mode}`)}
                </span>
              </div>
              {/* linha de altura fixa; se apertar, rola na horizontal (nunca quebra).
                  Os slots de xp/ouro por hora cabem o pior caso ("999,9k/h") com o
                  icone de 14 — a Chakra e mais larga que a fonte antiga. */}
              <div className="mt-1 flex h-7 items-center gap-x-3 overflow-x-auto text-sm text-text-dim [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <Led color={STATUS_COLOR[huntStatus]} pulse={running} />
                  {st?.reconnecting ? t("vip.ov.reconnecting") : t(`robo.hunt.status.${huntStatus}`)}
                </span>
                <span className={`shrink-0 ${cur ? "" : "slot-empty"}`}>{cur ? `Lv${cur.level} · ${cur.area}` : "—"}</span>
                <span className={`inline-flex min-w-[5.5rem] shrink-0 items-center gap-1 tabular-nums ${a ? "text-cyan" : "slot-empty"}`} title={a ? `${fmt(a.xpPerHour)} XP/h` : undefined}><Xp size={14} />{a ? `${fmtC(a.xpPerHour)}/h` : "—/h"}</span>
                <span className={`inline-flex min-w-[5.5rem] shrink-0 items-center gap-1 tabular-nums ${a ? "text-green" : "slot-empty"}`} title={a ? `${fmt(a.goldPerHour)} ouro/h` : undefined}><Coin size={14} />{a ? `${fmtC(a.goldPerHour)}/h` : "—/h"}</span>
              </div>
            </div>
            {/* parar a hunt NAO derruba a conexao (o robo segue segurando a sessao) */}
            <button type="button" onClick={() => void send({ action: "stop" }, t("toast.huntOff"))} disabled={busy} className="btn btn-ghost shrink-0 disabled:opacity-40">{t("vip.conn.stopHunt")}</button>
          </section>
        );
      })()}

      {/* plano de leveling em andamento: o card existe enquanto o MODO for leveling
          (escolha do usuario); a rota que ainda nao chegou vira skeleton com as
          mesmas dimensoes das linhas — o card nao muda de tamanho quando o plano cai */}
      {huntOn && mode === "leveling" && (
        <div className="card p-4">
          <div className="mb-2.5 flex h-8 min-w-0 items-center gap-2">
            <Flag size={18} className="shrink-0" />
            <h3 className="section-title min-w-0 truncate">{lv ? t("robo.lv.planTitle", { name: lv.name }) : t("robo.lv.title")}</h3>
            <span className={`pixel shrink-0 text-sm ${lv ? "text-text" : "slot-empty"}`}>
              {lv ? <>{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></> : "—/—"}
            </span>
            <span className="ms-auto" />
            <span className={`chip shrink-0 ${lv?.done ? "" : "invisible"}`} style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span>
          </div>
          <div className="hud-track mb-3">
            <span className="hud-fill block bg-purple" style={{ width: `${lv ? Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100)) : 0}%` }} />
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
            {lv && plan && plan.length > 0 ? (
              plan.map((s, i) => {
                const active = !lv.done && lv.currentLevel >= s.from && lv.currentLevel <= s.to;
                const past = lv.currentLevel > s.to;
                return (
                  <div key={i} className={`well flex min-w-0 items-center gap-2.5 p-2 text-base transition ${active ? "border-[color:var(--purple)] bg-[color:var(--purple)]/10 glow-pulse" : ""} ${past ? "opacity-45" : ""}`}
                    style={active ? ({ "--accent": "var(--purple)" } as React.CSSProperties) : undefined}>
                    <span className={`pixel w-20 shrink-0 text-sm tabular-nums ${active ? "text-purple" : "text-text-dim"}`}>{s.from}-{s.to}</span>
                    <span className="min-w-0 flex-1 truncate">{s.huntName} <span className="font-normal text-text-dim">· {s.area}</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-cyan"><Xp size={16} />{fmt(s.xpH)}/h</span>
                    {past && <Check size={16} className="shrink-0 text-green" />}
                  </div>
                );
              })
            ) : (
              <>
                <div className="skeleton h-10" />
                <div className="skeleton h-10" />
                <div className="skeleton h-10" />
              </>
            )}
          </div>

          {/* FILA: o que comeca sozinho quando esta meta fechar. Sem fila nao existe
              secao — o normal e upar um bicho so, e um bloco vazio nao diz nada. */}
          {queue.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="field-label mb-1">{t("robo.lv.nextUp", { n: queue.length })}</div>
              <div className="flex flex-col gap-1">
                {queue.map((g, i) => (
                  <div key={g.pokeId} className="well flex min-w-0 items-center gap-2.5 p-2 text-base opacity-70">
                    <span className="pixel w-6 shrink-0 text-sm text-purple">{i + 1}</span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      <Sprite src={spriteUrl(g.speciesId)} alt={g.name} size={24} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className="shrink-0 tabular-nums text-purple">Lv{g.targetLevel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* modal de escolha da hunt — busca + agrupado por area, com sprite e nivel */}
      {pickerOpen && (
        <Modal onClose={() => setPickerOpen(false)} className="w-full max-w-lg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">{t("robo.hunt.pickTitle")}</h3>
              <CloseButton onClick={() => setPickerOpen(false)} />
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("robo.hunt.searchPh")} className="input mb-3" autoFocus />
            <div className="flex-1 overflow-auto pr-1">
              {grouped.length === 0 ? (
                <p className="py-6 text-center text-base text-text-dim">{t("robo.hunt.noHunts")}</p>
              ) : (
                grouped.map(([area, list]) => (
                  <div key={area} className="mb-3">
                    <div className="field-label mb-1">{area}</div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {list.map((h) => (
                        <button
                          key={h.slug}
                          type="button"
                          onClick={() => { setSlug(h.slug); setPickerOpen(false); setQ(""); }}
                          className={`flex items-center gap-2 rounded border p-1.5 text-left transition ${h.slug === slug ? "border-cyan bg-[color:var(--cyan)]/10" : "border-border hover:bg-surface-2"}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                            {h.pokeId != null && <Sprite src={spriteUrl(h.pokeId)} alt={h.name} size={24} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-base">{h.name}</span>
                          <span className="shrink-0 text-sm tabular-nums text-text-dim">Lv{h.level}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
        </Modal>
      )}

      {/* modal do plano de leveling: pokemon + nivel alvo -> preview da rota -> confirmar */}
      {planOpen && (
        <Modal onClose={() => setPlanOpen(false)} className="w-full max-w-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2"><Flag size={18} /> {t("robo.lv.title")}</h3>
            <CloseButton onClick={() => setPlanOpen(false)} />
          </div>
          <p className="mb-3 text-sm leading-relaxed text-text-dim">{t("robo.lv.desc")}</p>

          {/* pokemon do time */}
          <div className="field-label mb-1">{t("robo.lv.pickPoke")}</div>
          <div className="mb-3 grid gap-1 sm:grid-cols-2">
            {team.map((p) => {
              const on = planPoke?.id === p.id;
              // ja empilhado: um plano por pokemon (dois planos do mesmo bicho brigariam)
              const queued = planQueue.some((g) => g.poke.id === p.id);
              return (
                <button key={p.id} type="button" disabled={queued}
                  onClick={() => { setPlanPoke(p); setPlanSteps(null); setPlanErr(null); }}
                  className={`flex items-center gap-2 rounded border p-1.5 text-left transition disabled:opacity-35 ${on ? "border-[color:var(--purple)] bg-[color:var(--purple)]/10" : "border-border hover:bg-surface-2"}`}>
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={28} />
                    {p.shiny && <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={14} /></span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base">{p.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-text-dim">{queued ? t("robo.lv.queued") : `Lv${p.level}`}</span>
                </button>
              );
            })}
          </div>

          {/* nivel alvo */}
          <div className="mb-3 flex items-end gap-2">
            <div className="flex-1">
              <div className="field-label mb-1">{t("robo.lv.target")}</div>
              <input value={planTarget} onChange={(e) => { setPlanTarget(e.target.value.replace(/\D/g, "")); setPlanSteps(null); }} placeholder={planPoke ? String(Math.min(400, planPoke.level + 50)) : "200"} inputMode="numeric" className="input" />
            </div>
            <button type="button" onClick={() => void previewPlan()} disabled={planBusy || !planPoke || !planTarget} className="btn btn-purple disabled:opacity-40">
              {planBusy ? "…" : t("robo.lv.calc")}
            </button>
          </div>
          {/* linha de erro com altura reservada: aparecer/sumir nao mexe no modal */}
          <p className="mb-2 min-h-6 text-sm text-red">{planErr}</p>

          {/* preview da rota: area de altura FIXA — vazio (placeholder), calculando
              (skeleton) e rota pronta ocupam o mesmo espaco */}
          <div className="field-label mb-1">{t("robo.lv.route", { n: planSteps?.length ?? 0 })}</div>
          <div className="mb-3 flex h-40 flex-col gap-1 overflow-y-auto rounded border border-border/60 p-1.5 pr-1">
            {planBusy ? (
              <>
                <div className="skeleton h-10 shrink-0" />
                <div className="skeleton h-10 shrink-0" />
                <div className="skeleton h-10 shrink-0" />
              </>
            ) : planSteps ? (
              planSteps.map((s, i) => (
                <div key={i} className="well flex min-w-0 shrink-0 items-center gap-2.5 p-2 text-base">
                  <span className="pixel w-20 shrink-0 text-sm tabular-nums text-purple">{s.from}-{s.to}</span>
                  <span className="min-w-0 flex-1 truncate">{s.huntName} <span className="font-normal text-text-dim">· {s.area}</span></span>
                  {/* LED do risco: a faixa diz quanto rende E quanto ela te machuca */}
                  <Led color={RISK_COLOR[s.risk]} className="shrink-0" />
                  <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-cyan" title={t("robo.lv.surv", { n: s.killsPerLife })}><Xp size={16} />{fmt(s.xpH)}/h</span>
                </div>
              ))
            ) : (
              <p className="slot-empty flex h-full items-center justify-center text-base">—</p>
            )}
          </div>
          {/* FILA: os planos ja empilhados, na ordem em que vao rodar. So aparece quando
              tem algo — fila vazia e o caso normal de quem quer upar um bicho so. */}
          {planQueue.length > 0 && (
            <div className="mb-3">
              <div className="field-label mb-1">{t("robo.lv.queue", { n: planQueue.length + 1, max: MAX_PLANS })}</div>
              <div className="flex flex-col gap-1">
                {planQueue.map((g, i) => (
                  <div key={g.poke.id} className="well flex min-w-0 items-center gap-2.5 p-2 text-base">
                    <span className="pixel w-6 shrink-0 text-sm text-purple">{i + 1}</span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                      <Sprite src={spriteUrl(g.poke.speciesId, g.poke.shiny)} alt={g.poke.name} size={24} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.poke.name} <span className="text-text-dim">Lv{g.poke.level}</span> <ChevronRight size={14} className="inline" /> <span className="text-purple">Lv{g.target}</span></span>
                    <span className="shrink-0 text-sm text-text-dim">{t("robo.lv.route", { n: g.steps })}</span>
                    <button type="button" onClick={() => setPlanQueue(planQueue.filter((x) => x.poke.id !== g.poke.id))}
                      title={t("vip.team.cancel")} className="icon-btn shrink-0"><Close size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className={`min-w-0 truncate text-sm ${planSteps ? "text-text-dim" : "slot-empty"}`}>
              {planPoke ? <>{planPoke.name} · Lv{planPoke.level} <ChevronRight size={14} className="inline" /> <span className={planTarget ? "text-purple" : "slot-empty"}>Lv{planTarget || "—"}</span></> : "—"}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {/* empilhar so faz sentido com rota calculada e espaco na fila */}
              <button type="button" onClick={queuePlan} disabled={!planSteps || planQueue.length >= MAX_PLANS - 1}
                className="btn btn-ghost disabled:opacity-40" title={t("robo.lv.queueHint")}>
                <Plus size={14} /> {t("robo.lv.queueAdd")}
              </button>
              <button type="button" onClick={() => void startLeveling()} disabled={busy || planGoals().length === 0} className="btn btn-purple disabled:opacity-40">
                {t("robo.lv.start")} <ChevronRight size={14} />
              </button>
            </span>
          </div>
        </Modal>
      )}

      {/* modal de opcoes do modo manual: drops pra vender (+ sugestao de melhor pokemon) */}
      {dropsOpen && selected && (() => {
        const toggle = (id: number) => setSellDropIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        return (
          <Modal onClose={() => setDropsOpen(false)} className="w-full max-w-md p-4">
              <h3 className="section-title">{t("robo.hunt.dropsTitle")}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-dim">{t("robo.hunt.dropsDesc").replace("{hunt}", selected.name)}</p>

              {/* sugestao de melhor pokemon: box SEMPRE renderizado — enquanto o fetch
                  nao volta (ou nao ha sugestao) os slots ficam esmaecidos no mesmo lugar */}
              <div className="well mt-3 flex min-h-20 items-center gap-2.5 border-[color:var(--cyan)]/40 p-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {bestPoke ? (
                    <Sprite src={spriteUrl(bestPoke.speciesId)} alt={bestPoke.name} size={30} />
                  ) : (
                    <span className="slot-empty"><Pokeball size={22} /></span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base text-text">{t("robo.hunt.bestPoke")}: <span className={bestPoke ? "text-cyan" : "slot-empty"}>{bestPoke?.name ?? "—"}</span> <span className={bestPoke ? "text-text-dim" : "slot-empty"}>{bestPoke ? `Lv${bestPoke.level}` : "Lv —"}</span></div>
                  <div className={`text-sm leading-relaxed ${bestPoke ? "text-text-dim" : "slot-empty"}`}>{bestPoke ? (<>{t("robo.hunt.bestPokeHint", { x: bestPoke.eff })} <span style={{ color: RISK_COLOR[bestPoke.risk] }}>{t("robo.hunt.bestPokeSurv", { n: bestPoke.killsPerLife })}</span></>) : "—"}</div>
                </div>
                {summonState === "done" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-green"><Check size={14} /> {t("robo.hunt.useThisDone")}</span>
                ) : (
                  <button type="button" onClick={() => bestPoke && summon(bestPoke.pokeId)} disabled={summonState === "busy" || !bestPoke} className="btn btn-cyan shrink-0 disabled:opacity-40">
                    {summonState === "busy" ? "…" : summonState === "fail" ? t("robo.hunt.useThisRetry") : t("robo.hunt.useThis")}
                  </button>
                )}
              </div>

              {huntDrops.length > 0 ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setSellDropIds(new Set(huntDrops.map((d) => d.itemId)))} className="btn btn-ghost">{t("robo.hunt.dropsAll")}</button>
                    <button type="button" onClick={() => setSellDropIds(new Set())} className="btn btn-ghost">{t("robo.hunt.dropsNone")}</button>
                  </div>
                  <div className="mt-3 flex flex-1 flex-col gap-1 overflow-auto pr-1">
                    {huntDrops.map((d) => {
                      const on = sellDropIds.has(d.itemId);
                      return (
                        <button
                          key={d.itemId}
                          type="button"
                          onClick={() => toggle(d.itemId)}
                          className={`flex items-center gap-2 rounded border p-1.5 text-left transition ${on ? "border-cyan bg-[color:var(--cyan)]/10" : "border-border hover:bg-surface-2"}`}
                        >
                          {/* caixa do check cresceu junto com o icone (14): marca de
                              linha some quando o quadrado e menor que o traco */}
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? "border-cyan bg-cyan text-[#06131a]" : "border-border text-transparent"}`}><Check size={14} /></span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center">{d.icon ? <Sprite src={assetIconUrl(d.icon)} alt={d.name} size={20} /> : null}</span>
                          <span className="min-w-0 flex-1 truncate text-base">{d.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums text-green"><Coin size={14} />{d.npcPrice}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-base text-text-dim">{t("robo.hunt.noDropsHere")}</p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-sm text-text-dim">{t("robo.hunt.dropsSel").replace("{n}", String(sellDropIds.size))}</span>
                <button type="button" onClick={() => { setDropsOpen(false); startHunt([...sellDropIds]); }} className="btn btn-cyan">{t("robo.hunt.start")} <ChevronRight size={14} /></button>
              </div>
          </Modal>
        );
      })()}

      {/* stats ao vivo (piscam no acento quando o numero muda): a grade existe desde
          que a hunt liga — sem analyzer ainda, cada tile mostra "—" no mesmo lugar */}
      {huntOn && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile live label={t("robo.hunt.kills")} value={a ? fmt(a.kills) : "—"} icon={<Skull size={14} className="text-text-dim" />} />
          <StatTile label={t("robo.hunt.time")} value={a ? hm(a.seconds) : "—"} icon={<Clock size={14} className="text-text-dim" />} />
          <StatTile live label={t("robo.hunt.xph")} value={a ? fmt(a.xpPerHour) : "—"} accent="var(--cyan)" icon={<Xp size={14} className="text-cyan" />} />
          <StatTile live label={t("robo.hunt.goldph")} value={a ? fmt(a.goldPerHour) : "—"} accent="var(--green)" icon={<Coin size={14} />} />
          <StatTile live label={t("robo.hunt.loot")} value={a ? fmt(a.lootGold) : "—"} icon={<Coin size={14} />} />
          <StatTile live label={t("robo.hunt.supply")} value={a ? `-${fmt(a.supplyGold)}` : "—"} icon={<Coin size={14} />} />
          <StatTile live label={t("robo.hunt.captures")} value={a ? fmt(a.captures) : "—"} icon={<Pokeball size={14} />} />
          <StatTile live label={t("robo.hunt.balance")} value={a ? fmt(a.balance) : "—"} accent="var(--green)" icon={<Coin size={14} />} />
        </div>
      )}

      {/* fila de captura AO VIVO — corpos aguardando o auto-catch (frame pending da
          sessao). O painel existe desde que a hunt liga; a area tem altura minima e
          maxima fixas (rola por dentro) pra fila crescer/drenar sem mexer na pagina. */}
      {huntOn && (
        <Panel
          icon={<Pokeball size={18} />} accent="var(--green)"
          title={<>{t("robo.hunt.queue")}</>}
          right={<span className={`pixel text-base tabular-nums ${st?.pending ? "text-text" : "slot-empty"}`}>{st?.pending ? st.pending.length : "—"}</span>}
        >
          <div className="max-h-28 min-h-11 overflow-y-auto pr-1">
            {!st?.pending ? (
              <div className="skeleton h-10" />
            ) : st.pending.length === 0 ? (
              <p className="flex h-10 items-center text-base text-text-dim">{t("robo.hunt.queueEmpty")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {st.pending.map((p, i) => (
                  <span
                    key={p.id}
                    className={`well relative flex items-center gap-1.5 px-1.5 py-1 ${i === st.pending.length - 1 ? "flash-in" : ""}`}
                    title={`${p.name} Lv${p.level}`}
                  >
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={24} />
                    <span className="text-sm tabular-nums text-text-dim">Lv{p.level}</span>
                    {p.shiny && <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={14} /></span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* feed ao vivo — kills e capturas com flash de entrada; clique abre o detalhe.
          Painel sempre presente com a hunt ligada: altura FIXA com rolagem interna,
          feed vazio mostra o placeholder no mesmo espaco. */}
      {huntOn && (
        <Panel title={<>{t("robo.hunt.recent")}</>} live>
          <div className="h-72 overflow-y-auto pr-1">
            {!st?.recentKills || st.recentKills.length === 0 ? (
              <p className="slot-empty flex h-full items-center justify-center text-base">—</p>
            ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
            {st.recentKills.slice(0, 10).map((k, i) => {
              const pid = pokeIdOf(k.species);
              const isCatch = k.kind === "catch";
              return (
                <button
                  key={k.at + "-" + i}
                  type="button"
                  onClick={() => setDetail(k)}
                  className={`well flex min-w-0 items-center gap-2.5 p-2 text-left transition hover:border-[color:var(--border-strong)] hover:bg-surface-2 ${i === 0 ? "flash-in" : ""}`}
                  style={i === 0 ? ({ "--accent": isCatch ? "var(--green)" : "var(--cyan)" } as React.CSSProperties) : undefined}
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-2">
                    {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={34} />}
                    {k.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={14} /></span>}
                    {isCatch && <span className="absolute -bottom-1 -left-1"><Pokeball size={16} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base">{k.species}</span>
                      {isCatch ? (
                        <span className="ml-auto shrink-0 text-sm text-green">{t("robo.hunt.caught")}</span>
                      ) : (
                        <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-sm tabular-nums text-cyan"><Xp size={14} />{fmt(k.xp)} XP</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {isCatch && k.ball && <span className="text-sm text-text-dim">{k.ball}</span>}
                      {!isCatch && k.loot.map((l, j) => {
                        const icon = itemIcon(l.name);
                        return (
                          <span key={j} className="inline-flex items-center gap-1 rounded bg-[var(--well-bg)] px-1 py-0.5 text-sm text-text-dim" title={l.name}>
                            {icon ? <Sprite src={assetIconUrl(icon)} alt={l.name} size={14} /> : <span className="max-w-[8rem] truncate">{l.name}</span>}
                            x{l.qty}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
            )}
          </div>
        </Panel>
      )}

      {/* modal de detalhe de um evento (kill ou captura) */}
      {detail && (() => {
        const k = detail;
        const pid = pokeIdOf(k.species);
        const isCatch = k.kind === "catch";
        return (
          <Modal onClose={() => setDetail(null)} className="w-full max-w-sm p-5">
              <div className="flex items-start gap-3">
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                  {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={56} />}
                  {k.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={16} /></span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="pixel text-base text-text">{k.species}</h3>
                    {k.shiny && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-text-dim">
                    {isCatch && <Pokeball size={14} />}
                    {isCatch ? t("robo.hunt.caught") : t("robo.hunt.killed")}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {isCatch ? (
                  <div className="flex items-center gap-2 text-base">
                    <span className="text-text-dim">{t("robo.hunt.withBall")}:</span>
                    <span className="text-text">{k.ball || "—"}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-base">
                      <span className="text-text-dim">XP</span>
                      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-cyan"><Xp size={16} />{fmt(k.xp)}</span>
                    </div>
                    <div className="field-label mt-1">{t("robo.hunt.drops")}</div>
                    {k.loot.length === 0 ? (
                      <span className="text-base text-text-dim">{t("robo.hunt.noDrops")}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {k.loot.map((l, j) => {
                          const icon = itemIcon(l.name);
                          return (
                            <div key={j} className="well flex min-w-0 items-center gap-2 p-1.5 text-base">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center">{icon ? <Sprite src={assetIconUrl(icon)} alt={l.name} size={20} /> : null}</span>
                              <span className="min-w-0 flex-1 truncate">{l.name}</span>
                              <span className="shrink-0 text-text-dim">x{l.qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => setDetail(null)} className="btn btn-ghost">{t("robo.hunt.close")}</button>
              </div>
          </Modal>
        );
      })()}
    </div>
  );
}
