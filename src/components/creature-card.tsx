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
      title={creature.name}
      className="card card-link relative flex min-h-[12.5rem] flex-col items-center gap-2 p-3"
    >
      {/* So marca as origens fora do comum (evolucao/especial); caca e o padrao.
          Badge ABSOLUTO no canto: nunca entra no fluxo, nao empurra o card. */}
      {acq && acq !== "hunt" && (
        <AcqBadge kind={acq} className="absolute right-1.5 top-1.5" />
      )}
      <Sprite src={spriteUrl(creature.pokeId)} alt={creature.name} size={76} />
      {/* bloco de texto cresce (flex-1) pra badge de tipo assentar na base em todo card */}
      <div className="w-full flex-1 text-center">
        <div className="text-sm text-text-dim">
          #{String(creature.pokeId).padStart(3, "0")}
        </div>
        <div className="pixel truncate text-lg leading-tight">{creature.name}</div>
      </div>
      <TypeBadges t1={creature.type1} t2={creature.type2} />
    </Link>
  );
}
