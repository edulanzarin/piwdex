import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getData } from "@/lib/data";
import { ToolFrame } from "@/components/tool-frame";
import { type MarketDex } from "@/components/market-advisor";
import { VipShell } from "@/components/vip-shell";
import { VipPaywall } from "@/components/vip-paywall";
import type { ComboCreature } from "@/components/pokemon-combobox";
import { Star } from "@/components/icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "VIP" };

const ACCENT = "var(--yellow)";

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

  // VIP ativo: consultor de mercado + conta + robo.
  const db = await getData();
  const { creatures, hunts, items } = db;

  // nome -> icone, pros cards de loot dos kills da Hunt. Por NOME (minusculo) porque o
  // itemId do field-kill nao bate com o id dos dados, mas o nome do drop bate.
  const itemIcons: Record<string, string> = {};
  for (const it of items) itemIcons[it.name.toLowerCase()] = it.icon;
  // catalogo enxuto de itens pro seletor de desejo de item (mercado de jogadores)
  const marketItems = [...items]
    .map((it) => ({ id: it.id, name: it.name, icon: it.icon }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const slim: ComboCreature[] = creatures
    .map((c) => ({ pokeId: c.pokeId, name: c.name, type1: c.type1, type2: c.type2 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Catalogo de hunts pro seletor do Robo: o slug alimenta o enter-hunt; o pokemon do
  // ponto vem do looktype (a criatura de huntLevel mais proximo do nivel da hunt), pro sprite.
  const byLook = new Map<number, typeof creatures>();
  for (const c of creatures) {
    const arr = byLook.get(c.looktype) ?? [];
    arr.push(c);
    byLook.set(c.looktype, arr);
  }
  const huntOptions = hunts.map((h) => {
    const cands = byLook.get(h.looktype);
    let pokeId: number | null = null;
    if (cands?.length) {
      let best = cands[0];
      for (const c of cands) if (Math.abs(c.huntLevel - h.level) < Math.abs(best.huntLevel - h.level)) best = c;
      pokeId = best.pokeId;
    }
    return { slug: h.slug, name: h.name, level: h.level, area: h.area, pokeId };
  });

  // Drops VENDAVEIS por pokemon (pro modal de venda automatica ao ligar a Hunt). O loot da
  // especie referencia item por NOME; resolve pra item real e mantem so o que da pra vender
  // no NPC (categoria loot, npcPrice > 0).
  const huntPokeIds = new Set(huntOptions.map((h) => h.pokeId).filter((x): x is number => x != null));
  const lootByPoke: Record<number, { itemId: number; name: string; icon: string; npcPrice: number }[]> = {};
  for (const c of creatures) {
    if (!huntPokeIds.has(c.pokeId)) continue;
    const drops: { itemId: number; name: string; icon: string; npcPrice: number }[] = [];
    for (const l of c.loot) {
      const it = db.getItemByName(l.name);
      if (it && it.category === "loot" && it.npcPrice > 0) drops.push({ itemId: it.id, name: it.name, icon: it.icon, npcPrice: it.npcPrice });
    }
    if (drops.length) lootByPoke[c.pokeId] = drops;
  }

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

  // cockpit: estoura o container do site (104rem) — a area VIP usa a tela inteira
  return (
    <div className="container-vip">
      <ToolFrame accent={ACCENT} label="VIP" icon={<Star size={13} />}>
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="pixel text-3xl" style={{ color: ACCENT }}><T k="vip.active.title" /></h1>
          </div>

          <VipShell creatures={slim} dex={dex} hunts={huntOptions} itemIcons={itemIcons} lootByPoke={lootByPoke} marketItems={marketItems} />
        </div>
      </ToolFrame>
    </div>
  );
}
