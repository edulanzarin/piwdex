import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dropSourcesOf, getItem, items } from "@/lib/data";
import { itemIconUrl, spriteUrl } from "@/lib/sprites";
import { RarityBadge, TypeBadges } from "@/components/badges";

export function generateStaticParams() {
  return items.map((i) => ({ id: String(i.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = getItem(Number(id));
  return { title: item ? item.name : "Item" };
}

function pctLabel(p: number): string {
  if (p >= 10) return `${p.toFixed(1)}%`;
  if (p >= 1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  return `${p.toFixed(4)}%`;
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getItem(Number(id));
  if (!item) notFound();

  const sources = dropSourcesOf(item.name); // ja ordenado por maior chance

  return (
    <div className="flex flex-col gap-6">
      <Link href="/items" className="text-sm text-text-dim hover:text-text">
        ← Itens
      </Link>

      <div className="card flex items-center gap-4 p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={itemIconUrl(item)} alt={item.name} width={48} height={48} className="pixelated" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-dim">
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text)", textShadow: "none" }}>
              {item.category}
            </span>
            {item.rare && <span className="text-accent font-semibold">raro</span>}
            <span>NPC {item.npcPrice.toLocaleString("pt-BR")}</span>
            {item.healAmount ? <span>cura {item.healAmount}</span> : null}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">
          Onde dropa <span className="text-text-dim font-normal">({sources.length} fontes)</span>
        </h2>
        <p className="mb-4 text-sm text-text-dim">
          Ordenado da maior para a menor chance — comece a farmar pelo topo.
        </p>

        {sources.length === 0 ? (
          <div className="rounded-lg bg-surface-2 p-6 text-center text-sm text-text-dim">
            Nenhum pokemon dropa este item (compra de NPC, craft ou boss).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-dim">
                  <th className="pb-2 font-medium">Pokemon</th>
                  <th className="pb-2 font-medium">Tipos</th>
                  <th className="pb-2 text-right font-medium">Hunt lvl</th>
                  <th className="pb-2 text-right font-medium">Qtd</th>
                  <th className="pb-2 text-right font-medium">Chance</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(({ creature, chancePct, minCount, maxCount }) => (
                  <tr key={creature.pokeId} className="border-t border-border">
                    <td className="py-2">
                      <Link href={`/dex/${creature.pokeId}`} className="flex items-center gap-2 hover:text-accent">
                        {spriteUrl(creature.pokeId) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={spriteUrl(creature.pokeId)!} alt="" width={32} height={32} className="pixelated h-8 w-8" />
                        )}
                        <span>{creature.name}</span>
                        <RarityBadge rarity={creature.rarity} />
                      </Link>
                    </td>
                    <td className="py-2"><TypeBadges t1={creature.type1} t2={creature.type2} /></td>
                    <td className="py-2 text-right tabular-nums">{creature.huntLevel}</td>
                    <td className="py-2 text-right text-text-dim">
                      {minCount === maxCount ? minCount : `${minCount}–${maxCount}`}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {chancePct === 0 ? "especial" : pctLabel(chancePct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
