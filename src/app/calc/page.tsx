import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { Calculator, type CalcCreature } from "@/components/calculator";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Calculadora de IV" };

export default async function CalcPage() {
  const { creatures } = await getData();
  // Lista enxuta pro cliente: so o que a calculadora precisa.
  const slim: CalcCreature[] = creatures
    .map((c) => ({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      bases: [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2"><T k="calc.eyebrow" /></div>
        <h1 className="pixel text-xl text-text"><T k="calc.title" /></h1>
        <p className="mt-3 max-w-2xl text-sm text-text-dim">
          <T k="calc.desc" />
        </p>
      </div>
      <Calculator creatures={slim} />
    </div>
  );
}
