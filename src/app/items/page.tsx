import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { ItemsBrowser } from "@/components/items-browser";
import { ToolFrame } from "@/components/tool-frame";
import { NavItems } from "@/components/nav-icons";
import { T, TB } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Itens" };

export default async function ItemsPage() {
  const { items } = await getData();
  const ordered = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ToolFrame accent="var(--green)" label="ITENS" icon={<NavItems size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="pixel text-3xl" style={{ color: "var(--green)" }}><T k="items.title" /></h1>
          <p className="mt-3 text-sm text-text-dim">
            <TB k="items.subtitle" bKey="items.subtitleB" />
          </p>
        </div>
        <ItemsBrowser items={ordered} />
      </div>
    </ToolFrame>
  );
}
