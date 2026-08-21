import { Suspense } from "react";
import type { Metadata } from "next";
import { getItemsPayload } from "@/lib/items-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { ItemsBrowser } from "@/components/items-browser";
import { Panel, SkeletonGrid } from "@/components/ui";

export const metadata: Metadata = {
  title: "Itens",
  description:
    "Catálogo de itens do Poke Idle World com o índice reverso: quem dropa cada " +
    "item, com que chance real, a partir de que nível dá pra farmar e quanto o " +
    "item rende de ouro por abate.",
};

export const revalidate = 3600;

export default async function ItensPage() {
  const t0 = agora();
  const { entries, bounds, dexIndex, catalog } = await getItemsPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pix text-[22px] text-text">Itens</h1>

      <Suspense
        fallback={
          <Panel>
            <SkeletonGrid count={10} />
          </Panel>
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
