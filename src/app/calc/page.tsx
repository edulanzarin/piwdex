import { Suspense } from "react";
import type { Metadata } from "next";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { CalcTool, type CalcSpecies } from "@/components/calc-tool";
import { Panel, SkeletonForm } from "@/components/ui";

export const metadata: Metadata = {
  title: "Calculadora",
  description:
    "Estima o IV de um pokémon do Poke Idle World a partir dos stats, do nível e " +
    "da quality, e projeta os stats e o poder em qualquer nível.",
};

export const revalidate = 3600;

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
      <h1 className="pix text-[22px] text-text">Calculadora</h1>

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
