"use client";

// Hunt Analyzer ao vivo (secao do Robo). Liga/desliga a sessao que o piwdex segura no
// servidor (POST /api/vip/hunt) e faz poll do estado (GET) a cada 5s enquanto ao vivo.
// Ver src/lib/game-hunt-session.ts. Single-session: ligar desconecta o jogo no browser.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./locale-provider";
import { Coin, Star } from "./icons";
import { Sprite } from "./sprite";
import { spriteUrl, assetIconUrl } from "@/lib/sprites";

// Uma hunt do catalogo do jogo: o `slug` e exatamente o que o enter-hunt come; o resto
// e detalhe pro seletor (nivel, area, sprite do pokemon daquele ponto).
export interface HuntOption { slug: string; name: string; level: number; area: string; pokeId: number | null }

interface Analyzer {
  kills: number; seconds: number; xpGained: number;
  lootGold: number; supplyGold: number; balance: number;
  goldPerHour: number; xpPerHour: number; captures: number;
  drops: { itemId: number; name: string; qty: number; gold: number }[];
}
interface KillLog { at: number; species: string; shiny: boolean; xp: number; loot: { itemId: number; name: string; qty: number }[] }
export interface KillDex { pokeByName: Map<string, number>; itemIcon: (id: number) => string | null }
type Status = "idle" | "connecting" | "running" | "kicked" | "error";
interface HuntState { status: Status; slug: string | null; analyzer: Analyzer | null; recentKills: KillLog[] }

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const hm = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const STATUS_COLOR: Record<Status, string> = { idle: "var(--text-dim)", connecting: "var(--yellow)", running: "var(--green)", kicked: "var(--yellow)", error: "var(--pink)" };

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-[0.6rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`mt-1 pixel text-[0.7rem] ${accent ? "text-yellow" : "text-text"}`}>{value}</div>
    </div>
  );
}

export function HuntAnalyzer({ hunts, creatures, itemIcons }: { hunts: HuntOption[]; creatures: { pokeId: number; name: string }[]; itemIcons: Record<number, string> }) {
  const t = useT();
  const [st, setSt] = useState<HuntState | null>(null);

  // resolve o sprite do pokemon do kill (field-kill so traz o nome) e o icone do loot.
  const pokeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of creatures) m.set(c.name.toLowerCase(), c.pokeId);
    return m;
  }, [creatures]);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = hunts.find((h) => h.slug === slug) ?? null;

  // hunts filtradas pela busca e agrupadas por area (kanto/outland/orre), ordenadas por nivel.
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filt = needle ? hunts.filter((h) => h.name.toLowerCase().includes(needle) || h.slug.includes(needle)) : hunts;
    const byArea = new Map<string, HuntOption[]>();
    for (const h of filt) { const a = byArea.get(h.area) ?? []; a.push(h); byArea.set(h.area, a); }
    return [...byArea.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([area, list]) => [area, [...list].sort((x, y) => x.level - y.level)] as const);
  }, [hunts, q]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/vip/hunt", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as HuntState | null;
      if (j) { setSt(j); if (j.slug && !slug) setSlug(j.slug); }
    } catch {}
  }, [slug]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // poll continuo (2s) — reflete o analyzer ao vivo sem depender de estado intermediario
  useEffect(() => {
    timer.current = setInterval(load, 2000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [load]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/vip/hunt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => null)) as HuntState | null;
      if (j && "status" in j) setSt(j);
    } finally { setBusy(false); }
  };

  const status = st?.status ?? "idle";
  const running = status === "running" || status === "connecting";
  const a = st?.analyzer ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-yellow"><Star size={13} /> {t("robo.hunt.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.hunt.desc")}</p>
      </div>

      {/* controle */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
          {t(`robo.hunt.status.${status}`)}
        </span>
        {!running ? (
          <>
            <button type="button" onClick={() => setPickerOpen(true)} className="btn btn-ghost inline-flex items-center gap-2">
              {selected ? (
                <>
                  {selected.pokeId != null && <Sprite src={spriteUrl(selected.pokeId)} alt={selected.name} size={18} />}
                  <span className="truncate">{selected.name}</span>
                  <span className="text-text-dim">Lv{selected.level}</span>
                </>
              ) : (
                t("robo.hunt.pick")
              )}
            </button>
            <button type="button" onClick={() => slug.trim() && send({ action: "start", slug: slug.trim() })} disabled={busy || !slug.trim()} className="btn btn-cyan disabled:opacity-40">
              {t("robo.hunt.start")} ›
            </button>
          </>
        ) : (
          <button type="button" onClick={() => send({ action: "stop" })} disabled={busy} className="btn btn-ghost">{t("robo.hunt.stop")}</button>
        )}
      </div>

      {/* modal de escolha da hunt — busca + agrupado por area, com sprite e nivel */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPickerOpen(false)}>
          <div className="card flex max-h-[80vh] w-full max-w-lg flex-col p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="pixel text-[0.7rem] text-cyan">{t("robo.hunt.pickTitle")}</h3>
              <button type="button" onClick={() => setPickerOpen(false)} className="btn btn-ghost">✕</button>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("robo.hunt.searchPh")} className="input mb-3" autoFocus />
            <div className="flex-1 overflow-auto pr-1">
              {grouped.length === 0 ? (
                <p className="py-6 text-center text-[0.72rem] text-text-dim">{t("robo.hunt.noHunts")}</p>
              ) : (
                grouped.map(([area, list]) => (
                  <div key={area} className="mb-3">
                    <div className="mb-1 text-[0.55rem] uppercase tracking-wide text-text-dim">{area}</div>
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
          </div>
        </div>
      )}

      {/* stats */}
      {a && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t("robo.hunt.kills")} value={fmt(a.kills)} />
          <Stat label={t("robo.hunt.time")} value={hm(a.seconds)} />
          <Stat label={t("robo.hunt.xph")} value={fmt(a.xpPerHour)} />
          <Stat label={t("robo.hunt.goldph")} value={fmt(a.goldPerHour)} accent />
          <Stat label={t("robo.hunt.loot")} value={fmt(a.lootGold)} />
          <Stat label={t("robo.hunt.supply")} value={`-${fmt(a.supplyGold)}`} />
          <Stat label={t("robo.hunt.captures")} value={fmt(a.captures)} />
          <Stat label={t("robo.hunt.balance")} value={fmt(a.balance)} accent />
        </div>
      )}

      {/* ultimos kills ao vivo — cards com sprite do pokemon + icone de cada loot */}
      {st?.recentKills && st.recentKills.length > 0 && (
        <div className="card p-4">
          <h3 className="pixel mb-2 text-[0.6rem] text-cyan">{t("robo.hunt.recent")}</h3>
          <div className="grid max-h-96 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
            {st.recentKills.map((k, i) => {
              const pid = pokeByName.get(k.species.toLowerCase());
              return (
                <div key={k.at + "-" + i} className="flex items-center gap-2.5 rounded border border-border bg-[rgba(8,14,28,0.5)] p-2">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
                    {pid != null && <Sprite src={spriteUrl(pid, k.shiny)} alt={k.species} size={34} />}
                    {k.shiny && <span className="absolute right-0 top-0 text-yellow"><Star size={9} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[0.75rem] font-semibold">{k.species}</span>
                      <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[0.62rem] text-yellow"><Coin size={9} />{fmt(k.xp)}</span>
                    </div>
                    {k.loot.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {k.loot.map((l, j) => {
                          const icon = itemIcons[l.itemId];
                          return (
                            <span key={j} className="inline-flex items-center gap-1 rounded bg-[rgba(8,14,28,0.6)] px-1 py-0.5 text-[0.56rem] text-text-dim" title={l.name}>
                              {icon ? <Sprite src={assetIconUrl(icon)} alt={l.name} size={14} /> : <span className="truncate max-w-[6rem]">{l.name}</span>}
                              x{l.qty}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
