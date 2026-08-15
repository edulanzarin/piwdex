import type { Metadata } from "next";
import { creatures } from "@/lib/data";
import { Calculator, type CalcCreature } from "@/components/calculator";

export const metadata: Metadata = { title: "Calculadora de IV" };

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

export default function CalcPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Ferramenta</div>
        <h1 className="pixel text-xl text-text">Calculadora de IV</h1>
        <p className="mt-3 max-w-2xl text-sm text-text-dim">
          Informe qualidade, nivel e os stats atuais do SEU pokemon capturado — a
          calculadora estima os IVs individuais, o IV total e o poder, e projeta os
          stats em qualquer nivel. Formula verificada contra o jogo.
        </p>
      </div>
      <Calculator creatures={slim} />
    </div>
  );
}
