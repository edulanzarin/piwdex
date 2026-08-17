import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { BreedTool, type BreedCreature } from "@/components/breed-tool";
import { ToolFrame } from "@/components/tool-frame";
import { NavBreed } from "@/components/nav-icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Planejador de Breeding" };

export default async function BreedPage() {
  const { creatures } = await getData();
  // Lista enxuta pro seletor de especie + bases (pra projetar os stats reais do ovo).
  const slim: BreedCreature[] = creatures
    .map((c) => ({
      pokeId: c.pokeId,
      name: c.name,
      type1: c.type1,
      type2: c.type2,
      bases: [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ToolFrame accent="var(--pink)" label="BREEDING" icon={<NavBreed size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2"><T k="breed.eyebrow" /></div>
          <h1 className="pixel inline-flex flex-wrap items-center gap-2 text-xl" style={{ color: "var(--pink)" }}>
            <T k="breed.title" />
            <span className="chip" style={{ background: "var(--pink)", color: "#2a0a12" }}><T k="breed.alpha" /></span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-text-dim"><T k="breed.desc" /></p>
        </div>
        <BreedTool creatures={slim} />
      </div>
    </ToolFrame>
  );
}
