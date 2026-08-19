"use client";

import type { PokeType, Rarity } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { TIER_COLOR, qualityTier, rarityTier, type RarityTier } from "@/lib/rarity";
import { TypeIcon } from "./type-icon";
import { useRarityLabel, useTypeLabel } from "./locale-provider";

export function TypeBadge({
  type,
  icon = true,
  labelFrom,
}: {
  type: PokeType | string;
  icon?: boolean;
  /** `sm`: esconde o rotulo abaixo do breakpoint (fica so o icone). Usado no card da
   *  grade, onde a coluna e estreita demais pra dois rotulos lado a lado. */
  labelFrom?: "sm";
}) {
  const label = useTypeLabel();
  const color = TYPE_COLOR[type as PokeType] ?? "#6b7280";
  return (
    <span
      className="chip shrink-0"
      title={label(type)}
      style={{ background: color, color: "#fff", textShadow: "0 1px 1px rgba(0,0,0,0.45)" }}
    >
      {/* icone de linha casa com a altura do texto do chip (.chip = text-xs, 14px);
          abaixo disso o traco lucide vira borrao. O .chip ja centraliza (align-items)
          e o TypeIcon ja e shrink-0, entao o glifo nao desalinha nem espreme o rotulo. */}
      {icon && <TypeIcon type={type} size={14} />}
      {labelFrom === "sm" ? <span className="hidden sm:inline">{label(type)}</span> : label(type)}
    </span>
  );
}

export function TypeBadges({
  t1,
  t2,
  icon = true,
  labelFrom,
}: {
  t1: PokeType;
  t2: PokeType | null;
  icon?: boolean;
  labelFrom?: "sm";
}) {
  // flex-nowrap: os dois tipos ficam SEMPRE na mesma linha (pedido do Eduardo). Quem
  // garante que cabe e a largura do container + o rotulo que some no celular.
  return (
    <span className="inline-flex flex-nowrap gap-1.5">
      <TypeBadge type={t1} icon={icon} labelFrom={labelFrom} />
      {t2 && <TypeBadge type={t2} icon={icon} labelFrom={labelFrom} />}
    </span>
  );
}

/** Badge maior com icone destacado — usado na tabela de efetividade. */
export function TypePill({ type, mult }: { type: PokeType; mult?: string }) {
  const label = useTypeLabel();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${TYPE_COLOR[type]} 22%, transparent)`,
        border: `1px solid ${TYPE_COLOR[type]}`,
        color: TYPE_COLOR[type],
      }}
    >
      {/* variante "destacada": icone 16 (contra os 14 do chip) e o que sustenta o
          degrau de tamanho agora que o traco e fino */}
      <TypeIcon type={type} size={16} />
      {label(type)}
      {mult && <span className="opacity-70">{mult}</span>}
    </span>
  );
}

/** Raridade da ESPECIE (traco do catalogo). Rotulo traduzido, cor da escada do jogo. */
export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <TierBadge tier={rarityTier(rarity)} />;
}

/** Faixa do INDIVIDUO, derivada da Quality — e o que o JOGO mostra no bicho.
 *  Use esta em tela de pokemon capturado/anunciado; a da especie so no catalogo. */
export function QualityBadge({ quality }: { quality: number }) {
  return <TierBadge tier={qualityTier(quality)} />;
}

function TierBadge({ tier }: { tier: RarityTier }) {
  const label = useRarityLabel();
  return (
    <span className="chip" style={{ background: TIER_COLOR[tier], color: "#06111a" }}>
      {label(tier)}
    </span>
  );
}
