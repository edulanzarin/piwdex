"use client";

// Time ATIVO ao vivo (card do cockpit). Com o robo conectado, o time vem dos frames
// `pokes` da sessao segurada (tempo real de verdade); sem conexao, cai no snapshot do
// banco (rotulado). O lider aparece em destaque e QUALQUER outro pokemon do time troca
// de lider com um clique (poke-summon na mesma sessao — sem derrubar nada).

import { useMemo, useState } from "react";
import { useVipLive, type LiveTeamPoke } from "./vip-live";
import { Star, Xp, Check, Trainer } from "./icons";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const color = pct > 50 ? "var(--green)" : pct > 20 ? "var(--yellow)" : "var(--red)";
  return (
    <span className="hud-track block w-full">
      <span className="hud-fill block" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export function TeamLive() {
  const t = useT();
  const toast = useToast();
  const { hunt, account, applyHunt } = useVipLive();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failId, setFailId] = useState<string | null>(null);

  // time ao vivo da sessao segurada; sem conexao, snapshot do banco
  const live = hunt?.wsOpen && hunt.team?.length ? hunt.team : null;
  const team: LiveTeamPoke[] = useMemo(
    () => live ?? account?.team?.list?.filter((p) => p.team).sort((a, b) => a.slot - b.slot) ?? [],
    [live, account?.team],
  );
  const leader = team.find((p) => p.leader) ?? team[0] ?? null;
  const others = team.filter((p) => p !== leader);

  const summon = async (p: LiveTeamPoke) => {
    if (busyId || p.leader) return;
    setBusyId(p.id); setFailId(null);
    try {
      const r = await fetch("/api/vip/summon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pokeId: p.id }) });
      if (!r.ok) { setFailId(p.id); toast.error(t("toast.summonFail")); return; }
      // otimista: marca o novo lider na hora; o stream confirma no proximo frame pokes
      if (hunt?.team) {
        applyHunt({ ...hunt, team: hunt.team.map((x) => ({ ...x, leader: x.id === p.id })) });
      }
      toast.success(t("toast.summonOk", { name: p.name }));
    } catch { setFailId(p.id); toast.error(t("toast.summonFail")); } finally { setBusyId(null); }
  };

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Trainer size={13} className="text-yellow" />
        <h3 className="section-title flex-1">{t("vip.team.title")}</h3>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-[0.55rem] uppercase text-green">
            <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />
            {t("vip.ov.live")}
          </span>
        ) : team.length > 0 ? (
          <span className="chip bg-surface-2 !text-text-dim">{t("vip.team.snapshot")}</span>
        ) : null}
      </div>

      {!leader ? (
        <p className="py-3 text-center text-[0.68rem] text-text-dim">{t("vip.team.empty")}</p>
      ) : (
        <>
          {/* lider em destaque */}
          <div className="glow-pulse flex items-center gap-3.5 rounded border border-[color:var(--yellow)]/45 bg-[var(--well-bg)] p-3"
            style={{ "--accent": "var(--yellow)" } as React.CSSProperties}>
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-2">
              <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={56} />
              <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={12} /></span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="pixel text-[0.8rem] text-yellow">{leader.name}</span>
                <span className="pixel text-[0.62rem] text-text">Lv{hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}</span>
                {leader.shiny && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>}
              </div>
              <div className="mt-1.5"><HpBar hp={leader.hp} maxHp={leader.maxHp} /></div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6rem] tabular-nums text-text-dim">
                <span className="inline-flex items-center gap-1 text-cyan"><Xp size={9} />{fmt(leader.power)} {t("vip.team.power")}</span>
                <span>IV {leader.ivTotal}</span>
                <span>Q {leader.quality.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* resto do time: clique = virar o lider (summon na mesma sessao) */}
          {others.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {others.map((p) => {
                const busy = busyId === p.id;
                const fail = failId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void summon(p)}
                    disabled={busyId != null}
                    title={t("vip.team.makeLeader")}
                    className={`group flex items-center gap-2 rounded border p-2 text-left transition ${fail ? "border-red" : "border-border"} hover:border-[color:var(--yellow)]/60 hover:bg-surface-2 disabled:opacity-60`}
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                      <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={30} />
                      {busy && <span className="absolute inset-0 rounded radar" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.66rem] text-text">{p.name}</span>
                      <span className="block text-[0.55rem] tabular-nums text-text-dim">Lv{p.level} · {fmt(p.power)}</span>
                      <HpBar hp={p.hp} maxHp={p.maxHp} />
                    </span>
                    <span className="shrink-0 text-[0.52rem] uppercase text-text-dim opacity-0 transition group-hover:opacity-100">
                      {fail ? <span className="text-red">{t("vip.team.retry")}</span> : busy ? "…" : <span className="inline-flex items-center gap-1 text-yellow"><Check size={9} />{t("vip.team.use")}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
