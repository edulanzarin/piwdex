"use client";

// Time ATIVO ao vivo (card do cockpit) — leitura + UMA acao. Com o robo conectado, o time
// vem dos frames `pokes` da sessao segurada (tempo real de verdade); sem conexao, cai no
// snapshot do banco (rotulado). Clicar num pokemon abre os stats reais dele. Gestao
// (trocar lider, box) mora em "Meus Pokemons" — e o botao pra la vive na Conta.
// A EXCECAO e curar: pokemon desmaiado nao caca, entao o cockpit mostra a vida e deixa
// chamar a Joy dali mesmo, que e onde o problema aparece.

import { useMemo, useState } from "react";
import { useVipLive, type LiveTeamPoke } from "./vip-live";
import { Star, Xp, Trainer } from "./icons";
import { Pokeball } from "./pokeball";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { PokeStatsModal } from "./mon-stats";
import { QualityBadge } from "./badges";
import { HpBar, HpText, HpMeter, FaintedChip, isFainted } from "./ui/hp";
import { HealButton } from "./heal-button";
import { PokeXpBar, PokeXpLine } from "./poke-xp";
import type { MarketDex } from "./market-advisor";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function TeamLive({ dex }: { dex?: Record<number, MarketDex> }) {
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
  // alguem em 0 de vida: enquanto tiver, o card oferece a Joy (o resto do time cura junto)
  const fainted = team.some(isFainted);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Trainer size={18}  />
        <h3 className="section-title flex-1">{t("vip.team.title")}</h3>
        {/* cura entra no cabecalho SO com alguem desmaiado — acao que aparece quando ha o
            que resolver, e o unico botao que muta a conta neste card */}
        {fainted && <HealButton className="btn btn-red btn-sm" />}
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
          {/* estrela SO em shiny: no lider ela dava impressao de shiny (e um shiny lider
              ficaria com duas). Quem diz "e o ativo" e o slot grande + o acento amarelo. */}
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded bg-surface-2">
            <Sprite src={spriteUrl(leader.speciesId, leader.shiny)} alt={leader.name} size={56} />
            {leader.shiny && <span className="absolute -right-1.5 -top-1.5 text-yellow"><Star size={16} /></span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex h-6 items-center gap-2 overflow-hidden">
              <span className="truncate pixel text-base text-yellow">{leader.name}</span>
              <span className="pixel shrink-0 text-sm text-text">Lv{hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}</span>
              <span className={`chip shrink-0 ${leader.shiny ? "" : "invisible"}`} style={{ background: "var(--yellow)", color: "#3a2c00" }}>shiny</span>
              {isFainted(leader) && <FaintedChip />}
              {/* raridade so do sm pra cima: a 360px o chip comia os ~75px que sobravam
                  pro NOME do lider (Lv + shiny + raridade nao cabem os tres) */}
              <span className="hidden shrink-0 sm:inline-flex"><QualityBadge quality={leader.quality} /></span>
            </span>
            <span className="mt-1.5 block"><HpMeter hp={leader.hp} maxHp={leader.maxHp} /></span>
            <span className="mt-1.5 flex h-5 items-center gap-x-3 overflow-hidden text-sm tabular-nums text-text-dim">
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-cyan"><Xp size={14} />{fmt(leader.power)} {t("vip.team.power")}</span>
              <span className="shrink-0 whitespace-nowrap">IV {leader.ivTotal}</span>
              <span className="shrink-0 whitespace-nowrap">Q {leader.quality.toFixed(3)}</span>
            </span>
            {/* XP do POKEMON: o nivel dele anda com a hunt e ninguem via quanto faltava */}
            <span className="mt-1.5 block">
              <PokeXpBar
                level={hunt?.fighterLevel && hunt.fighterLevel > leader.level ? hunt.fighterLevel : leader.level}
                xp={leader.xp}
                xpPerHour={hunt?.pokeXpPerHour ?? undefined}
              />
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
            <span className="mt-1.5 block"><HpMeter hp={0} maxHp={0} /></span>
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
                <span className="flex h-4 items-center gap-x-1.5 overflow-hidden text-xs leading-4 tabular-nums text-text-dim">
                  <span className="shrink-0">Lv{p.level} · {fmt(p.power)}</span>
                  <HpText hp={p.hp} maxHp={p.maxHp} className="text-xs" />
                </span>
                <HpBar hp={p.hp} maxHp={p.maxHp} />
                <span className="mt-0.5 block h-4 truncate text-xs leading-4 text-text-dim">
                  <PokeXpLine level={p.level} xp={p.xp} />
                </span>
              </span>
            </button>
          ) : (
            <div key={`slot-${i}`} className="flex items-center gap-2 rounded border border-border p-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                <span className="slot-empty"><Pokeball size={22} /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block h-6 truncate text-base leading-6 slot-empty">—</span>
                <span className="flex h-4 items-center text-xs leading-4 slot-empty">Lv —</span>
                <HpBar hp={0} maxHp={0} />
                <span className="mt-0.5 block h-4 text-xs leading-4 slot-empty">—</span>
              </span>
            </div>
          ),
        )}
      </div>

      {statsPoke && (
        <PokeStatsModal poke={statsPoke} dex={dex?.[statsPoke.speciesId]} onClose={() => setStatsPoke(null)} />
      )}
    </div>
  );
}
