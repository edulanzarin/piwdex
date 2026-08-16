import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getData } from "@/lib/data";
import { ToolFrame } from "@/components/tool-frame";
import { type MarketDex } from "@/components/market-advisor";
import { VipTabs } from "@/components/vip-tabs";
import { VipPaywall } from "@/components/vip-paywall";
import type { ComboCreature } from "@/components/pokemon-combobox";
import { Star } from "@/components/icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "VIP" };

const ACCENT = "#f0c83c";

export default async function VipPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  const { status } = await searchParams;

  // Sem VIP: paywall.
  if (!session.user.vip) {
    return (
      <ToolFrame accent={ACCENT} label="VIP" icon={<Star size={13} />}>
        <VipPaywall status={status ?? null} />
      </ToolFrame>
    );
  }

  // VIP ativo: consultor de mercado (+ robo em breve).
  const { creatures } = await getData();
  const slim: ComboCreature[] = creatures
    .map((c) => ({ pokeId: c.pokeId, name: c.name, type1: c.type1, type2: c.type2 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Stats base por especie, pro modal de detalhe de cada anuncio do mercado.
  const dex: Record<number, MarketDex> = {};
  for (const c of creatures) {
    dex[c.pokeId] = {
      type1: c.type1, type2: c.type2, rarity: c.rarity,
      baseHp: c.baseHp, baseAtk: c.baseAtk, baseDef: c.baseDef,
      baseSpAtk: c.baseSpAtk, baseSpDef: c.baseSpDef, baseSpeed: c.baseSpeed,
      huntLevel: c.huntLevel,
    };
  }

  return (
    <ToolFrame accent={ACCENT} label="VIP" icon={<Star size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-2"><T k="vip.eyebrow" /></div>
          <h1 className="pixel text-xl" style={{ color: ACCENT }}><T k="vip.active.title" /></h1>
          <p className="mt-3 max-w-2xl text-sm text-text-dim"><T k="vip.active.desc" /></p>
        </div>

        <VipTabs creatures={slim} dex={dex} />
      </div>
    </ToolFrame>
  );
}
