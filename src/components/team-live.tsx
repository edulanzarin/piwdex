"use client";

// Time ATIVO ao vivo (card do cockpit) — LEITURA PURA. Com o robo conectado, o time vem
// dos frames `pokes` da sessao segurada (tempo real de verdade); sem conexao, cai no
// snapshot do banco (rotulado). Clicar num pokemon abre os stats reais dele. TODA a
// gestao (trocar lider, box) mora na secao "Meus Pokemons" — o cockpit so mostra.

import { useMemo, useState } from "react";
import { useVipLive, type LiveTeamPoke } from "./vip-live";
import { Star, Xp, Trainer, ChevronRight } from "./icons";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { PokeStatsModal } from "./mon-stats";
import { RarityBadge } from "./badges";
import type { MarketDex } from "./market-advisor";

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

export function TeamLive({ dex, onManage }: { dex?: Record<number, MarketDex>; onManage?: () => void }) {
  const t = useT();
  const { hunt, account } = useVipLive();
  // stats reais de um pokemon do time — modal so de leitura
  const [statsPoke, setStatsPoke] = useState<LiveTeamPoke | null>(null);

  // time ao vivo da sessao segurada; sem conexao, snapshot do banco
  const live = hunt?.wsOpen && hunt.team?.length ? hunt.team : null;
  const team: LiveTeamPoke[] = useMemo(
    () => live ?? account?.team?.list?.filter((p) => p.team).sort((a, b) => a.slot - b.slot) ?? [],
    [live, account?.team],
  );
  const leader = team.find((p) => p.leader) ?? team[0] ?? null;
  const others = team.filter((p) => p !== leader);
  const leaderRarity = leader ? dex?.[leader.speciesId]?.rarity : undefined;

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Trainer size={13} className="text-yellow" />
        <h3 className="section-title flex-1">{t("vip.team.title")}</h3>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] uppercase text-green">
            <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />
            {t("vip.ov.live")}
          </span>
        ) : team.length > 0 ? (
          <span className="chip bg-surface-2 !text-text-dim">{t("vip.team.snapshot")}</span>
        ) : null}
      </div>

      {!leader ? (
        <p className="py-3 text-center text-[0.88rem] text-text-dim">{t("vip.team.empty")}</p>
      ) : (
        <>
          {/* lider em destaque — clique abre os stats reais */}
          <button
            type="button"
            onClick={() => leader.stats && setStatsPoke(leader)}
            title={t("vip.team.viewStats")}
            className="glow-pulse flex items-center gap-3.5 rounded border border-[color:var(--yellow)]/45 bg-[var(--well-bg)] p-3 text-left transition hover:bg-surface-2"
            style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
          >
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-2">
              <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={56} />
              <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={12} /></span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="pixel text-[1rem] text-yellow">{leader.name}</span>
                <span className="pixel text-[0.82rem] text-text">Lv{hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}</span>
                {leader.shiny && <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>}
                {leaderRarity && <RarityBadge rarity={leaderRarity} />}
              </span>
              <span className="mt-1.5 block"><HpBar hp={leader.hp} maxHp={leader.maxHp} /></span>
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.8rem] tabular-nums text-text-dim">
                <span className="inline-flex items-center gap-1 text-cyan"><Xp size={9} />{fmt(leader.power)} {t("vip.team.power")}</span>
                <span>IV {leader.ivTotal}</span>
                <span>Q {leader.quality.toFixed(3)}</span>
              </span>
            </span>
          </button>

          {/* resto do time — clique abre os stats reais */}
          {others.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.stats && setStatsPoke(p)}
                  title={t("vip.team.viewStats")}
                  className="flex items-center gap-2 rounded border border-border p-2 text-left transition hover:border-[color:var(--yellow)]/60 hover:bg-surface-2"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={30} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.86rem] text-text">{p.name}</span>
                    <span className="block text-[0.75rem] tabular-nums text-text-dim">Lv{p.level} · {fmt(p.power)}</span>
                    <HpBar hp={p.hp} maxHp={p.maxHp} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* gestao (lider/box) mora em Meus Pokemons */}
      {onManage && (
        <button type="button" onClick={onManage} className="btn btn-ghost self-start">
          {t("vip.sec.pokemons")} <ChevronRight size={10} />
        </button>
      )}

      {statsPoke && (
        <PokeStatsModal poke={statsPoke} dex={dex?.[statsPoke.speciesId]} onClose={() => setStatsPoke(null)} />
      )}
    </div>
  );
}
