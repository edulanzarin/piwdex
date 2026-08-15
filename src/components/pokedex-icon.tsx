// Aparelho Pokedex aberto, pixel art detalhado (18x18). Home.
const C: Record<string, string> = {
  K: "#33090c", // contorno
  r: "#b7333a", // vermelho sombra
  R: "#e0454b", // vermelho corpo
  b: "#2b8fe0", // aro da lente
  w: "#cdefff", // brilho da lente
  s: "#12604e", // borda da tela
  S: "#54e6a4", // tela verde
  g: "#35e08e", // led verde
  y: "#f4d24a", // led amarelo
  c: "#37d3e6", // led ciano
  m: "#9aa7bd", // dpad
  n: "#9aa7bd", // botoes
};

const ROWS = [
  "....KKKKKKKKKK....",
  "..KKrrrrrrrrrrKK..",
  ".KKbbKrrrrrrrrRRK.",
  ".KbwbKRRRRRRRRRRK.",
  ".KbbKRssssssssRRK.",
  ".KRRKssSSSSSSssRK.",
  ".KRKssSSSSSSSSssK.",
  ".KRKsSSSSSSSSSSsK.",
  ".KRKsSSSSSSSSSSsK.",
  ".KRKssSSSSSSSSssK.",
  ".KRRKssssssssssRK.",
  ".KRRRRRRRRRRRRRRK.",
  ".KRgKRRyKRRcKRRRK.",
  ".KRRRRRRRRRRRRRRK.",
  ".KRmmKRRRRRRnnRRK.",
  ".KRmmKRRRRRRnnRRK.",
  "..KRRRRRRRRRRRRK..",
  "...KKKKKKKKKKKK...",
];

export function PokedexIcon({ size = 40 }: { size?: number }) {
  const w = ROWS[0].length;
  const h = ROWS.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = ROWS[y][x];
      if (ch !== "." && C[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={C[ch]} />);
    }
  }
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}
