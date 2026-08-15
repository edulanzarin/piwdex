// Pokebola em pixels (grid 12x12) desenhada em SVG — logo e spinner. Sem emoji.
const P = "#ec3b3b"; // vermelho
const W = "#f4f6fb"; // branco
const K = "#141821"; // preto (contorno/banda)

// mapa de cores por celula; "." = transparente
const GRID = [
  "...KKKK.....",
  "..KPPPPKK...",
  ".KPPPPPPPK..",
  ".KPPPPPPPK..",
  "KPPPPPPPPPK.",
  "KKKKKKKKKKKK",
  "KWWWKKKWWWWK",
  "KWWWKKKWWWWK",
  ".KWWWKKKWWK.",
  ".KWWWWWWWWK.",
  "..KWWWWWWK..",
  "...KKKKKK...",
];

const COLORS: Record<string, string> = { P, W, K };

export function Pokeball({ size = 20, className = "" }: { size?: number; className?: string }) {
  const cells: React.ReactNode[] = [];
  GRID.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      const fill = COLORS[c];
      if (fill) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    });
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden
    >
      {cells}
    </svg>
  );
}
