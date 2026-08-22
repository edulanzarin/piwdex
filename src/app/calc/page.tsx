import { Suspense } from "react";
import type { Metadata } from "next";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { CalcTool, type CalcSpecies } from "@/components/calc-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_CALC } from "@/lib/how-to";
import { HeroFerramenta, HeroMarca } from "@/components/hero-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/calc" },
  title: "Calculadora de IV, Quality e Poder",
  description:
    "Estima o IV de um pokémon do Poke Idle World a partir dos stats, do nível e " +
    "da quality, e projeta os stats e o poder em qualquer nível.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function CalcPage() {
  const t0 = agora();
  const { entries } = await getDexPayload();

  // O `DexEntry` inteiro carrega loot, fraquezas e haystack — nada disso entra
  // numa conta de IV. A calculadora precisa de seis bases e do nome, entao o
  // payload e fatiado aqui em vez de mandar 482 entradas cheias pro navegador.
  const especies: CalcSpecies[] = entries.map((e) => ({
    id: e.id,
    name: e.name,
    bases: e.stats,
    type1: e.type1,
    type2: e.type2,
    rarity: e.rarity,
  }));

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <HeroFerramenta
        href="/calc"
        marcas={
          <HeroMarca n={especies.length} cor="var(--color-t-calc)">
            espécies
          </HeroMarca>
        }
      />

      {/* O manual vem ANTES do formulario porque e ele que diz de onde saem os
          numeros que o formulario pede. Fechado, ele custa uma faixa de 40px. */}
      <HowTo {...COMO_USAR_CALC} tint="var(--color-t-calc)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">O pokémon</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <CalcTool especies={especies} />
      </Suspense>
    </div>
  );
}
