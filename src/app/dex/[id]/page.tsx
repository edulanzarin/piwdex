import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { spriteUrl, itemIconUrl } from "@/lib/sprites";
import { defensiveDetailed, offensiveDetailed } from "@/lib/typing";
import type { TypeMult } from "@/lib/typing";
import { TypeBadge, TypeBadges, TypePill } from "@/components/badges";
import { Sprite } from "@/components/sprite";
import { HeroSprite } from "@/components/hero-sprite";
import { Gold } from "@/components/icons";
import { Reveal } from "@/components/reveal";

export async function generateStaticParams() {
  const { creatures } = await getData();
  return creatures.map((c) => ({ id: String(c.pokeId) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { getCreature } = await getData();
  const c = getCreature(Number(id));
  return { title: c ? `${c.name} #${c.pokeId}` : "Pokemon" };
}

const STATS = [
  ["HP", "baseHp"], ["ATK", "baseAtk"], ["DEF", "baseDef"],
  ["SP.ATK", "baseSpAtk"], ["SP.DEF", "baseSpDef"], ["SPEED", "baseSpeed"],
] as const;

const MAX_STAT = 200;

function StatBar({ label, value, best }: { label: string; value: number; best: boolean }) {
  const pct = Math.min(100, (value / MAX_STAT) * 100);
  const hue = Math.round((Math.min(value, MAX_STAT) / MAX_STAT) * 130);
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-[0.6rem] text-text-dim uppercase tracking-wide">{label}</div>
      <div className={`w-9 shrink-0 text-right text-sm font-bold tabular-nums ${best ? "text-yellow" : ""}`}>{value}</div>
      <div className="statbar flex-1">
        <div className="statbar-fill" style={{ width: `${pct}%`, background: `hsl(${hue} 68% 48%)` }} />
      </div>
    </div>
  );
}

// Pin pixel simples pra "onde cacar".
function MapPin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges" style={{ imageRendering: "pixelated", flexShrink: 0 }} aria-hidden="true">
      {["..###...", ".#####..", "#######.", "#######.", "#######.", ".#####..", "..###...", "...#...."].flatMap((row, y) =>
        row.split("").map((ch, x) => (ch === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
      <rect x={3} y={2} width={2} height={2} fill="#0a1020" />
    </svg>
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

function EffRow({ title, entries, empty }: { title: string; entries: TypeMult[]; empty: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-x-3 gap-y-1">
      <span className="pt-1 text-[0.68rem] uppercase tracking-wide text-text-dim">{title}</span>
      {entries.length ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((e) => (
            <TypePill key={e.type} type={e.type} mult={e.label} />
          ))}
        </div>
      ) : (
        <span className="pt-1 text-sm text-text-dim">{empty}</span>
      )}
    </div>
  );
}

// Papel do pokemon a partir dos bases — rotulos rapidos pra preencher o cabecalho.
function roleTags(c: {
  baseHp: number; baseAtk: number; baseDef: number;
  baseSpAtk: number; baseSpDef: number; baseSpeed: number;
}): string[] {
  const tags: string[] = [];
  const phys = c.baseAtk, spec = c.baseSpAtk;
  if (phys >= spec + 15) tags.push("Atacante fisico");
  else if (spec >= phys + 15) tags.push("Atacante especial");
  else if (phys >= 90 && spec >= 90) tags.push("Atacante misto");
  const bulk = c.baseHp + c.baseDef + c.baseSpDef;
  if (bulk >= 300) tags.push("Tanque");
  if (c.baseSpeed >= 110) tags.push("Veloz");
  else if (c.baseSpeed <= 45) tags.push("Lento");
  return tags.slice(0, 3);
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { getCreature, evolutionChainOf, locationsOf, getItemByName } = await getData();
  const c = getCreature(Number(id));
  if (!c) notFound();

  const total = c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed;
  const bestStat = Math.max(c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed);
  const { weak, resist, immune } = defensiveDetailed(c.type1, c.type2);
  const offensive = offensiveDetailed(c.type1, c.type2);
  const chain = evolutionChainOf(c);
  const locations = locationsOf(c);
  const loot = [...(c.loot ?? [])].sort((a, b) => b.chance - a.chance);
  const moves = [...(c.attacks ?? [])].sort((a, b) => a.learnLevel - b.learnLevel);
  const bestMove = moves.reduce<typeof moves[number] | null>((best, m) => (m.power > (best?.power ?? 0) ? m : best), null);
  const roles = roleTags(c);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dex" className="text-[0.7rem] text-text-dim hover:text-cyan uppercase tracking-wide">
        ‹ Pokedex
      </Link>

      {/* Cabecalho */}
      <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <HeroSprite pokeId={c.pokeId} name={c.name} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="pixel text-[0.62rem] text-text-dim">#{String(c.pokeId).padStart(3, "0")}</div>
          <h1 className="pixel text-lg text-text">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadges t1={c.type1} t2={c.type2} />
          </div>
          <p className="text-sm text-text-dim">{c.description}</p>

          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span key={r} className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{r}</span>
              ))}
            </div>
          )}

          {/* grade de mini-stats — preenche o cabecalho com dado util */}
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Total base" value={<span className="text-cyan">{total}</span>} />
            <MiniStat label="Hunt lvl" value={c.huntLevel} />
            <MiniStat label="XP" value={c.experience.toLocaleString("pt-BR")} />
            <MiniStat
              label="Valor"
              value={<Gold value={c.sellValue > 0 ? c.sellValue : c.priceNpc} />}
              hint="ouro ao vender o pokemon"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-5">
          <SectionTitle>Stats base</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {STATS.map(([label, key]) => (
              <StatBar key={key} label={label} value={c[key]} best={c[key] === bestStat} />
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
              <span className="text-text-dim uppercase tracking-wide text-[0.7rem]">Total</span>
              <strong className="tabular-nums text-cyan">{total}</strong>
            </div>
            {bestMove && bestMove.power > 0 && (
              <div className="mt-1 flex items-center justify-between text-[0.7rem] text-text-dim">
                <span>Golpe mais forte</span>
                <span className="text-text">{bestMove.name} <span className="text-yellow">{bestMove.power}</span></span>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="card p-5">
          <SectionTitle>Tipagem em combate</SectionTitle>
          <div className="mb-2 text-[0.6rem] uppercase tracking-wide text-text-dim">Defesa — como ELE recebe dano</div>
          <div className="flex flex-col gap-3 text-sm">
            <EffRow title="Toma mais de" entries={weak} empty="Nao tem fraqueza." />
            <EffRow title="Toma menos de" entries={resist} empty="Nao resiste nada." />
            <EffRow title="Imune a" entries={immune} empty="—" />
          </div>
          <div className="my-4 border-t border-border" />
          <div className="mb-2 text-[0.6rem] uppercase tracking-wide text-text-dim">Ataque — golpes do tipo dele (STAB)</div>
          <div className="flex flex-col gap-3 text-sm">
            <EffRow title="Forte contra" entries={offensive} empty="Nenhum tipo recebe dano extra." />
          </div>
        </Reveal>
      </div>

      <div className={`grid gap-5 ${chain.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {chain.length > 1 && (
          <Reveal className="card flex flex-col p-5">
            <SectionTitle>Evolucao</SectionTitle>
            <div className="flex flex-1 flex-wrap items-center justify-center gap-3">
              {chain.map((stage, i) => (
                <div key={stage.creature.pokeId} className="flex items-center gap-3">
                  {i > 0 && (
                    <span className="pixel text-[0.55rem] text-text-dim">lvl {stage.evolveLevel ?? "?"} ›</span>
                  )}
                  <Link
                    href={`/dex/${stage.creature.pokeId}`}
                    className={`flex flex-col items-center rounded p-2 hover:bg-surface-2 ${
                      stage.creature.pokeId === c.pokeId ? "bg-surface-2 ring-1 ring-[color:var(--border-strong)]" : ""
                    }`}
                  >
                    <Sprite src={spriteUrl(stage.creature.pokeId)} alt={stage.creature.name} size={68} />
                    <span className="text-[0.72rem]">{stage.creature.name}</span>
                  </Link>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal className="card p-5">
          <SectionTitle>Onde cacar</SectionTitle>
          {locations.length ? (
            <div className="flex flex-col gap-2">
              {locations.map((h) => (
                <div key={h.slug} className="flex items-center gap-3 rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2">
                  <span className="text-red"><MapPin size={18} /></span>
                  <div className="flex flex-col">
                    <span className="text-sm text-text">{h.name}</span>
                    <span className="text-[0.68rem] uppercase tracking-wide text-text-dim">{h.area}</span>
                  </div>
                  {h.level ? (
                    <span className="chip ml-auto" style={{ background: "var(--surface-2)", color: "var(--text)" }}>lvl {h.level}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-dim">Sem ponto de hunt mapeado (boss ou exclusivo).</p>
          )}
        </Reveal>
      </div>

      <Reveal className="card p-5">
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
      </Reveal>

      <Reveal className="card p-5">
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
      </Reveal>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-3 py-2" title={hint}>
      <div className="text-[0.55rem] uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
