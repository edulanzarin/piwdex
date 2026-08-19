import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { BreedTool, type BreedCreature } from "@/components/breed-tool";
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
    <div className="flex flex-col gap-6">
      {/* Cabecalho da ferramenta: sem a moldura colorida quem da corpo e o vidro do
          card — eyebrow, titulo e descricao ficam num painel so, e o conteudo
          abaixo (cards) nao fica solto na pagina. */}
      <header className="card p-5 sm:p-6">
        <p className="eyebrow"><T k="breed.eyebrow" /></p>
        <h1 className="pixel mt-1 flex flex-wrap items-center gap-2 text-3xl [overflow-wrap:anywhere]" style={{ color: "var(--brown)" }}>
          <T k="breed.title" />
          <span className="chip" style={{ background: "var(--brown)", color: "#2a1608" }}><T k="breed.alpha" /></span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-dim"><T k="breed.desc" /></p>
      </header>
      <BreedTool creatures={slim} />
    </div>
  );
}
