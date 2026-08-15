import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { itemIconUrl, spriteUrl } from "@/lib/sprites";
import { TypeBadges } from "@/components/badges";
import { Sprite } from "@/components/sprite";
import { Gold } from "@/components/icons";
import { T } from "@/components/locale-provider";

export async function generateStaticParams() {
  const { items } = await getData();
  return items.map((i) => ({ id: String(i.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { getItem } = await getData();
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
  const { getItem, dropSourcesOf } = await getData();
  const item = getItem(Number(id));
  if (!item) notFound();

  const sources = dropSourcesOf(item.name);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/items" className="text-[0.7rem] text-text-dim hover:text-cyan uppercase tracking-wide">
        ‹ <T k="item.back" />
      </Link>

      <div className="card flex items-center gap-4 p-6">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[rgba(8,14,28,0.6)]">
          <Sprite src={itemIconUrl(item)} alt={item.name} size={48} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="pixel text-base text-text">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-dim">
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{item.category}</span>
            {item.rare && <span className="text-yellow font-semibold text-[0.7rem] uppercase"><T k="items.rare" /></span>}
            <span className="inline-flex items-center gap-1 text-yellow">
              <Gold value={item.npcPrice} />
            </span>
            {item.healAmount ? <span>cura {item.healAmount}</span> : null}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="pixel text-[0.72rem] text-green"><T k="item.whereDrops" /> ({sources.length})</h2>
        <p className="mb-4 mt-2 text-sm text-text-dim">
          <T k="item.whereDropsHint" />
        </p>

        {sources.length === 0 ? (
          <div className="rounded bg-[rgba(8,14,28,0.6)] p-6 text-center text-sm text-text-dim">
            <T k="item.noDrop" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.62rem] uppercase tracking-wide text-text-dim">
                  <th className="pb-2 font-medium"><T k="col.pokemon" /></th>
                  <th className="pb-2 font-medium"><T k="col.types" /></th>
                  <th className="pb-2 text-right font-medium"><T k="col.huntLvl" /></th>
                  <th className="pb-2 text-right font-medium"><T k="col.qty" /></th>
                  <th className="pb-2 text-right font-medium"><T k="col.chance" /></th>
                </tr>
              </thead>
              <tbody>
                {sources.map(({ creature, chancePct, minCount, maxCount }) => (
                  <tr key={creature.pokeId} className="group cursor-pointer border-t border-border hover:bg-surface-2">
                    <td className="py-1.5">
                      <Link href={`/dex/${creature.pokeId}`} className="flex items-center gap-2 text-cyan group-hover:underline">
                        <Sprite src={spriteUrl(creature.pokeId)} alt="" size={30} />
                        <span>{creature.name}</span>
                        <span className="text-[0.6rem] text-text-dim opacity-0 transition group-hover:opacity-100">›</span>
                      </Link>
                    </td>
                    <td className="py-1.5"><TypeBadges t1={creature.type1} t2={creature.type2} /></td>
                    <td className="py-1.5 text-right tabular-nums">{creature.huntLevel}</td>
                    <td className="py-1.5 text-right text-text-dim">{minCount === maxCount ? minCount : `${minCount}–${maxCount}`}</td>
                    <td className="py-1.5 text-right tabular-nums">{chancePct === 0 ? <T k="special" /> : pctLabel(chancePct)}</td>
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
