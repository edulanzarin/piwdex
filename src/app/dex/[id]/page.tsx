import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  creatures,
  evolutionChainOf,
  getCreature,
  getItemByName,
  locationsOf,
} from "@/lib/data";
import { spriteUrl, itemIconUrl } from "@/lib/sprites";
import { defensiveProfile, TYPE_COLOR } from "@/lib/typing";
import { RarityBadge, TypeBadge, TypeBadges } from "@/components/badges";

export function generateStaticParams() {
  return creatures.map((c) => ({ id: String(c.pokeId) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = getCreature(Number(id));
  return { title: c ? `${c.name} #${c.pokeId}` : "Pokemon" };
}

const STATS = [
  ["HP", "baseHp"], ["Ataque", "baseAtk"], ["Defesa", "baseDef"],
  ["Sp. Atk", "baseSpAtk"], ["Sp. Def", "baseSpDef"], ["Velocidade", "baseSpeed"],
] as const;

const MAX_STAT = 200; // teto visual das barras

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / MAX_STAT) * 100);
  const hue = Math.round((Math.min(value, MAX_STAT) / MAX_STAT) * 120); // vermelho->verde
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-sm text-text-dim">{label}</div>
      <div className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
        {value}
      </div>
      <div className="h-2.5 flex-1 rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `hsl(${hue} 70% 45%)` }}
        />
      </div>
    </div>
  );
}

function pctLabel(p: number): string {
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  return `${p.toFixed(4)}%`;
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getCreature(Number(id));
  if (!c) notFound();

  const src = spriteUrl(c.pokeId);
  const total = c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed;
  const { weak, resist, immune } = defensiveProfile(c.type1, c.type2);
  const chain = evolutionChainOf(c);
  const locations = locationsOf(c);
  const loot = [...(c.loot ?? [])].sort((a, b) => b.chance - a.chance);
  const moves = [...(c.attacks ?? [])].sort((a, b) => a.learnLevel - b.learnLevel);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dex" className="text-sm text-text-dim hover:text-text">
        ← Pokedex
      </Link>

      {/* Cabecalho */}
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={c.name} width={112} height={112} className="pixelated max-h-28" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-sm text-text-dim">#{c.pokeId}</div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadges t1={c.type1} t2={c.type2} />
            <RarityBadge rarity={c.rarity} />
          </div>
          <p className="text-sm text-text-dim">{c.description}</p>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            <span>Hunt lvl <strong>{c.huntLevel}</strong></span>
            <span>XP <strong>{c.experience.toLocaleString("pt-BR")}</strong></span>
            <span>Venda <strong>{c.sellValue.toLocaleString("pt-BR")}</strong></span>
            <span>NPC <strong>{c.priceNpc.toLocaleString("pt-BR")}</strong></span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stats */}
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Stats base</h2>
          <div className="flex flex-col gap-2">
            {STATS.map(([label, key]) => (
              <StatBar key={key} label={label} value={c[key]} />
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
              <span className="text-text-dim">Total</span>
              <strong className="tabular-nums">{total}</strong>
            </div>
          </div>
        </section>

        {/* Efetividade */}
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Fraquezas & resistencias</h2>
          <div className="flex flex-col gap-3 text-sm">
            <TypeGroup title="Recebe mais dano de" types={weak} />
            <TypeGroup title="Recebe menos dano de" types={resist} />
            <TypeGroup title="Imune a" types={immune} />
          </div>
        </section>
      </div>

      {/* Evolucao */}
      {chain.length > 1 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Evolucao</h2>
          <div className="flex flex-wrap items-center gap-2">
            {chain.map((stage, i) => (
              <div key={stage.creature.pokeId} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-xs text-text-dim">
                    → lvl {stage.evolveLevel ?? "?"} →
                  </span>
                )}
                <Link
                  href={`/dex/${stage.creature.pokeId}`}
                  className={`flex flex-col items-center rounded-lg p-2 hover:bg-surface-2 ${
                    stage.creature.pokeId === c.pokeId ? "bg-surface-2" : ""
                  }`}
                >
                  {spriteUrl(stage.creature.pokeId) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spriteUrl(stage.creature.pokeId)!}
                      alt={stage.creature.name}
                      width={64}
                      height={64}
                      className="pixelated h-16 w-16"
                    />
                  )}
                  <span className="text-xs">{stage.creature.name}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Localizacoes */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Onde caçar</h2>
        {locations.length ? (
          <div className="flex flex-wrap gap-2">
            {locations.map((h) => (
              <span key={h.slug} className="chip" style={{ background: "var(--surface-2)", color: "var(--text)", textShadow: "none" }}>
                {h.name} · {h.area} {h.level ? `(lvl ${h.level})` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-dim">Sem ponto de hunt mapeado (boss ou exclusivo).</p>
        )}
      </section>

      {/* Drops */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Drops <span className="text-text-dim font-normal">({loot.length})</span></h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-dim">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">Qtd</th>
                <th className="pb-2 text-right font-medium">Chance</th>
              </tr>
            </thead>
            <tbody>
              {loot.map((l) => {
                const item = getItemByName(l.name);
                const p = l.chance / 1000;
                return (
                  <tr key={l.name} className="border-t border-border">
                    <td className="py-2">
                      {item ? (
                        <Link href={`/items/${item.id}`} className="flex items-center gap-2 hover:text-accent">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={itemIconUrl(item)} alt="" width={22} height={22} className="pixelated h-[22px] w-[22px]" />
                          {l.name}
                        </Link>
                      ) : (
                        l.name
                      )}
                    </td>
                    <td className="py-2 text-text-dim">{l.minCount === l.maxCount ? l.minCount : `${l.minCount}–${l.maxCount}`}</td>
                    <td className="py-2 text-right tabular-nums">{l.chance === 0 ? "especial" : pctLabel(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Moves */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Ataques <span className="text-text-dim font-normal">({moves.length})</span></h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-dim">
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium">Cat.</th>
                <th className="pb-2 text-right font-medium">Poder</th>
                <th className="pb-2 text-right font-medium">CD</th>
                <th className="pb-2 text-right font-medium">Nvl</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m, i) => (
                <tr key={`${m.name}-${i}`} className="border-t border-border">
                  <td className="py-2">{m.name}</td>
                  <td className="py-2"><TypeBadge type={m.type} /></td>
                  <td className="py-2 text-text-dim">{m.category}</td>
                  <td className="py-2 text-right tabular-nums">{m.power || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{(m.cooldownMs / 1000).toFixed(1)}s</td>
                  <td className="py-2 text-right tabular-nums">{m.learnLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TypeGroup({ title, types }: { title: string; types: import("@/lib/types").PokeType[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-text-dim">{title}</span>
      {types.length ? (
        types.map((t) => (
          <span key={t} className="chip" style={{ background: TYPE_COLOR[t] }}>{t}</span>
        ))
      ) : (
        <span className="text-text-dim">—</span>
      )}
    </div>
  );
}
