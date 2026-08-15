import type { Metadata } from "next";
import { creatures } from "@/lib/data";
import { DexBrowser } from "@/components/dex-browser";

export const metadata: Metadata = { title: "Pokedex" };

// Ordena por pokeId pra dar a ordem natural de dex.
const ordered = [...creatures].sort((a, b) => a.pokeId - b.pokeId);

export default function DexPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Pokedex</h1>
      <DexBrowser creatures={ordered} />
    </div>
  );
}
