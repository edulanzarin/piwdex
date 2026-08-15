import Link from "next/link";
import type { Creature } from "@/lib/types";
import { spriteUrl } from "@/lib/sprites";
import { TypeBadges } from "./badges";
import { Sprite } from "./sprite";

export function CreatureCard({ creature }: { creature: Creature }) {
  return (
    <Link
      href={`/dex/${creature.pokeId}`}
      className="card card-link flex flex-col items-center gap-2 p-3"
    >
      <Sprite src={spriteUrl(creature.pokeId)} alt={creature.name} size={76} />
      <div className="text-center">
        <div className="text-[0.6rem] text-text-dim">
          #{String(creature.pokeId).padStart(3, "0")}
        </div>
        <div className="text-sm font-semibold leading-tight">{creature.name}</div>
      </div>
      <TypeBadges t1={creature.type1} t2={creature.type2} />
    </Link>
  );
}
