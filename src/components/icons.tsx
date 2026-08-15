// Icones pixel (SVG, crispEdges) — moeda de ouro e preco formatado. Sem emoji.

export function Coin({ size = 14, className = "" }: { size?: number; className?: string }) {
  // moeda 8x8: borda escura, ouro, brilho.
  const G = "#f4c430", D = "#8a5a12", L = "#ffe98a";
  const grid = [
    "..DDDD..",
    ".DGGGGD.",
    "DGLGGGGD",
    "DGLGGGGD",
    "DGGGGGGD",
    "DGGGGGGD",
    ".DGGGGD.",
    "..DDDD..",
  ];
  const C: Record<string, string> = { G, D, L };
  const cells: React.ReactNode[] = [];
  grid.forEach((row, y) =>
    row.split("").forEach((c, x) => {
      if (C[c]) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={C[c]} />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" className={className} aria-hidden>
      {cells}
    </svg>
  );
}

/** Preco em ouro do jogo: moeda + valor. */
export function Gold({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Coin />
      {value.toLocaleString("pt-BR")}
    </span>
  );
}
