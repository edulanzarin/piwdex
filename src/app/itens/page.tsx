import { Suspense } from "react";
import type { Metadata } from "next";
import { getItemsPayload } from "@/lib/items-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { ItemsBrowser } from "@/components/items-browser";
import { Panel, SkeletonItemGrid } from "@/components/ui";
import { Package } from "lucide-react";
import { TituloFerramenta } from "@/components/titulo-ferramenta";

export const metadata: Metadata = {
  alternates: { canonical: "/itens" },
  title: "Itens do Poke Idle World",
  description:
    "Catálogo de itens do Poke Idle World com o índice reverso: quem dropa cada " +
    "item, com que chance real, a partir de que nível dá pra farmar e quanto o " +
    "item rende de ouro por abate.",
};

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function ItensPage() {
  const t0 = agora();
  const { entries, bounds, dexIndex, catalog } = await getItemsPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <TituloFerramenta
        arte="itens"
        cor="var(--color-t-itens)"
        reserva={<Package size={26} strokeWidth={1.8} style={{ color: "var(--color-t-itens)" }} />}
      >
        Itens
      </TituloFerramenta>

      <Suspense
        fallback={
          <SkeletonItemGrid count={10} />
        }
      >
        <ItemsBrowser
          entries={entries}
          bounds={bounds}
          dexIndex={dexIndex}
          catalog={catalog}
        />
      </Suspense>
    </div>
  );
}
