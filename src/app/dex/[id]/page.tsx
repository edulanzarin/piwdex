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
import type { PokeType } from "@/lib/types";
import { RarityBadge, TypeBadge, TypeBadges } from "@/components/badges";
import { Sprite } from "@/components/sprite";

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
  ["HP", "baseHp"], ["ATK", "baseAtk"], ["DEF", "baseDef"],
  ["SP.ATK", "baseSpAtk"], ["SP.DEF", "baseSpDef"], ["SPEED", "baseSpeed"],
] as const;

const MAX_STAT = 200;

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / MAX_STAT) * 100);
  const hue = Math.round((Math.min(value, MAX_STAT) / MAX_STAT) * 130);
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-[0.6rem] text-text-dim uppercase tracking-wide">{label}</div>
      <div className="w-9 shrink-0 text-right text-sm font-bold tabular-nums">{value}</div>
      <div className="h-2.5 flex-1 rounded-full bg-[rgba(8,14,28,0.7)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `hsl(${hue} 75% 50%)`, boxShadow: `0 0 8px -2px hsl(${hue} 75% 50%)` }}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="pixel mb-4 text-[0.72rem] text-cyan">{children}</h2>;
}

function TypeGroup({ title, types }: { title: string; types: PokeType[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-36 shrink-0 text-[0.7rem] text-text-dim uppercase tracking-wide">{title}</span>
      {types.length ? types.map((t) => <TypeBadge key={t} type={t} />) : <span className="text-text-dim">—</span>}
    </div>
  );
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getCreature(Number(id));
  if (!c) notFound();

  const total = c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed;
  const { weak, resist, immune } = defensiveProfile(c.type1, c.type2);
  const chain = evolutionChainOf(c);
  const locations = locationsOf(c);
  const loot = [...(c.loot ?? [])].sort((a, b) => b.chance - a.chance);
  const moves = [...(c.attacks ?? [])].sort((a, b) => a.learnLevel - b.learnLevel);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dex" className="text-[0.7rem] text-text-dim hover:text-cyan uppercase tracking-wide">
        ‹ Pokedex
      </Link>

      {/* Cabecalho */}
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={spriteUrl(c.pokeId)} alt={c.name} size={120} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="pixel text-[0.62rem] text-text-dim">#{String(c.pokeId).padStart(3, "0")}</div>
          <h1 className="pixel text-lg text-text">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadges t1={c.type1} t2={c.type2} />
            <RarityBadge rarity={c.rarity} />
          </div>
          <p className="text-sm text-text-dim">{c.description}</p>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="text-text-dim">Hunt lvl <strong className="text-text">{c.huntLevel}</strong></span>
            <span className="text-text-dim">XP <strong className="text-text">{c.experience.toLocaleString("pt-BR")}</strong></span>
            <span className="text-text-dim">Venda <strong className="text-text">{c.sellValue.toLocaleString("pt-BR")}</strong></span>
            <span className="text-text-dim">NPC <strong className="text-text">{c.priceNpc.toLocaleString("pt-BR")}</strong></span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <SectionTitle>Stats base</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {STATS.map(([label, key]) => (
              <StatBar key={key} label={label} value={c[key]} />
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
              <span className="text-text-dim uppercase tracking-wide text-[0.7rem]">Total</span>
              <strong className="tabular-nums text-cyan">{total}</strong>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <SectionTitle>Fraquezas & resistencias</SectionTitle>
          <div className="flex flex-col gap-3 text-sm">
            <TypeGroup title="Toma mais de" types={weak} />
            <TypeGroup title="Toma menos de" types={resist} />
            <TypeGroup title="Imune a" types={immune} />
          </div>
        </section>
      </div>

      {chain.length > 1 && (
        <section className="card p-5">
          <SectionTitle>Evolucao</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            {chain.map((stage, i) => (
              <div key={stage.creature.pokeId} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="pixel text-[0.55rem] text-text-dim">lvl {stage.evolveLevel ?? "?"} ›</span>
                )}
                <Link
                  href={`/dex/${stage.creature.pokeId}`}
                  className={`flex flex-col items-center rounded p-2 hover:bg-surface-2 ${
                    stage.creature.pokeId === c.pokeId ? "bg-surface-2 ring-1 ring-[color:var(--border-strong)]" : ""
                  }`}
                >
                  <Sprite src={spriteUrl(stage.creature.pokeId)} alt={stage.creature.name} size={60} />
                  <span className="text-[0.7rem]">{stage.creature.name}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5">
        <SectionTitle>Onde cacar</SectionTitle>
        {locations.length ? (
          <div className="flex flex-wrap gap-2">
            {locations.map((h) => (
              <span key={h.slug} className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>
                {h.name} · {h.area}{h.level ? ` lvl ${h.level}` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-dim">Sem ponto de hunt mapeado (boss ou exclusivo).</p>
        )}
      </section>

      <section className="card p-5">
        <SectionTitle>Drops ({loot.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.62rem] uppercase tracking-wide text-text-dim">
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
                    <td className="py-1.5">
                      {item ? (
                        <Link href={`/items/${item.id}`} className="flex items-center gap-2 hover:text-cyan">
                          <Sprite src={itemIconUrl(item)} alt="" size={22} />
                          {l.name}
                        </Link>
                      ) : (
                        l.name
                      )}
                    </td>
                    <td className="py-1.5 text-text-dim">{l.minCount === l.maxCount ? l.minCount : `${l.minCount}–${l.maxCount}`}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.chance === 0 ? "especial" : pctLabel(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle>Ataques ({moves.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.62rem] uppercase tracking-wide text-text-dim">
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
                  <td className="py-1.5">{m.name}</td>
                  <td className="py-1.5"><TypeBadge type={m.type} /></td>
                  <td className="py-1.5 text-text-dim">{m.category}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.power || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{(m.cooldownMs / 1000).toFixed(1)}s</td>
                  <td className="py-1.5 text-right tabular-nums">{m.learnLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
