import type { PokeType, Rarity } from "@/lib/types";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";

export function TypeBadge({ type }: { type: PokeType }) {
  return (
    <span className="chip" style={{ background: TYPE_COLOR[type] }}>
      {type}
    </span>
  );
}

export function TypeBadges({ t1, t2 }: { t1: PokeType; t2: PokeType | null }) {
  return (
    <span className="inline-flex gap-1.5">
      <TypeBadge type={t1} />
      {t2 && <TypeBadge type={t2} />}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className="chip"
      style={{ background: RARITY_COLOR[rarity], color: "#111", textShadow: "none" }}
    >
      {rarity}
    </span>
  );
}
