import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { ItemsBrowser } from "@/components/items-browser";
import { T, TB } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Itens" };

export default async function ItemsPage() {
  const { items } = await getData();
  const ordered = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="pixel text-3xl break-words" style={{ color: "var(--green)" }}><T k="items.title" /></h1>
        {/* mesma medida das outras ferramentas (hunt/calc/breed/eevee): base 16px,
            largura de leitura fechada em max-w-2xl */}
        <p className="mt-3 max-w-2xl text-base text-text-dim">
          <TB k="items.subtitle" bKey="items.subtitleB" />
        </p>
      </div>
      <ItemsBrowser items={ordered} />
    </div>
  );
}
