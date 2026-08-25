import { Suspense } from "react";
import type { Metadata } from "next";
import { getEeveePayload } from "@/lib/eevee-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { EeveeTool } from "@/components/eevee-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_EEVEE } from "@/lib/how-to";
import { HeroFerramenta } from "@/components/hero-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/eevee" },
  // "eevee poke idle world" e busca de intencao unica, e quem procura ja sabe o
  // que quer: qual pedra. O titulo entrega isso antes do clique.
  title: "Eevee do Poke Idle World — qual evolução e qual pedra",
  description:
    "As cinco trocas do Marlon com a pedra de cada uma: Flareon, Vaporeon, Jolteon, Umbreon e " +
    "Espeon. Onde farmar as dez pedras no seu nível e qual eeveelution rende mais em combate.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function EeveePage() {
  const t0 = agora();
  const payload = await getEeveePayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <HeroFerramenta href="/eevee" />

      <HowTo {...COMO_USAR_EEVEE} tint="var(--color-t-eevee)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">A estrela</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <EeveeTool mons={payload.mons} pedras={payload.pedras} />
      </Suspense>
    </div>
  );
}
