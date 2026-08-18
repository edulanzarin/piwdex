import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import { Sprite } from "@/components/sprite";
import { DropSourcesTable } from "@/components/drop-sources-table";
import { ToolFrame } from "@/components/tool-frame";
import { NavItems } from "@/components/nav-icons";
import { Gold, ChevronLeft } from "@/components/icons";
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
    // mesma moldura verde da lista /items: a ficha nao e uma pagina "solta" da ferramenta
    <ToolFrame accent="var(--green)" label="ITENS" icon={<NavItems size={13} />}>
    <div className="flex flex-col gap-5">
      <Link href="/items" className="inline-flex items-center gap-1 text-base text-text-dim hover:text-cyan uppercase tracking-wide">
        <ChevronLeft size={10} /> <T k="item.back" />
      </Link>

      <div className="card flex items-center gap-4 p-6">
        <span className="well flex h-20 w-20 shrink-0 items-center justify-center">
          <Sprite src={itemIconUrl(item)} alt={item.name} size={48} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="pixel text-2xl break-words text-text">{item.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-dim">
            <span className="chip" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{item.category}</span>
            {item.rare && <span className="text-yellow text-base uppercase"><T k="items.rare" /></span>}
            <span className="inline-flex items-center gap-1 text-green">
              <Gold value={item.npcPrice} />
            </span>
            {item.healAmount ? <span>cura {item.healAmount}</span> : null}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="section-title text-green"><T k="item.whereDrops" /> ({sources.length})</h2>
        <p className="mb-4 mt-2 text-sm text-text-dim">
          <T k="item.whereDropsHint" />
        </p>

        {sources.length === 0 ? (
          <div className="rounded bg-[var(--well-bg)] p-6 text-center text-sm text-text-dim">
            <T k="item.noDrop" />
          </div>
        ) : (
          <DropSourcesTable
            sources={sources.map(({ creature, chancePct, minCount, maxCount }) => ({
              pokeId: creature.pokeId,
              name: creature.name,
              type1: creature.type1,
              type2: creature.type2,
              huntLevel: creature.huntLevel,
              chancePct,
              minCount,
              maxCount,
            }))}
          />
        )}
      </section>
    </div>
    </ToolFrame>
  );
}
