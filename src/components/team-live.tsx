"use client";

// Time ATIVO ao vivo (card do cockpit) — LEITURA PURA. Com o robo conectado, o time vem
// dos frames `pokes` da sessao segurada (tempo real de verdade); sem conexao, cai no
// snapshot do banco (rotulado). Clicar num pokemon abre os stats reais dele. TODA a
// gestao (trocar lider, box) mora na secao "Meus Pokemons" — o cockpit so mostra.

import { useMemo, useState } from "react";
import { useVipLive, type LiveTeamPoke } from "./vip-live";
import { Star, Xp, Trainer, ChevronRight } from "./icons";
import { Pokeball } from "./pokeball";
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
  // time e no maximo 6: lider + 5 SLOTS fixos — slot sem pokemon mostra placeholder
  // esmaecido no mesmo lugar, e o card nunca muda de altura quando o time muda ao vivo
  const otherSlots: (LiveTeamPoke | null)[] = Array.from({ length: 5 }, (_, i) => others[i] ?? null);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Trainer size={18} className="text-yellow" />
        <h3 className="section-title flex-1">{t("vip.team.title")}</h3>
        {/* slot de status de ALTURA FIXA: um estado por vez (ao vivo > snapshot > nada) */}
        <span className="inline-flex h-6 items-center">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-xs uppercase text-green">
              <span className="hud-led pulse-soft" style={{ "--led": "var(--green)" } as React.CSSProperties} />
              {t("vip.ov.live")}
            </span>
          ) : team.length > 0 ? (
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{t("vip.team.snapshot")}</span>
          ) : null}
        </span>
      </div>

      {/* slot do lider SEMPRE presente: vazio mostra o placeholder com as mesmas dimensoes */}
      {leader ? (
        <button
          type="button"
          onClick={() => leader.stats && setStatsPoke(leader)}
          title={t("vip.team.viewStats")}
          className="glow-pulse flex items-center gap-3.5 rounded border border-[color:var(--yellow)]/45 bg-[var(--well-bg)] p-3 text-left transition hover:bg-surface-2"
          style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
        >
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-2">
            <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={56} />
            <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={16} /></span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex h-6 items-center gap-2 overflow-hidden">
              <span className="truncate pixel text-base text-yellow">{leader.name}</span>
              <span className="pixel shrink-0 text-sm text-text">Lv{hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}</span>
              <span className={`chip shrink-0 ${leader.shiny ? "" : "invisible"}`} style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>
              {leaderRarity && <span className="shrink-0"><RarityBadge rarity={leaderRarity} /></span>}
            </span>
            <span className="mt-1.5 block"><HpBar hp={leader.hp} maxHp={leader.maxHp} /></span>
            <span className="mt-1.5 flex h-5 items-center gap-x-3 overflow-hidden text-sm tabular-nums text-text-dim">
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-cyan"><Xp size={14} />{fmt(leader.power)} {t("vip.team.power")}</span>
              <span className="shrink-0 whitespace-nowrap">IV {leader.ivTotal}</span>
              <span className="shrink-0 whitespace-nowrap">Q {leader.quality.toFixed(3)}</span>
            </span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3.5 rounded border border-border bg-[var(--well-bg)] p-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-2">
            <span className="slot-empty"><Pokeball size={40} /></span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex h-6 items-center"><span className="pixel text-base slot-empty">—</span></span>
            <span className="mt-1.5 block"><HpBar hp={0} maxHp={0} /></span>
            <span className="mt-1.5 flex h-5 items-center text-sm text-text-dim"><span className="truncate">{t("vip.team.empty")}</span></span>
          </span>
        </div>
      )}

      {/* resto do time: 5 slots fixos — clique abre os stats reais; slot vago = placeholder */}
      <div className="grid grid-cols-2 gap-1.5">
        {otherSlots.map((p, i) =>
          p ? (
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
                <span className="block h-6 truncate text-base leading-6 text-text">{p.name}</span>
                <span className="block h-4 truncate text-xs leading-4 tabular-nums text-text-dim">Lv{p.level} · {fmt(p.power)}</span>
                <HpBar hp={p.hp} maxHp={p.maxHp} />
              </span>
            </button>
          ) : (
            <div key={`slot-${i}`} className="flex items-center gap-2 rounded border border-border p-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                <span className="slot-empty"><Pokeball size={22} /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block h-6 truncate text-base leading-6 slot-empty">—</span>
                <span className="block h-4 truncate text-xs leading-4 slot-empty">Lv —</span>
                <HpBar hp={0} maxHp={0} />
              </span>
            </div>
          ),
        )}
      </div>

      {/* gestao (lider/box) mora em Meus Pokemons */}
      {onManage && (
        <button type="button" onClick={onManage} className="btn btn-ghost self-start">
          {t("vip.sec.pokemons")} <ChevronRight size={14} />
        </button>
      )}

      {statsPoke && (
        <PokeStatsModal poke={statsPoke} dex={dex?.[statsPoke.speciesId]} onClose={() => setStatsPoke(null)} />
      )}
    </div>
  );
}
