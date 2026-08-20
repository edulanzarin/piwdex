"use client";

import { TIER_COLOR, type Tier } from "@/lib/meta";

/** Selo do tier. Mesma escada de cor em toda a ferramenta: quem viu S na tier list
 *  reconhece o S no perfil e no Stadium sem reler a legenda. */
export function TierBadge({ tier, size = "md" }: { tier: Tier; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 text-2xl" : size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-lg";
  const color = TIER_COLOR[tier];
  return (
    <span
      className={`pixel inline-flex ${box} shrink-0 items-center justify-center rounded border tabular-nums`}
      style={{ borderColor: color, color, background: "color-mix(in srgb, currentColor 12%, transparent)" }}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

/** Barra 0..1 de um eixo do score (ataque / resistencia). O numero fica sempre visivel:
 *  barra vazia e igualzinha a "nao carregou" (ver [[Zero num medidor e estado]]). */
export function AxisBar({
  value, color, label, hint,
}: {
  value: number;
  color: string;
  label: string;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex min-w-0 flex-col gap-1" title={hint}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="field-label">{label}</span>
        <span className="text-xs tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
