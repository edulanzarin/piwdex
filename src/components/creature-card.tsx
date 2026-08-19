import Link from "next/link";
import type { Acquisition, Creature } from "@/lib/types";
import { spriteUrl } from "@/lib/sprites";
import { TypeBadges } from "./badges";
import { AcqBadge } from "./acq-badge";
import { Sprite } from "./sprite";

// Altura minima recalibrada pra base 16px: 12.5rem valia 225px na base 18px antiga e
// virou 200px, apertando o card. 13.5rem = 216px cobre o pior caso real — sprite 76 +
// #id + nome + badge de tipo em DUAS linhas (nome de tipo longo em es/en nao cabe lado
// a lado na largura de uma coluna da grade). Se mexer aqui, mexa no GridSkeleton.
export function CreatureCard({ creature, acq }: { creature: Creature; acq?: Acquisition }) {
  return (
    <Link
      href={`/dex/${creature.pokeId}`}
      title={creature.name}
      className="card card-link relative flex min-h-[13.5rem] flex-col items-center gap-2 p-3"
    >
      {/* So marca as origens fora do comum (evolucao/especial); caca e o padrao.
          Badge ABSOLUTO no canto: nunca entra no fluxo, nao empurra o card. */}
      {acq && acq !== "hunt" && (
        <AcqBadge kind={acq} className="absolute right-1.5 top-1.5" />
      )}
      <Sprite src={spriteUrl(creature.pokeId)} alt={creature.name} size={76} />
      {/* bloco de texto cresce (flex-1) pra badge de tipo assentar na base em todo card */}
      <div className="w-full flex-1 text-center">
        <div className="text-sm text-text-dim tabular-nums">
          #{String(creature.pokeId).padStart(3, "0")}
        </div>
        {/* .pixel = peso 600 da Chakra: o nome salta do #id sem precisar de caixa alta */}
        <div className="pixel truncate text-lg leading-tight">{creature.name}</div>
      </div>
      <TypeBadges t1={creature.type1} t2={creature.type2} />
    </Link>
  );
}
