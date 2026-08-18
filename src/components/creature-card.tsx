import Link from "next/link";
import type { Acquisition, Creature } from "@/lib/types";
import { spriteUrl } from "@/lib/sprites";
import { TypeBadges } from "./badges";
import { AcqBadge } from "./acq-badge";
import { Sprite } from "./sprite";

export function CreatureCard({ creature, acq }: { creature: Creature; acq?: Acquisition }) {
  return (
    <Link
      href={`/dex/${creature.pokeId}`}
      className="card card-link relative flex flex-col items-center gap-2 p-3"
    >
      {/* So marca as origens fora do comum (evolucao/especial); caca e o padrao. */}
      {acq && acq !== "hunt" && (
        <AcqBadge kind={acq} className="absolute right-1.5 top-1.5 !text-[0.7rem] !px-1.5 !py-0.5" />
      )}
      <Sprite src={spriteUrl(creature.pokeId)} alt={creature.name} size={76} />
      <div className="text-center">
        <div className="text-[0.8rem] text-text-dim">
          #{String(creature.pokeId).padStart(3, "0")}
        </div>
        <div className="pixel text-[1.05rem] leading-tight">{creature.name}</div>
      </div>
      <TypeBadges t1={creature.type1} t2={creature.type2} />
    </Link>
  );
}
