import { Suspense } from "react";
import type { Metadata } from "next";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { BreedTool, type BreedSpecies } from "@/components/breed-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_BREED } from "@/lib/how-to";

export const metadata: Metadata = {
  alternates: { canonical: "/breed" },
  title: "Breeding: o par, o ovo e quantos faltam",
  description:
    "Simula o ovo do Poke Idle World: valida o par, mostra o sorteio de Quality, o IV " +
    "que o filho herda e o custo — e calcula quantos breeds faltam até a Quality alvo.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function BreedPage() {
  const t0 = agora();
  const { entries } = await getDexPayload();

  // Mesmo corte da calculadora: o breeding precisa das seis bases e do nome, e
  // nada de loot, fraqueza ou haystack. Mandar o `DexEntry` inteiro seria ~1MB
  // pra uma tela que so projeta stats.
  const especies: BreedSpecies[] = entries.map((e) => ({
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
      <h1 className="pix text-[22px] text-text">Breeding</h1>

      <HowTo {...COMO_USAR_BREED} tint="var(--color-t-breed)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">Os dois pais</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <BreedTool especies={especies} />
      </Suspense>
    </div>
  );
}
