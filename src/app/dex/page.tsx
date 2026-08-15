import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { DexBrowser } from "@/components/dex-browser";
import { PokedexShell } from "@/components/pokedex-shell";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Pokedex" };

export default async function DexPage() {
  const { creatures } = await getData();
  // Ordena por pokeId pra dar a ordem natural de dex.
  const ordered = [...creatures].sort((a, b) => a.pokeId - b.pokeId);
  return (
    <PokedexShell>
      <div className="flex flex-col gap-5">
        <div>
          <div className="eyebrow mb-2"><T k="dex.eyebrow" /></div>
          <h1 className="pixel text-lg text-text"><T k="dex.title" /></h1>
        </div>
        <DexBrowser creatures={ordered} />
      </div>
    </PokedexShell>
  );
}
