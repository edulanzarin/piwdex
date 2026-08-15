import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { DexBrowser } from "@/components/dex-browser";

export const metadata: Metadata = { title: "Pokedex" };

export default async function DexPage() {
  const { creatures } = await getData();
  // Ordena por pokeId pra dar a ordem natural de dex.
  const ordered = [...creatures].sort((a, b) => a.pokeId - b.pokeId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Poke Idle World</div>
        <h1 className="pixel text-xl text-text">Pokedex</h1>
      </div>
      <DexBrowser creatures={ordered} />
    </div>
  );
}
