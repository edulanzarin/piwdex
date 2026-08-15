import type { Metadata } from "next";
import { items } from "@/lib/data";
import { ItemsBrowser } from "@/components/items-browser";

export const metadata: Metadata = { title: "Itens" };

const ordered = [...items].sort((a, b) => a.name.localeCompare(b.name));

export default function ItemsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Indice reverso</div>
        <h1 className="pixel text-xl text-text">Itens & drops</h1>
        <p className="mt-3 text-sm text-text-dim">
          Escolha um item para ver <strong className="text-text">quem dropa</strong> e a melhor taxa de farm.
        </p>
      </div>
      <ItemsBrowser items={ordered} />
    </div>
  );
}
