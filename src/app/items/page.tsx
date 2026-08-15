import type { Metadata } from "next";
import { items } from "@/lib/data";
import { ItemsBrowser } from "@/components/items-browser";

export const metadata: Metadata = { title: "Itens" };

const ordered = [...items].sort((a, b) => a.name.localeCompare(b.name));

export default function ItemsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Itens & drops</h1>
      <p className="text-text-dim">
        Escolha um item para ver <strong>quem dropa</strong> e a melhor taxa de farm.
      </p>
      <ItemsBrowser items={ordered} />
    </div>
  );
}
