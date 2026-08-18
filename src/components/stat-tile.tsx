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
  live = false,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** cor do valor (token/hex). Sem ela, herda a cor do texto. */
  accent?: string;
  /** liga o realce neon no hover (borda + brilho + subida). */
  hover?: boolean;
  /** tempo real: o valor PISCA no acento quando muda (remonta o span por key). */
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={`well ${hover ? "well-hover" : ""} flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="field-label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {/* valor longo (ex.: preco de 1 bilhao) quebra em vez de estourar o tile */}
      <span
        key={live ? String(value) : undefined}
        className={`pixel min-w-0 text-sm tabular-nums [overflow-wrap:anywhere] ${live ? "tick-glow" : ""}`}
        style={accent ? ({ color: accent, "--accent": accent } as CSSProperties) : undefined}
      >
        {value}
      </span>
    </div>
  );
}
