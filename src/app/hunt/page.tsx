import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import { HuntPlanner, type HuntRow } from "@/components/hunt-planner";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Hunt Planner" };

export default async function HuntPage() {
  const db = await getData();
  const { creatures, hunts } = db;

  const areas = [...new Set(hunts.map((h) => h.area))].sort();

  const rows: HuntRow[] = [];
  for (const c of creatures) {
    const locs = db.locationsOf(c);
    if (locs.length === 0) continue; // so pokemon com ponto de hunt mapeado

    // Ouro esperado por kill = valor esperado do loot (chance x qtd media x preco NPC).
    // Melhor drop = o item de maior valor que ele solta.
    let gold = 0;
    let top: { name: string; icon: string; price: number } | null = null;
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      const price = it?.npcPrice ?? 0;
      const prob = l.chance / 100000; // chance vem em escala 0..100000
      const avg = (l.minCount + l.maxCount) / 2;
      gold += prob * avg * price;
      if (it && price > 0 && (!top || price > top.price)) {
        top = { name: it.name, icon: itemIconUrl(it), price };
      }
    }

    rows.push({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      xp: c.experience,
      gold: Math.round(gold),
      sell: c.sellValue,
      huntLevel: c.huntLevel,
      areas: [...new Set(locs.map((h) => h.area))].sort(),
      spotCount: locs.length,
      topDrop: top ? { name: top.name, icon: top.icon } : null,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2"><T k="hunt.eyebrow" /></div>
        <h1 className="pixel text-xl text-text"><T k="hunt.title" /></h1>
        <p className="mt-3 max-w-2xl text-sm text-text-dim">
          <T k="hunt.desc" />
        </p>
      </div>
      <HuntPlanner rows={rows} areas={areas} />
    </div>
  );
}
