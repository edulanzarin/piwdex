import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import { enemyCombatStats, type EnemyCombat, type Species, type Move } from "@/lib/combat";
import { HuntTool } from "@/components/hunt-tool";
import type { HuntRow } from "@/components/hunt-planner";
import type { PokeType } from "@/lib/types";
import { ToolFrame } from "@/components/tool-frame";
import { NavHunt } from "@/components/nav-icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Hunt Planner" };

export default async function HuntPage() {
  const db = await getData();
  const { creatures, hunts } = db;
  const areas = [...new Set(hunts.map((h) => h.area))].sort();

  const rows: HuntRow[] = [];
  const enemies: EnemyCombat[] = [];
  const species: Species[] = [];

  for (const c of creatures) {
    const bases = [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];
    // Todo pokemon vira "especie" selecionavel (o jogador pode ter qualquer um).
    const moves: Move[] = c.attacks.map((a) => ({
      type: a.type as PokeType,
      power: a.power,
      learn: a.learnLevel,
      category: a.category,
      cooldownMs: a.cooldownMs,
    }));
    species.push({
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      bases,
      evolvesToId: c.evolvesToId,
      evolveLevel: c.evolveLevel,
      moves,
    });

    const locs = db.locationsOf(c);
    if (locs.length === 0) continue; // so quem tem spot vira alvo de hunt

    // Ouro esperado por kill (EV do loot) + melhor drop (item de maior valor).
    let gold = 0;
    let top: { name: string; icon: string; price: number } | null = null;
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      const price = it?.npcPrice ?? 0;
      gold += (l.chance / 100000) * ((l.minCount + l.maxCount) / 2) * price;
      if (it && price > 0 && (!top || price > top.price)) {
        top = { name: it.name, icon: itemIconUrl(it), price };
      }
    }
    const goldEV = Math.round(gold);
    const rowAreas = [...new Set(locs.map((h) => h.area))].sort();

    rows.push({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      xp: c.experience,
      gold: goldEV,
      sell: c.sellValue,
      huntLevel: c.huntLevel,
      areas: rowAreas,
      spotCount: locs.length,
      topDrop: top ? { name: top.name, icon: top.icon } : null,
      bases,
    });

    const hl = Math.max(1, c.huntLevel);
    const cs = enemyCombatStats(bases, hl);
    enemies.push({
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      huntLevel: hl,
      areas: rowAreas,
      spotCount: locs.length,
      xp: c.experience,
      goldEV,
      hp: cs.hp,
      def: cs.def,
      spDef: cs.spDef,
    });
  }

  return (
    <ToolFrame accent="var(--yellow)" label="HUNT" icon={<NavHunt size={16} />}>
      <div className="flex flex-col gap-6">
        <div>
          <p className="eyebrow"><T k="hunt.eyebrow" /></p>
          <h1 className="pixel mt-1 text-3xl" style={{ color: "var(--yellow)" }}><T k="hunt.title" /></h1>
          <p className="mt-3 max-w-2xl text-base text-text-dim">
            <T k="hunt.route.desc" />
          </p>
        </div>
        <HuntTool rows={rows} areas={areas} species={species} enemies={enemies} />
      </div>
    </ToolFrame>
  );
}
