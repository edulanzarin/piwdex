import { Suspense } from "react";
import type { Metadata } from "next";
import { getTmPayload } from "@/lib/tm-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { TmTool } from "@/components/tm-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_TM } from "@/lib/how-to";
import { HeroFerramenta } from "@/components/hero-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/tm" },
  // Quem procura "tm poke idle world" tem uma pergunta so, e ela e de escolha:
  // qual disco. O titulo responde antes do clique.
  title: "TM do Poke Idle World — qual disco trocar, e em quem",
  description:
    "Todo golpe de TM faz 60 de poder por segundo e o melhor natural do jogo faz 43,3. " +
    "Veja quais espécies aprendem cada disco, quanto cada uma ganha e quem muda de tier.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function TmPage() {
  const t0 = agora();
  const payload = await getTmPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <HeroFerramenta href="/tm" />

      <HowTo {...COMO_USAR_TM} tint="var(--color-t-tm)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">Os discos</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <TmTool mons={payload.mons} discos={payload.discos} />
      </Suspense>
    </div>
  );
}
