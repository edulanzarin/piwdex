import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { BreedTool } from "@/components/breed-tool";
import type { ComboCreature } from "@/components/pokemon-combobox";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Breeding Simulator" };

export default async function BreedPage() {
  const { creatures } = await getData();
  // Lista enxuta pro seletor de especie (so o que a colecao/simulador precisa).
  const slim: ComboCreature[] = creatures
    .map((c) => ({ pokeId: c.pokeId, name: c.name, type1: c.type1, type2: c.type2 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2"><T k="breed.eyebrow" /></div>
        <h1 className="pixel inline-flex flex-wrap items-center gap-2 text-xl text-text">
          <T k="breed.title" />
          <span className="chip" style={{ background: "var(--purple)", color: "#1a1030" }}><T k="breed.alpha" /></span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-dim"><T k="breed.desc" /></p>
      </div>
      <BreedTool creatures={slim} />
    </div>
  );
}
