"use client";

// Centro de comando da HUNT (secao do Robo). Tres modos:
//   MANUAL — voce escolhe a hunt (seletor por area) e os drops pra vender.
//   AUTO   — o cerebro escolhe a melhor hunt pro seu lider e re-escolhe a cada level-up.
//   UPAR   — plano de leveling: escolha um pokemon do time e o nivel alvo; o robo calcula a
//            sequencia otima de hunts (preview) e segue sozinho ate bater a meta.
// O estado vem TODO do VipLiveProvider (SSE) — sem polling proprio. Os POSTs devolvem o
// HuntState novo e aplicam na hora via applyHunt (o stream confirma em seguida).
// Single-session: ligar desconecta o jogo no browser.

import { useEffect, useMemo, useState } from "react";
import { useT } from "./locale-provider";
import { useVipLive, type LiveHunt, type LivePlanStep, type LiveTeamPoke } from "./vip-live";
import { Coin, Star, Xp, Skull, Clock, Check, ChevronRight, Brain, Flag, Target } from "./icons";
import { Modal } from "./modal";
import { CloseButton } from "./icon-button";
import { Sprite } from "./sprite";
import { Pokeball } from "./pokeball";
import { StatTile } from "./stat-tile";
import { Panel } from "./ui/panel";
import { Led } from "./ui/status";
import { useToast } from "./toast";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";

// Uma hunt do catalogo do jogo: o `slug` e exatamente o que o enter-hunt come; o resto
// e detalhe pro seletor (nivel, area, sprite do pokemon daquele ponto).
export interface HuntOption { slug: string; name: string; level: number; area: string; pokeId: number | null }
// Um drop vendavel daquela hunt (pro modal de venda automatica ao ligar).
export interface DropOption { itemId: number; name: string; icon: string; npcPrice: number }

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const hm = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const STATUS_COLOR: Record<string, string> = { idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)", kicked: "var(--yellow)", error: "var(--pink)" };

// "Vender pokemon junto" agora vive no SERVIDOR (robot_sessions.poke_sell_cfg, mesmo
// interruptor do card de Configuracoes). O localStorage saiu: a config presa no navegador
// so valia quando a hunt comecava por AQUI — pelo Painel a hunt nascia sem venda e toda
// captura ia pro acervo. O servidor aplica a config salva em todo inicio de hunt sozinho.

export function HuntAnalyzer({ hunts, creatures, itemIcons, lootByPoke }: { hunts: HuntOption[]; creatures: { pokeId: number; name: string }[]; itemIcons: Record<string, string>; lootByPoke: Record<number, DropOption[]> }) {
  const t = useT();
  const toast = useToast();
  const { hunt: st, account, applyHunt } = useVipLive();

  const [detail, setDetail] = useState<LiveHunt["recentKills"][number] | null>(null);
  const [dropsOpen, setDropsOpen] = useState(false); // modal de opcoes do modo manual
  const [sellDropIds, setSellDropIds] = useState<Set<number>>(new Set());
  const [bestPoke, setBestPoke] = useState<{ pokeId: string; speciesId: number; name: string; level: number; power: number; eff: number } | null>(null);
  const [summonState, setSummonState] = useState<"idle" | "busy" | "done" | "fail">("idle");
  // interruptor da venda: estado do SERVIDOR (GET no mount; toggle grava via save e o
  // servidor aplica na sessao viva/na proxima hunt — sem passar config no start)
  const [sellPokesToo, setSellPokesTooState] = useState(false);
  useEffect(() => {
    fetch("/api/vip/autosell", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { on?: boolean } | null) => { if (j && "on" in j) setSellPokesTooState(!!j.on); })
      .catch(() => {});
  }, []);
  const setSellPokesToo = (fn: (v: boolean) => boolean) => setSellPokesTooState((v) => {
    const next = fn(v);
    void fetch("/api/vip/autosell", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", on: next }), // sem config = mantem as travas salvas
    }).catch(() => {});
    return next;
  });
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

  const startLeveling = async () => {
    if (!planPoke || !planSteps) return;
    const ok = await send({ action: "leveling", pokeId: planPoke.id, targetLevel: Math.floor(Number(planTarget)) }, t("toast.planOn"));
    if (ok) { setPlanOpen(false); setPlanSteps(null); setPlanPoke(null); setPlanTarget(""); }
  };

  const openPlanModal = () => {
    setPlanPoke(team.find((p) => p.leader) ?? team[0] ?? null);
    setPlanTarget(""); setPlanSteps(null); setPlanErr(null); setPlanOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Star size={13} /> {t("robo.hunt.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.hunt.desc")}</p>
      </div>

      {/* conexao segurada sem hunt: os modos ligam INSTANTANEO na mesma sessao */}
      {!huntOn && connected && (
        <div className="flex items-center gap-2.5 rounded border border-[color:var(--green)]/40 bg-[color:var(--green)]/5 px-3.5 py-2">
          <Led color="var(--green)" pulse />
          <span className="text-[0.66rem] text-green">{t("vip.conn.readyHint")}</span>
        </div>
      )}

      {/* controle: desligado = 3 modos; ligado = hero da hunt viva */}
      {!huntOn ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* AUTO — o destaque: um botao e o robo se vira */}
          <Panel icon={<Brain size={13} />} accent="var(--cyan)" title={<span className="text-cyan">{t("robo.mode.auto")}</span>} className="card-link">
            <p className="flex-1 text-[0.66rem] leading-relaxed text-text-dim">{t("robo.mode.autoDesc")}</p>
            <button type="button" onClick={startAuto} disabled={busy} className="btn btn-cyan self-start disabled:opacity-40">
              {t("robo.mode.autoStart")} <ChevronRight size={10} />
            </button>
          </Panel>

          {/* UPAR — plano de leveling */}
          <Panel icon={<Flag size={13} />} accent="var(--purple)" title={<span className="text-purple">{t("robo.mode.leveling")}</span>} className="card-link">
            <p className="flex-1 text-[0.66rem] leading-relaxed text-text-dim">{t("robo.mode.levelingDesc")}</p>
            <button type="button" onClick={openPlanModal} disabled={busy || team.length === 0} className="btn btn-purple self-start disabled:opacity-40" title={team.length === 0 ? t("robo.lv.needTeam") : undefined}>
              {t("robo.mode.levelingStart")} <ChevronRight size={10} />
            </button>
          </Panel>

          {/* MANUAL — voce escolhe */}
          <Panel icon={<Target size={13} />} title={t("robo.mode.manual")} className="card-link">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPickerOpen(true)} className="btn btn-ghost inline-flex items-center gap-2">
                {selected ? (
                  <>
                    {selected.pokeId != null && <Sprite src={spriteUrl(selected.pokeId)} alt={selected.name} size={18} />}
                    <span className="max-w-[9rem] truncate">{selected.name}</span>
                    <span className="text-text-dim">Lv{selected.level}</span>
                  </>
                ) : (
                  t("robo.hunt.pick")
                )}
              </button>
            </div>
            <button type="button" onClick={openStart} disabled={busy || !slug.trim()} className="btn btn-ghost self-start disabled:opacity-40">
              {t("robo.hunt.start")} <ChevronRight size={10} />
            </button>
          </Panel>

          {/* vender pokemon junto (vale pros 3 modos) */}
          <button
            type="button"
            onClick={() => setSellPokesToo((v) => !v)}
            className={`flex items-center gap-2 rounded border p-2 text-left transition lg:col-span-3 ${sellPokesToo ? "border-cyan bg-[color:var(--cyan)]/10" : "border-border hover:bg-surface-2"}`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${sellPokesToo ? "border-cyan bg-cyan text-[#06131a]" : "border-border text-transparent"}`}><Check size={10} /></span>
            <span className="min-w-0 flex-1 text-[0.7rem]">{t("robo.hunt.sellPokesToo")}</span>
          </button>
        </div>
      ) : (() => {
        // HERO da hunt viva: sprite do alvo + nome/area + modo + status, parar a direita
        const cur = hunts.find((h) => h.slug === st?.slug) ?? null;
        return (
          <section
            className={`card flex flex-wrap items-center gap-x-4 gap-y-3 p-4 ${running ? "glow-pulse" : ""}`}
            style={{ "--accent": STATUS_COLOR[huntStatus] } as React.CSSProperties}
          >
            {cur?.pokeId != null && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                <Sprite src={spriteUrl(cur.pokeId)} alt={cur.name} size={40} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pixel text-[0.9rem] text-cyan">{cur?.name ?? st?.slug}</span>
                <span className="chip" style={{ background: mode === "manual" ? "var(--surface-2)" : mode === "auto" ? "var(--cyan)" : "var(--purple)", color: mode === "manual" ? "var(--text-dim)" : mode === "auto" ? "#06131a" : "#140a26" }}>
                  {mode === "auto" && <Brain size={9} />}
                  {mode === "leveling" && <Flag size={9} />}
                  {t(`vip.hud.mode.${mode}`)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] text-text-dim">
                <span className="inline-flex items-center gap-1.5">
                  <Led color={STATUS_COLOR[huntStatus]} pulse={running} />
                  {st?.reconnecting ? t("vip.ov.reconnecting") : t(`robo.hunt.status.${huntStatus}`)}
                </span>
                {cur && <span>Lv{cur.level} · {cur.area}</span>}
                {a && (
                  <>
                    <span className="inline-flex items-center gap-1 text-cyan"><Xp size={9} />{fmt(a.xpPerHour)}/h</span>
                    <span className="inline-flex items-center gap-1 text-green"><Coin size={9} />{fmt(a.goldPerHour)}/h</span>
                  </>
                )}
              </div>
            </div>
            <span className="ms-auto" />
            {/* parar a hunt NAO derruba a conexao (o robo segue segurando a sessao) */}
            <button type="button" onClick={() => void send({ action: "stop" }, t("toast.huntOff"))} disabled={busy} className="btn btn-ghost">{t("vip.conn.stopHunt")}</button>
          </section>
        );
      })()}

      {/* plano de leveling em andamento: rota com a faixa atual acesa */}
      {huntOn && lv && plan && plan.length > 0 && (
        <div className="card p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <Flag size={12} className="text-purple" />
            <h3 className="section-title text-purple">{t("robo.lv.planTitle", { name: lv.name })}</h3>
            <span className="pixel text-[0.6rem] text-text">{lv.currentLevel}<span className="text-text-dim"> / {lv.targetLevel}</span></span>
            {lv.done && <span className="chip" style={{ background: "var(--green)", color: "#052012" }}>{t("vip.ov.planDone")}</span>}
          </div>
          <div className="hud-track mb-3">
            <span className="hud-fill block bg-purple" style={{ width: `${Math.min(100, Math.max(0, ((lv.currentLevel - lv.startLevel) / Math.max(1, lv.targetLevel - lv.startLevel)) * 100))}%` }} />
          </div>
          <div className="flex flex-col gap-1">
            {plan.map((s, i) => {
              const active = !lv.done && lv.currentLevel >= s.from && lv.currentLevel <= s.to;
              const past = lv.currentLevel > s.to;
              return (
                <div key={i} className={`flex items-center gap-2.5 rounded border p-2 text-[0.68rem] transition ${active ? "border-[color:var(--purple)] bg-[color:var(--purple)]/10 glow-pulse" : "border-border"} ${past ? "opacity-45" : ""}`}
                  style={active ? ({ "--accent": "var(--purple)" } as React.CSSProperties) : undefined}>
                  <span className={`pixel w-16 shrink-0 text-[0.58rem] ${active ? "text-purple" : "text-text-dim"}`}>{s.from}-{s.to}</span>
                  <span className="min-w-0 flex-1 truncate">{s.huntName} <span className="text-text-dim">· {s.area}</span></span>
                  <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-cyan"><Xp size={9} />{fmt(s.xpH)}/h</span>
                  {past && <Check size={10} className="shrink-0 text-green" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* modal de escolha da hunt — busca + agrupado por area, com sprite e nivel */}
      {pickerOpen && (
        <Modal onClose={() => setPickerOpen(false)} className="w-full max-w-lg p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title text-cyan">{t("robo.hunt.pickTitle")}</h3>
              <CloseButton onClick={() => setPickerOpen(false)} />
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("robo.hunt.searchPh")} className="input mb-3" autoFocus />
            <div className="flex-1 overflow-auto pr-1">
              {grouped.length === 0 ? (
                <p className="py-6 text-center text-[0.72rem] text-text-dim">{t("robo.hunt.noHunts")}</p>
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
                          <span className="min-w-0 flex-1 truncate text-[0.72rem]">{h.name}</span>
                          <span className="shrink-0 text-[0.6rem] text-text-dim">Lv{h.level}</span>
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
            <h3 className="section-title flex items-center gap-2 text-purple"><Flag size={12} /> {t("robo.lv.title")}</h3>
            <CloseButton onClick={() => setPlanOpen(false)} />
          </div>
          <p className="mb-3 text-[0.62rem] leading-relaxed text-text-dim">{t("robo.lv.desc")}</p>

          {/* pokemon do time */}
          <div className="field-label mb-1">{t("robo.lv.pickPoke")}</div>
          <div className="mb-3 grid gap-1 sm:grid-cols-2">
            {team.map((p) => {
              const on = planPoke?.id === p.id;
              return (
                <button key={p.id} type="button" onClick={() => { setPlanPoke(p); setPlanSteps(null); setPlanErr(null); }}
                  className={`flex items-center gap-2 rounded border p-1.5 text-left transition ${on ? "border-[color:var(--purple)] bg-[color:var(--purple)]/10" : "border-border hover:bg-surface-2"}`}>
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={28} />
                    {p.leader && <span className="absolute -right-1 -top-1 text-yellow"><Star size={8} /></span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.72rem]">{p.name}</span>
                  <span className="shrink-0 text-[0.6rem] text-text-dim">Lv{p.level}</span>
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
          {planErr && <p className="mb-2 text-[0.62rem] text-red">{planErr}</p>}

          {/* preview da rota */}
          {planSteps && (
            <>
              <div className="field-label mb-1">{t("robo.lv.route", { n: planSteps.length })}</div>
              <div className="mb-3 flex max-h-56 flex-col gap-1 overflow-auto pr-1">
                {planSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded border border-border p-2 text-[0.68rem]">
                    <span className="pixel w-16 shrink-0 text-[0.58rem] text-purple">{s.from}-{s.to}</span>
                    <span className="min-w-0 flex-1 truncate">{s.huntName} <span className="text-text-dim">· {s.area}</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-cyan"><Xp size={9} />{fmt(s.xpH)}/h</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[0.62rem] text-text-dim">
                  {planPoke?.name} · Lv{planPoke?.level} <ChevronRight size={8} className="inline" /> <span className="text-purple">Lv{planTarget}</span>
                </span>
                <button type="button" onClick={() => void startLeveling()} disabled={busy} className="btn btn-purple disabled:opacity-40">
                  {t("robo.lv.start")} <ChevronRight size={10} />
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* modal de opcoes do modo manual: drops pra vender (+ sugestao de melhor pokemon) */}
      {dropsOpen && selected && (() => {
        const toggle = (id: number) => setSellDropIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        return (
          <Modal onClose={() => setDropsOpen(false)} className="w-full max-w-md p-4">
              <h3 className="section-title text-cyan">{t("robo.hunt.dropsTitle")}</h3>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-text-dim">{t("robo.hunt.dropsDesc").replace("{hunt}", selected.name)}</p>

              {bestPoke && (
                <div className="mt-3 flex items-center gap-2.5 rounded border border-[color:var(--cyan)]/40 bg-[var(--well-bg)] p-2.5">
                  <Sprite src={spriteUrl(bestPoke.speciesId)} alt={bestPoke.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.72rem] text-text">{t("robo.hunt.bestPoke")}: <span className="font-semibold text-cyan">{bestPoke.name}</span> <span className="text-text-dim">Lv{bestPoke.level}</span></div>
                    <div className="text-[0.58rem] leading-relaxed text-text-dim">{t("robo.hunt.bestPokeHint").replace("{x}", String(bestPoke.eff))}</div>
                  </div>
                  {summonState === "done" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.62rem] font-semibold text-green"><Check size={10} /> {t("robo.hunt.useThisDone")}</span>
                  ) : (
                    <button type="button" onClick={() => summon(bestPoke.pokeId)} disabled={summonState === "busy"} className="btn btn-cyan shrink-0 disabled:opacity-40">
                      {summonState === "busy" ? "…" : summonState === "fail" ? t("robo.hunt.useThisRetry") : t("robo.hunt.useThis")}
                    </button>
                  )}
                </div>
              )}

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
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-cyan bg-cyan text-[#06131a]" : "border-border text-transparent"}`}><Check size={10} /></span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center">{d.icon ? <Sprite src={assetIconUrl(d.icon)} alt={d.name} size={20} /> : null}</span>
                          <span className="min-w-0 flex-1 truncate text-[0.72rem]">{d.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[0.62rem] text-green"><Coin size={9} />{d.npcPrice}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[0.72rem] text-text-dim">{t("robo.hunt.noDropsHere")}</p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-[0.62rem] text-text-dim">{t("robo.hunt.dropsSel").replace("{n}", String(sellDropIds.size))}</span>
                <button type="button" onClick={() => { setDropsOpen(false); startHunt([...sellDropIds]); }} className="btn btn-cyan">{t("robo.hunt.start")} <ChevronRight size={10} /></button>
              </div>
          </Modal>
        );
      })()}

      {/* stats ao vivo (piscam no acento quando o numero muda) */}
      {huntOn && a && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile live label={t("robo.hunt.kills")} value={fmt(a.kills)} icon={<Skull size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.hunt.time")} value={hm(a.seconds)} icon={<Clock size={11} className="text-text-dim" />} />
          <StatTile live label={t("robo.hunt.xph")} value={fmt(a.xpPerHour)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
          <StatTile live label={t("robo.hunt.goldph")} value={fmt(a.goldPerHour)} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.loot")} value={fmt(a.lootGold)} icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.supply")} value={`-${fmt(a.supplyGold)}`} icon={<Coin size={11} />} />
          <StatTile live label={t("robo.hunt.captures")} value={fmt(a.captures)} icon={<Pokeball size={11} />} />
          <StatTile live label={t("robo.hunt.balance")} value={fmt(a.balance)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      )}

      {/* fila de captura AO VIVO — corpos aguardando o auto-catch (frame pending da
          sessao). Cresce a cada kill e drena conforme o jogo captura; fila vazia com a
          hunt viva = o auto-catch esta dando conta. */}
      {huntOn && st?.pending && (
        <Panel
          icon={<Pokeball size={12} />} accent="var(--green)"
          title={<span className="text-green">{t("robo.hunt.queue")}</span>}
          right={<span className="pixel text-[0.66rem] text-text">{st.pending.length}</span>}
        >
          {st.pending.length === 0 ? (
            <p className="text-[0.66rem] text-text-dim">{t("robo.hunt.queueEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {st.pending.map((p, i) => (
                <span
                  key={p.id}
                  className={`relative flex items-center gap-1.5 rounded border border-border bg-[var(--well-bg)] px-1.5 py-1 ${i === st.pending.length - 1 ? "flash-in" : ""}`}
                  title={`${p.name} Lv${p.level}`}
                >
                  <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={24} />
                  <span className="text-[0.6rem] text-text-dim">Lv{p.level}</span>
                  {p.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={9} /></span>}
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* feed ao vivo — kills e capturas com flash de entrada; clique abre o detalhe */}
      {huntOn && st?.recentKills && st.recentKills.length > 0 && (
        <Panel title={<span className="text-cyan">{t("robo.hunt.recent")}</span>} live>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {st.recentKills.slice(0, 10).map((k, i) => {
              const pid = pokeIdOf(k.species);
              const isCatch = k.kind === "catch";
              return (
                <button
                  key={k.at + "-" + i}
                  type="button"
                  onClick={() => setDetail(k)}
                  className={`flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2 text-left transition hover:border-[color:var(--border-strong)] hover:bg-surface-2 ${i === 0 ? "flash-in" : ""}`}
                  style={i === 0 ? ({ "--accent": isCatch ? "var(--green)" : "var(--cyan)" } as React.CSSProperties) : undefined}
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={34} />}
                    {k.shiny && <span className="absolute right-0 top-0 text-yellow"><Star size={9} /></span>}
                    {isCatch && <span className="absolute -bottom-1 -left-1"><Pokeball size={14} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.75rem] font-semibold">{k.species}</span>
                      {isCatch ? (
                        <span className="ml-auto shrink-0 text-[0.6rem] text-green">{t("robo.hunt.caught")}</span>
                      ) : (
                        <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[0.62rem] text-cyan"><Xp size={10} />{fmt(k.xp)} XP</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {isCatch && k.ball && <span className="text-[0.56rem] text-text-dim">{k.ball}</span>}
                      {!isCatch && k.loot.map((l, j) => {
                        const icon = itemIcon(l.name);
                        return (
                          <span key={j} className="inline-flex items-center gap-1 rounded bg-[var(--well-bg)] px-1 py-0.5 text-[0.56rem] text-text-dim" title={l.name}>
                            {icon ? <Sprite src={assetIconUrl(icon)} alt={l.name} size={14} /> : <span className="max-w-[6rem] truncate">{l.name}</span>}
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
                  {k.shiny && <span className="absolute right-0.5 top-0.5 text-yellow"><Star size={12} /></span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="pixel text-[0.75rem] text-text">{k.species}</h3>
                    {k.shiny && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[0.62rem] text-text-dim">
                    {isCatch && <Pokeball size={12} />}
                    {isCatch ? t("robo.hunt.caught") : t("robo.hunt.killed")}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {isCatch ? (
                  <div className="flex items-center gap-2 text-[0.72rem]">
                    <span className="text-text-dim">{t("robo.hunt.withBall")}:</span>
                    <span className="text-text">{k.ball || "—"}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[0.72rem]">
                      <span className="text-text-dim">XP</span>
                      <span className="inline-flex items-center gap-1 text-cyan"><Xp size={11} />{fmt(k.xp)}</span>
                    </div>
                    <div className="field-label mt-1">{t("robo.hunt.drops")}</div>
                    {k.loot.length === 0 ? (
                      <span className="text-[0.72rem] text-text-dim">{t("robo.hunt.noDrops")}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {k.loot.map((l, j) => {
                          const icon = itemIcon(l.name);
                          return (
                            <div key={j} className="flex items-center gap-2 rounded border border-border p-1.5 text-[0.72rem]">
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
