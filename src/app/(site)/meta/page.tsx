import { Suspense } from "react";
import type { Metadata } from "next";
import { getMetaPayload } from "@/lib/meta-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { MetaTool } from "@/components/meta-tool";
import { HowTo, Panel, SkeletonForm } from "@/components/ui";
import { COMO_USAR_META } from "@/lib/how-to";
import { HeroFerramenta, HeroMarca } from "@/components/hero-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/meta" },
  // "tier list poke idle world" e busca de intencao clara, e o titulo nao
  // encostava no nome do jogo.
  title: "Tier list do Poke Idle World — duelo e tipos",
  description:
    "Quem presta no Poke Idle World: tier list por nota (dano por segundo e HP efetivo, " +
    "não poder de golpe), duelo entre dois pokémon com nível e quality, e o panorama " +
    "ofensivo de cada tipo.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function MetaPage() {
  const t0 = agora();
  const { mons } = await getMetaPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <HeroFerramenta
        href="/meta"
        marcas={
          <HeroMarca n={mons.length} cor="var(--color-t-meta)">
            na lista
          </HeroMarca>
        }
      />

      <HowTo {...COMO_USAR_META} tint="var(--color-t-meta)" />

      <Suspense
        fallback={
          <Panel title={<span className="pix">Tier list</span>}>
            <SkeletonForm />
          </Panel>
        }
      >
        <MetaTool mons={mons} />
      </Suspense>
    </div>
  );
}
