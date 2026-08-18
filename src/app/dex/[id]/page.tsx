import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { spriteUrl, itemIconUrl } from "@/lib/sprites";
import { defensiveDetailed, offensiveDetailed } from "@/lib/typing";
import type { TypeMult } from "@/lib/typing";
import { TypeBadge, TypeBadges, TypePill } from "@/components/badges";
import { AcqBadge } from "@/components/acq-badge";
import { StatBar } from "@/components/stat-bar";
import { CASINO_PRICE } from "@/lib/casino-prices";
import { Sprite } from "@/components/sprite";
import { HeroSprite } from "@/components/hero-sprite";
import { StatTile } from "@/components/stat-tile";
import { Gold, Xp, ChevronLeft, ChevronRight } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { PokedexShell } from "@/components/pokedex-shell";
import { T } from "@/components/locale-provider";

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
  return <h2 className="section-title mb-4 text-cyan">{children}</h2>;
}

function EffRow({ titleKey, entries, emptyKey }: { titleKey: string; entries: TypeMult[]; emptyKey: string }) {
  // degrau mobile: rotulo em cima das pills no celular, coluna fixa so a partir do sm
  return (
    <div className="grid grid-cols-1 items-start gap-x-3 gap-y-1 sm:grid-cols-[7.5rem_1fr]">
      <span className="pt-1 text-base uppercase tracking-wide text-text-dim"><T k={titleKey} /></span>
      {entries.length ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((e) => (
            <TypePill key={e.type} type={e.type} mult={e.label} />
          ))}
        </div>
      ) : (
        <span className="pt-1 text-sm text-text-dim"><T k={emptyKey} /></span>
      )}
    </div>
  );
}

// Papel do pokemon a partir dos bases — devolve CHAVES de traducao.
function roleTags(c: {
  baseHp: number; baseAtk: number; baseDef: number;
  baseSpAtk: number; baseSpDef: number; baseSpeed: number;
}): string[] {
  const tags: string[] = [];
  const phys = c.baseAtk, spec = c.baseSpAtk;
  if (phys >= spec + 15) tags.push("cr.role.phys");
  else if (spec >= phys + 15) tags.push("cr.role.spec");
  else if (phys >= 90 && spec >= 90) tags.push("cr.role.mixed");
  const bulk = c.baseHp + c.baseDef + c.baseSpDef;
  if (bulk >= 300) tags.push("cr.role.tank");
  if (c.baseSpeed >= 110) tags.push("cr.role.fast");
  else if (c.baseSpeed <= 45) tags.push("cr.role.slow");
  return tags.slice(0, 3);
}

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { getCreature, evolutionChainOf, locationsOf, getItemByName, acquisitionOf } = await getData();
  const c = getCreature(Number(id));
  if (!c) notFound();
  const acq = acquisitionOf(c);
  const isEevee = c.pokeId === 133; // ramifica por pedra -> estrela propria

  const total = c.baseHp + c.baseAtk + c.baseDef + c.baseSpAtk + c.baseSpDef + c.baseSpeed;
  const bestStat = Math.max(c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed);
  const { weak, resist, immune } = defensiveDetailed(c.type1, c.type2);
  const offensive = offensiveDetailed(c.type1, c.type2);
  // STAB: os proprios tipos do pokemon dao 1.5x.
  const stab: TypeMult[] = [c.type1, c.type2]
    .filter((tp): tp is NonNullable<typeof tp> => tp != null)
    .map((tp) => ({ type: tp, mult: 1.5, label: "1.5x" }));
  const chain = evolutionChainOf(c);
  const locations = locationsOf(c);
  const loot = [...(c.loot ?? [])].sort((a, b) => b.chance - a.chance);
  const moves = [...(c.attacks ?? [])].sort((a, b) => a.learnLevel - b.learnLevel);
  const bestMove = moves.reduce<typeof moves[number] | null>((best, m) => (m.power > (best?.power ?? 0) ? m : best), null);
  const roles = roleTags(c);

  return (
    <PokedexShell animate={false}>
    <div className="flex flex-col gap-6">
      <Link href="/dex" className="inline-flex items-center gap-1 text-base text-text-dim hover:text-cyan uppercase tracking-wide">
        <ChevronLeft size={10} /> <T k="cr.back" />
      </Link>

      {/* Cabecalho */}
      <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <HeroSprite pokeId={c.pokeId} name={c.name} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="pixel text-sm text-text-dim">#{String(c.pokeId).padStart(3, "0")}</div>
          <h1 className="pixel text-2xl text-text">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadges t1={c.type1} t2={c.type2} />
            <AcqBadge kind={acq} />
          </div>
          <p className="text-sm text-text-dim">{c.description}</p>

          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span key={r} className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}><T k={r} /></span>
              ))}
            </div>
          )}

          {/* grade de mini-stats — preenche o cabecalho com dado util */}
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label={<T k="cr.totalBase" />} value={total} accent="var(--cyan)" />
            <StatTile label={<T k="cr.huntLvl" />} value={c.huntLevel} accent="var(--cyan)" />
            <StatTile
              label={<T k="cr.xp" />}
              value={c.experience.toLocaleString("pt-BR")}
              icon={<Xp size={11} className="text-yellow" />}
              accent="var(--cyan)"
            />
            <StatTile
              label={<T k={CASINO_PRICE[c.pokeId] ? "cr.casino" : "cr.value"} />}
              value={<Gold value={CASINO_PRICE[c.pokeId] ?? (c.sellValue > 0 ? c.sellValue : c.priceNpc)} />}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="card p-5">
          <SectionTitle><T k="cr.statsBase" /></SectionTitle>
          <p className="-mt-2 mb-4 text-base leading-relaxed text-text-dim">
            <T k="cr.statsHint" />{" "}
            <Link href="/calc" className="inline-flex items-center gap-1 text-cyan hover:underline"><T k="cr.statsHintLink" /> <ChevronRight size={9} /></Link>
          </p>
          <div className="flex flex-col gap-2.5">
            {STATS.map(([label, key], i) => (
              <StatBar key={key} iconIndex={i} label={label} value={c[key]} best={c[key] === bestStat} />
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
              <span className="text-text-dim uppercase tracking-wide text-base"><T k="cr.total" /></span>
              <strong className="tabular-nums text-cyan">{total}</strong>
            </div>
            {bestMove && bestMove.power > 0 && (
              <div className="mt-1 flex items-center justify-between text-base text-text-dim">
                <span><T k="cr.bestMove" /></span>
                <span className="text-text">{bestMove.name} <span className="text-yellow">{bestMove.power}</span></span>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="card p-5">
          <SectionTitle><T k="cr.combat" /></SectionTitle>
          <div className="mb-2 text-sm uppercase tracking-wide text-text-dim"><T k="cr.defenseSub" /></div>
          <div className="flex flex-col gap-3 text-sm">
            <EffRow titleKey="cr.takesMore" entries={weak} emptyKey="cr.noWeak" />
            <EffRow titleKey="cr.takesLess" entries={resist} emptyKey="cr.noResist" />
            <EffRow titleKey="cr.immune" entries={immune} emptyKey="cr.immuneEmpty" />
          </div>
          <div className="my-4 border-t border-border" />
          <div className="mb-2 text-sm uppercase tracking-wide text-text-dim"><T k="cr.attackSub" /></div>
          <div className="flex flex-col gap-3 text-sm">
            <EffRow titleKey="cr.stab" entries={stab} emptyKey="cr.immuneEmpty" />
            <EffRow titleKey="cr.strongVs" entries={offensive} emptyKey="cr.noStrong" />
          </div>
        </Reveal>
      </div>

      {/* estrutura ESTAVEL entre fichas irmas: sempre 2 colunas no lg, a celula de
          evolucao existe sempre — linha unica vira o "estado" dela (nao some do grid) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {isEevee ? (
          <Reveal className="card flex flex-col p-5">
            <SectionTitle><T k="cr.evolution" /></SectionTitle>
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
              <p className="max-w-xs text-sm text-text-dim"><T k="eevee.branches" /></p>
              <Link href="/eevee" className="btn btn-cyan">
                <T k="eevee.open" /> <ChevronRight size={10} />
              </Link>
            </div>
          </Reveal>
        ) : (
          <Reveal className="card flex flex-col p-5">
            <SectionTitle><T k="cr.evolution" /></SectionTitle>
            <div className="flex flex-1 flex-wrap items-center justify-center gap-3">
              {chain.map((stage, i) => (
                <div key={stage.creature.pokeId} className="flex items-center gap-3">
                  {i > 0 && (
                    <span className="pixel inline-flex items-center gap-1 text-xs text-text-dim">lvl {stage.evolveLevel ?? "?"} <ChevronRight size={9} /></span>
                  )}
                  <Link
                    href={`/dex/${stage.creature.pokeId}`}
                    className={`flex flex-col items-center rounded p-2 hover:bg-surface-2 ${
                      stage.creature.pokeId === c.pokeId ? "bg-surface-2 ring-1 ring-[color:var(--border-strong)]" : ""
                    }`}
                  >
                    <Sprite src={spriteUrl(stage.creature.pokeId)} alt={stage.creature.name} size={68} />
                    <span className="text-base">{stage.creature.name}</span>
                  </Link>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal className="card p-5">
          <SectionTitle><T k="cr.whereHunt" /></SectionTitle>
          {locations.length ? (
            <div className="flex flex-col gap-2">
              {locations.map((h) => (
                <div key={h.slug} className="well flex items-center gap-3">
                  <span className="text-red"><MapPin size={18} /></span>
                  <div className="flex flex-col">
                    <span className="text-sm text-text">{h.name}</span>
                    <span className="text-base uppercase tracking-wide text-text-dim">{h.area}</span>
                  </div>
                  {h.level ? (
                    <span className="chip ml-auto" style={{ background: "var(--surface-2)", color: "var(--text)" }}>lvl {h.level}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AcqBadge kind={acq} className="self-start" />
              <p className="text-sm text-text-dim">
                <T k={acq === "special" ? "dex.acq.specialHint" : "dex.acq.evoHint"} />
              </p>
            </div>
          )}
        </Reveal>
      </div>

      <Reveal className="card p-5">
        <SectionTitle><T k="cr.drops" /> ({loot.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wide text-text-dim">
                <th className="pb-2 font-normal"><T k="col.item" /></th>
                <th className="pb-2 font-normal"><T k="col.qty" /></th>
                <th className="pb-2 text-right font-normal"><T k="col.chance" /></th>
              </tr>
            </thead>
            <tbody>
              {loot.map((l) => {
                const item = getItemByName(l.name);
                const p = l.chance / 1000;
                return (
                  <tr key={l.name} className={`border-t border-border ${item ? "group cursor-pointer hover:bg-surface-2" : ""}`}>
                    <td className="py-1.5">
                      {item ? (
                        <Link href={`/items/${item.id}`} className="flex items-center gap-2 text-cyan group-hover:underline">
                          <Sprite src={itemIconUrl(item)} alt="" size={22} />
                          {l.name}
                          <span className="text-text-dim opacity-0 transition group-hover:opacity-100"><ChevronRight size={10} /></span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2">{l.name}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-text-dim">{l.minCount === l.maxCount ? l.minCount : `${l.minCount}–${l.maxCount}`}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.chance === 0 ? <T k="special" /> : pctLabel(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal className="card p-5">
        <SectionTitle><T k="cr.moves" /> ({moves.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wide text-text-dim">
                <th className="pb-2 font-normal"><T k="col.name" /></th>
                <th className="pb-2 font-normal"><T k="col.type" /></th>
                <th className="pb-2 font-normal"><T k="col.cat" /></th>
                <th className="pb-2 text-right font-normal"><T k="col.power" /></th>
                <th className="pb-2 text-right font-normal"><T k="col.lvl" /></th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m, i) => (
                <tr key={`${m.name}-${i}`} className="border-t border-border">
                  <td className="py-1.5">{m.name}</td>
                  <td className="py-1.5"><TypeBadge type={m.type} /></td>
                  <td className="py-1.5 text-text-dim"><T k={`cat.${m.category}`} /></td>
                  <td className="py-1.5 text-right tabular-nums">{m.power || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.learnLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
    </PokedexShell>
  );
}
