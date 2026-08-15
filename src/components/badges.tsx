"use client";

import type { PokeType, Rarity } from "@/lib/types";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { TypeIcon } from "./type-icon";
import { useTypeLabel } from "./locale-provider";

export function TypeBadge({ type, icon = true }: { type: PokeType | string; icon?: boolean }) {
  const label = useTypeLabel();
  const color = TYPE_COLOR[type as PokeType] ?? "#6b7280";
  return (
    <span
      className="chip"
      style={{ background: color, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.45)" }}
    >
      {icon && <TypeIcon type={type} size={11} />}
      {label(type)}
    </span>
  );
}

export function TypeBadges({ t1, t2, icon = true }: { t1: PokeType; t2: PokeType | null; icon?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <TypeBadge type={t1} icon={icon} />
      {t2 && <TypeBadge type={t2} icon={icon} />}
    </span>
  );
}

/** Badge maior com icone destacado — usado na tabela de efetividade. */
export function TypePill({ type, mult }: { type: PokeType; mult?: string }) {
  const label = useTypeLabel();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${TYPE_COLOR[type]} 22%, transparent)`,
        border: `1px solid ${TYPE_COLOR[type]}`,
        color: TYPE_COLOR[type],
      }}
    >
      <TypeIcon type={type} size={12} />
      {label(type)}
      {mult && <span className="opacity-70">{mult}</span>}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className="chip" style={{ background: RARITY_COLOR[rarity], color: "#06111a" }}>
      {rarity}
    </span>
  );
}
