import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getData } from "@/lib/data";
import { itemIconUrl } from "@/lib/sprites";
import { EeveeLab, type EvoNode } from "@/components/eevee-lab";
import { ToolFrame } from "@/components/tool-frame";
import { NavLab } from "@/components/nav-icons";
import { ChevronRight } from "@/components/icons";
import { T } from "@/components/locale-provider";

export const metadata: Metadata = { title: "Laboratorio da Eevee" };

const EEVEE_ID = 133;
// Ramo por pedra (nao esta no dado publico — vem da Loja do Marlon, logada).
// Ordem = posicao na estrela. Pedras confirmadas no jogo (items.json).
const EVO_STONES: Record<number, string> = {
  196: "Sun Stone", // Espeon
  135: "Thunder Stone", // Jolteon
  136: "Fire Stone", // Flareon
  134: "Water Stone", // Vaporeon
  197: "Moon Stone", // Umbreon
};
const EVO_ORDER = [196, 135, 136, 134, 197];

const basesOf = (c: {
  baseHp: number; baseAtk: number; baseDef: number;
  baseSpAtk: number; baseSpDef: number; baseSpeed: number;
}) => [c.baseHp, c.baseAtk, c.baseDef, c.baseSpAtk, c.baseSpDef, c.baseSpeed];

export default async function EeveePage() {
  const { getCreature, getItemByName } = await getData();
  const eevee = getCreature(EEVEE_ID);
  if (!eevee) notFound();

  const evos: EvoNode[] = EVO_ORDER.flatMap((id) => {
    const c = getCreature(id);
    if (!c) return [];
    const stoneName = EVO_STONES[id];
    const stone = stoneName ? getItemByName(stoneName) : null;
    return [{
      pokeId: c.pokeId,
      name: c.name,
      t1: c.type1,
      t2: c.type2,
      bases: basesOf(c),
      stoneName: stone ? stoneName : null,
      stoneIcon: stone ? itemIconUrl(stone) : null,
    }];
  });

  return (
    <ToolFrame accent="var(--cyan)" label="LAB" icon={<NavLab size={13} />}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="pixel text-3xl" style={{ color: "var(--cyan)" }}><T k="eevee.title" /></h1>
          <p className="mt-3 max-w-2xl text-sm text-text-dim"><T k="eevee.desc" /></p>
          <Link href={`/dex/${EEVEE_ID}`} className="mt-2 inline-flex items-center gap-1 text-[0.9rem] uppercase tracking-wide text-cyan hover:underline">
            <T k="eevee.backDex" /> <ChevronRight size={9} />
          </Link>
        </div>
        <EeveeLab eevee={{ pokeId: EEVEE_ID, name: eevee.name, t1: eevee.type1, t2: eevee.type2, bases: basesOf(eevee) }} evos={evos} />
      </div>
    </ToolFrame>
  );
}
