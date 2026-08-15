// Pokebola em pixels (grid 14x14) em SVG — logo e spinner. Com brilho e botao
// central. Sem emoji.
const P = "#ec3b3b"; // vermelho
const S = "#ff7a7a"; // brilho
const W = "#f4f6fb"; // branco
const K = "#141821"; // contorno / banda

const GRID = [
  "....KKKKKK....",
  "..KKSSPPPPKK..",
  ".KSSPPPPPPPPK.",
  ".KSPPPPPPPPPK.",
  "KPPPPPPPPPPPPK",
  "KPPPPKKKKPPPPK",
  "KKKKKKWWKKKKKK",
  "KKKKKKWWKKKKKK",
  "WWWWWKKKKWWWWW",
  "KWWWWWWWWWWWWK",
  "KWWWWWWWWWWWWK",
  ".KWWWWWWWWWWK.",
  "..KKWWWWWWKK..",
  "....KKKKKK....",
];

const COLORS: Record<string, string> = { P, S, W, K };

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
      viewBox="0 0 14 14"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden
    >
      {cells}
    </svg>
  );
}
