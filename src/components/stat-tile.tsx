// Mini-tile de dado ("poco"): rotulo pequeno em cima, valor destacado embaixo, com
// icone pixel opcional e acento por cor. Substitui as ~10 copias soltas de
// `rounded border bg-[rgba(8,14,28,0.x)] px-3 py-2`. Forma fechada, cor aberta.
// Valor ausente NAO some: o tile renderiza igual com placeholder esmaecido ("—") no
// MESMO slot — regua de tiles nunca muda de tamanho quando o dado chega/some.

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
  /** valor do tile; null/undefined vira "—" esmaecido com as MESMAS dimensoes */
  value?: React.ReactNode;
  icon?: React.ReactNode;
  /** cor do valor (token/hex). Sem ela, herda a cor do texto. */
  accent?: string;
  /** liga o realce neon no hover (borda + brilho + subida). */
  hover?: boolean;
  /** tempo real: o valor PISCA no acento quando muda (remonta o span por key). */
  live?: boolean;
  className?: string;
}) {
  const empty = value == null;
  return (
    // min-h = altura natural de rotulo + valor de UMA linha (base 16px): tile de valor
    // curto e tile de valor longo ficam na mesma regua, a fila nunca danca
    <div className={`well ${hover ? "well-hover" : ""} flex min-h-[4rem] min-w-0 flex-col gap-1 ${className}`}>
      <span className="field-label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {/* valor longo (ex.: preco de 1 bilhao) quebra em vez de estourar o tile */}
      <span
        key={live && !empty ? String(value) : undefined}
        className={`pixel min-w-0 text-lg tabular-nums [overflow-wrap:anywhere] ${live && !empty ? "tick-glow" : ""} ${empty ? "slot-empty" : ""}`}
        style={!empty && accent ? ({ color: accent, "--accent": accent } as CSSProperties) : undefined}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
