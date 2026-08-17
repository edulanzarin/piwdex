// Mini-tile de dado ("poco"): rotulo pequeno em cima, valor destacado embaixo, com
// icone pixel opcional e acento por cor. Substitui as ~10 copias soltas de
// `rounded border bg-[rgba(8,14,28,0.x)] px-3 py-2`. Forma fechada, cor aberta.

import type { CSSProperties } from "react";

export function StatTile({
  label,
  value,
  icon,
  accent,
  hover = false,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** cor do valor (token/hex). Sem ela, herda a cor do texto. */
  accent?: string;
  /** liga o realce neon no hover (borda + brilho + subida). */
  hover?: boolean;
  className?: string;
}) {
  return (
    <div className={`well ${hover ? "well-hover" : ""} flex flex-col gap-1 ${className}`}>
      <span className="field-label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className="pixel text-sm tabular-nums"
        style={accent ? ({ color: accent } as CSSProperties) : undefined}
      >
        {value}
      </span>
    </div>
  );
}
