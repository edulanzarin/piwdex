import Link from "next/link";
import type { Creature } from "@/lib/types";
import { spriteUrl } from "@/lib/sprites";
import { RARITY_COLOR } from "@/lib/typing";
import { TypeBadges } from "./badges";

export function CreatureCard({ creature }: { creature: Creature }) {
  const src = spriteUrl(creature.pokeId);
  return (
    <Link
      href={`/dex/${creature.pokeId}`}
      className="card flex flex-col items-center gap-2 p-3 hover:border-accent transition-colors"
      style={{ borderTopColor: RARITY_COLOR[creature.rarity], borderTopWidth: 3 }}
    >
      <div className="flex h-20 w-20 items-center justify-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={creature.name}
            loading="lazy"
            width={80}
            height={80}
            className="pixelated max-h-20"
          />
        ) : (
          <span className="text-text-dim text-xs">sem sprite</span>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs text-text-dim">#{creature.pokeId}</div>
        <div className="text-sm font-semibold leading-tight">{creature.name}</div>
      </div>
      <TypeBadges t1={creature.type1} t2={creature.type2} />
    </Link>
  );
}
