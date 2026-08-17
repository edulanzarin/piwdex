import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { Calculator, type CalcCreature } from "@/components/calculator";
import { ToolFrame } from "@/components/tool-frame";
import { NavCalc } from "@/components/nav-icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Analise de Status" };

export default async function CalcPage() {
  const db = await getData();
  const { creatures } = db;
  // Lista enxuta pro cliente: so o que a analise precisa (+ XP e ouro por kill).
  const slim: CalcCreature[] = creatures
    .map((c) => {
      let gold = 0;
      for (const l of c.loot) {
        const price = db.getItemByName(l.name)?.npcPrice ?? 0;
        gold += (l.chance / 100000) * ((l.minCount + l.maxCount) / 2) * price;
      }
      return {
        pokeId: c.pokeId,
        name: c.name,
        type1: c.type1,
        type2: c.type2,
        bases: [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed],
        rarity: c.rarity,
        xp: c.experience,
        goldEV: Math.round(gold),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ToolFrame accent="var(--purple)" label="CALCULADORA" icon={<NavCalc size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2"><T k="calc.eyebrow" /></div>
          <h1 className="pixel text-xl" style={{ color: "var(--purple)" }}><T k="calc.title" /></h1>
          <p className="mt-3 max-w-2xl text-sm text-text-dim">
            <T k="calc.desc" />
          </p>
        </div>
        <Calculator creatures={slim} />
      </div>
    </ToolFrame>
  );
}
