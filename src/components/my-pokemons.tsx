"use client";

// Secao "Meus Pokemons" (VIP): TODA a gestao dos seus pokemons num lugar so — o time
// ativo (trocar lider, guardar no box) e o box completo (buscar, ordenar, tirar pro
// time), com stats reais e raridade. O card do painel virou leitura pura; quem mexe
// no time e ESTA secao. Mesmos endpoints do antigo card: /api/vip/summon e
// /api/vip/team (sessao viva -> socket segurado; sem sessao -> one-shot de leitura).

import { useEffect, useMemo, useState } from "react";
import { useVipLive, type LiveTeamPoke } from "./vip-live";
import { Star, Check, Trainer, Backpack, Plus, Chart, Xp } from "./icons";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useToast } from "./toast";
import { useT } from "./locale-provider";
import { Modal } from "./modal";
import { Panel } from "./ui/panel";
import { EmptyState } from "./ui/feed";
import { LoadingBall } from "./loaders";
import { SelectMenu } from "./select-menu";
import { PokeStatsModal } from "./mon-stats";
import { RarityBadge } from "./badges";
import type { MarketDex } from "./market-advisor";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const ivColor = (v: number) => (v >= 150 ? "text-green" : v >= 100 ? "text-yellow" : "text-text");

export function MyPokemons({ dex }: { dex?: Record<number, MarketDex> }) {
  const t = useT();
  const toast = useToast();
  const { hunt, account, applyHunt } = useVipLive();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: "store" | "withdraw"; poke: LiveTeamPoke } | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [statsPoke, setStatsPoke] = useState<LiveTeamPoke | null>(null);
  // box carrega junto com a secao (nao e mais modal)
  const [boxList, setBoxList] = useState<LiveTeamPoke[] | null>(null);
  const [boxErr, setBoxErr] = useState<"" | "err" | "not_connected">("");
  const [boxQ, setBoxQ] = useState("");
  const [boxSort, setBoxSort] = useState("quality");

  // time ao vivo da sessao segurada; sem conexao, snapshot do banco
  const live = hunt?.wsOpen && hunt.team?.length ? hunt.team : null;
  const team: LiveTeamPoke[] = useMemo(
    () => live ?? account?.team?.list?.filter((p) => p.team).sort((a, b) => a.slot - b.slot) ?? [],
    [live, account?.team],
  );
  const leader = team.find((p) => p.leader) ?? team[0] ?? null;
  const teamFull = team.length >= 6;
  const rarityOf = (p: LiveTeamPoke) => dex?.[p.speciesId]?.rarity;

  const loadBox = () => {
    setBoxList(null); setBoxErr("");
    fetch("/api/vip/team", { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, j })))
      .then(({ ok, status, j }) => {
        if (ok && Array.isArray(j?.box)) setBoxList(j.box as LiveTeamPoke[]);
        else setBoxErr(status === 409 ? "not_connected" : "err");
      })
      .catch(() => setBoxErr("err"));
  };
  useEffect(loadBox, []);

  const summon = async (p: LiveTeamPoke) => {
    if (busyId || p.leader) return;
    setBusyId(p.id);
    try {
      const r = await fetch("/api/vip/summon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pokeId: p.id }) });
      if (!r.ok) { toast.error(t("toast.summonFail")); return; }
      if (hunt?.team) applyHunt({ ...hunt, team: hunt.team.map((x) => ({ ...x, leader: x.id === p.id })) });
      toast.success(t("toast.summonOk", { name: p.name }));
    } catch { toast.error(t("toast.summonFail")); } finally { setBusyId(null); }
  };

  const move = async (action: "store" | "withdraw", p: LiveTeamPoke) => {
    if (moveBusy) return;
    setMoveBusy(true);
    try {
      const r = await fetch("/api/vip/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pokeId: p.id, action }) });
      if (!r.ok) { toast.error(t("toast.moveFail")); return; }
      toast.success(t(action === "store" ? "toast.storeOk" : "toast.withdrawOk", { name: p.name }));
      setConfirm(null);
      if (action === "store" && hunt?.team) applyHunt({ ...hunt, team: hunt.team.filter((x) => x.id !== p.id) });
      // o box mudou de verdade nos dois sentidos — recarrega a lista
      loadBox();
    } catch { toast.error(t("toast.moveFail")); } finally { setMoveBusy(false); }
  };

  const boxShown = useMemo(() => {
    if (!boxList) return null;
    const needle = boxQ.trim().toLowerCase();
    const filtered = needle ? boxList.filter((p) => p.name.toLowerCase().includes(needle)) : boxList;
    const rank = (p: LiveTeamPoke): number => {
      switch (boxSort) {
        case "iv": return p.ivTotal;
        case "power": return p.power;
        case "level": return p.level;
        default: return p.quality;
      }
    };
    return [...filtered].sort((a, b) => rank(b) - rank(a) || b.ivTotal - a.ivTotal);
  }, [boxList, boxQ, boxSort]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="section-title text-yellow">{t("vip.poke.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("vip.poke.desc")}</p>
      </div>

      {/* ===== time ativo: trocar lider + guardar no box ===== */}
      <Panel icon={<Trainer size={12} />} accent="var(--yellow)" title={t("vip.team.title")} className="p-5" bodyClassName="gap-3">
        {team.length === 0 ? (
          <EmptyState message={t("vip.team.empty")} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((p) => {
              const isLeader = p === leader;
              const rar = rarityOf(p);
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-3 rounded border p-2.5 transition ${isLeader ? "border-[color:var(--yellow)]/50 bg-[var(--well-bg)]" : "border-border bg-[var(--well-bg)] hover:border-[color:var(--yellow)]/50"}`}
                >
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-2">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={40} />
                    {(p.shiny || isLeader) && (
                      <span className="absolute -right-1 -top-1 text-yellow"><Star size={10} /></span>
                    )}
                    {busyId === p.id && <span className="absolute inset-0 rounded radar" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[0.95rem] font-semibold text-text">{p.name}</span>
                      <span className="pixel shrink-0 text-[0.75rem] text-text-dim">Lv{p.level}</span>
                      {isLeader && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>{t("account.team.leader")}</span>}
                      {rar && <RarityBadge rarity={rar} />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[0.8rem] tabular-nums text-text-dim">
                      <span className="inline-flex items-center gap-1 text-cyan"><Xp size={9} />{fmt(p.power)}</span>
                      <span>IV <span className={ivColor(p.ivTotal)}>{p.ivTotal}</span></span>
                      <span>Q <span className="text-cyan">{p.quality.toFixed(2)}</span></span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {p.stats && (
                      <button type="button" onClick={() => setStatsPoke(p)} title={t("vip.team.viewStats")}
                        className="rounded border border-border p-1.5 text-text-dim transition hover:border-[color:var(--cyan)]/60 hover:text-cyan">
                        <Chart size={11} />
                      </button>
                    )}
                    {!isLeader && (
                      <button type="button" onClick={() => void summon(p)} disabled={busyId != null} title={t("vip.team.makeLeader")}
                        className="rounded border border-border p-1.5 text-text-dim transition hover:border-[color:var(--yellow)]/60 hover:text-yellow disabled:opacity-30">
                        <Check size={11} />
                      </button>
                    )}
                    {!isLeader && (
                      <button type="button" onClick={() => setConfirm({ action: "store", poke: p })} disabled={moveBusy || p.starter}
                        title={p.starter ? t("vip.team.starterStay") : t("vip.team.store")}
                        className="rounded border border-border p-1.5 text-text-dim transition hover:border-[color:var(--cyan)]/60 hover:text-cyan disabled:opacity-30">
                        <Backpack size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ===== box completo: buscar, ordenar, tirar pro time ===== */}
      <Panel
        icon={<Backpack size={12} />}
        accent="var(--cyan)"
        title={<>{t("vip.team.boxTitle")}{boxList && <span className="ms-2 pixel text-[0.8rem] text-text-dim">{boxList.length}</span>}</>}
        className="p-5"
        bodyClassName="gap-3"
      >
        {teamFull && <p className="text-[0.86rem] text-yellow">{t("vip.team.teamFull")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <input value={boxQ} onChange={(e) => setBoxQ(e.target.value)} placeholder={t("vip.team.boxSearch")} className="input max-w-xs flex-1" />
          <SelectMenu value={boxSort} onChange={setBoxSort} className="" options={[
            { value: "quality", label: t("account.market.sort.quality") },
            { value: "iv", label: t("account.market.sort.iv") },
            { value: "power", label: t("account.market.sort.power") },
            { value: "level", label: "Level" },
          ]} />
          <button type="button" onClick={loadBox} className="btn btn-ghost">{t("vip.poke.reload")}</button>
        </div>

        {boxErr === "not_connected" ? (
          <EmptyState message={t("vip.poke.connectFirst")} />
        ) : boxErr === "err" ? (
          <p className="py-8 text-center text-[0.95rem] text-red">{t("toast.err")}</p>
        ) : boxList === null ? (
          <div className="py-6"><LoadingBall label={t("vip.poke.loading")} /></div>
        ) : !boxShown || boxShown.length === 0 ? (
          <EmptyState message={t("vip.team.boxEmpty")} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boxShown.map((p) => {
              const rar = rarityOf(p);
              return (
                <div key={p.id} className="group flex items-center gap-3 rounded border border-border bg-[var(--well-bg)] p-2.5 transition hover:border-[color:var(--cyan)]/60 hover:bg-surface-2">
                  <button
                    type="button"
                    onClick={() => p.stats && setStatsPoke(p)}
                    title={t("vip.team.viewStats")}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded bg-surface-2">
                      <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={40} />
                      {p.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={10} /></span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[0.95rem] font-semibold text-text">{p.name}</span>
                        <span className="pixel shrink-0 text-[0.75rem] text-text-dim">Lv{p.level}</span>
                        {rar && <RarityBadge rarity={rar} />}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-[0.82rem] tabular-nums text-text-dim">
                        <span>IV <span className={ivColor(p.ivTotal)}>{p.ivTotal}</span></span>
                        <span>Q <span className="text-cyan">{p.quality.toFixed(2)}</span></span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ action: "withdraw", poke: p })}
                    disabled={moveBusy || teamFull}
                    title={t("vip.team.withdraw")}
                    className="shrink-0 rounded border border-border p-1.5 text-text-dim transition hover:border-[color:var(--green)]/60 hover:text-green disabled:opacity-30"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* confirmacao: store/withdraw MUDAM a conta no jogo de verdade */}
      {confirm && (
        <Modal onClose={() => setConfirm(null)} className="w-full max-w-sm p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
              <Sprite src={spriteUrl(confirm.poke.speciesId, confirm.poke.shiny)} alt={confirm.poke.name} size={40} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.98rem] text-text">
                {t(confirm.action === "store" ? "vip.team.confirmStore" : "vip.team.confirmWithdraw", { name: confirm.poke.name })}
              </p>
              <p className="mt-1 text-[0.8rem] text-text-dim">{t("vip.team.confirmNote")}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost">{t("vip.team.cancel")}</button>
            <button type="button" onClick={() => void move(confirm.action, confirm.poke)} disabled={moveBusy} className="btn btn-cyan disabled:opacity-40">
              {moveBusy ? "…" : t("vip.team.confirm")}
            </button>
          </div>
        </Modal>
      )}

      {/* stats reais do pokemon clicado (leitura pura) */}
      {statsPoke && (
        <PokeStatsModal poke={statsPoke} dex={dex?.[statsPoke.speciesId]} onClose={() => setStatsPoke(null)} />
      )}
    </div>
  );
}
