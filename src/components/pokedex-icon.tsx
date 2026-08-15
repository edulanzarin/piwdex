// Sprite pixel do aparelho Pokedex (fechado), multicolor. Usado na home.
const C: Record<string, string> = {
  K: "#3a1013", // contorno
  R: "#e0454b", // vermelho corpo
  r: "#b7333a", // vermelho sombra
  B: "#2b8fe0", // lente azul
  w: "#bff3ff", // brilho da lente
  g: "#35e08e", // led verde
  y: "#f4d24a", // led amarelo
  D: "#0c1730", // tela
  s: "#1c3358", // brilho tela
  b: "#4f8bf0", // dpad
};

const ROWS = [
  ".KKKKKKKKKK.",
  "KRRRRRRRRRRK",
  "KRBwRRgyRRRK",
  "KRBBRRRRRRrK",
  "KRRRRRRRRRrK",
  "KKKKKKKKKKKK",
  "KRRRRRRRRRRK",
  "KRDDDDDDDDRK",
  "KRDssssssDRK",
  "KRDDDDDDDDRK",
  "KRRRRRRRRRrK",
  "KRbRRRRyyRrK",
  "KRRRRRRRRRrK",
  ".KKKKKKKKKK.",
];

export function PokedexIcon({ size = 40 }: { size?: number }) {
  const w = ROWS[0].length;
  const h = ROWS.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = ROWS[y][x];
      if (ch !== "." && C[ch]) {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={C[ch]} />);
      }
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
