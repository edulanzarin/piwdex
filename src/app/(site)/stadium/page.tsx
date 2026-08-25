import { Suspense } from "react";
import type { Metadata } from "next";
import { getStadiumPayload } from "@/lib/stadium-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { StadiumTool } from "@/components/stadium-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_STADIUM } from "@/lib/how-to";
import { HeroFerramenta } from "@/components/hero-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/stadium" },
  // "boss poke idle world" e busca de intencao clara, e quem procura quer saber
  // com que time encarar — nao a lista de bosses.
  title: "Stadium do Poke Idle World — time contra boss",
  description:
    "Monte o time de seis e veja o combate contra o boss simulado inteiro: quanto cada um " +
    "tira, quem cai e onde o time quebra. Os bosses do jogo com o nível oficial de cada um.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function StadiumPage() {
  const t0 = agora();
  const payload = await getStadiumPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <HeroFerramenta href="/stadium" />

      <HowTo {...COMO_USAR_STADIUM} tint="var(--color-t-stadium)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">A arena</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <StadiumTool
          mons={payload.mons}
          bosses={payload.bosses}
          bossesGeradoEm={payload.bossesGeradoEm}
        />
      </Suspense>
    </div>
  );
}
