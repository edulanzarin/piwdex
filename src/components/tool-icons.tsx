// Icones pixel (SVG crispEdges) das ferramentas da home. Mesmo estilo do PokedexIcon.

function render(ROWS: string[], C: Record<string, string>, size: number) {
  const w = ROWS[0].length;
  const h = ROWS.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ROWS[y].length; x++) {
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

// Baú de tesouro (Itens & drops).
const CHEST: Record<string, string> = { K: "#2a1607", N: "#b0762f", n: "#7c4f1d", y: "#f4d24a", o: "#c99a30" };
const CHEST_ROWS = [
  "..KKKKKKKKKK..",
  ".KNNNNNNNNNNK.",
  ".KNnNNNNNNnNK.",
  ".KyyyyyyyyyyK.",
  ".KoKKKKKKKKoK.",
  ".KNNNNyyNNNNK.",
  ".KNNNNyKNNNNK.",
  ".KNNNNyyNNNNK.",
  ".KNnNNNNNNnNK.",
  "..KKKKKKKKKK..",
];
export const ItemsIcon = ({ size = 52 }: { size?: number }) => render(CHEST_ROWS, CHEST, size);

// Pino de mapa (Hunt Planner — onde cacar).
const PIN: Record<string, string> = { K: "#3a1013", R: "#e0454b", r: "#b7333a", W: "#eef3fc" };
const PIN_ROWS = [
  "...KKKKK...",
  "..KRRRRRK..",
  ".KRRRRRRRK.",
  ".KRWWWWWRK.",
  ".KRWWWWWRK.",
  ".KRRRRRRrK.",
  "..KRRRRrK..",
  "..KRRRRrK..",
  "...KRRrK...",
  "...KRRrK...",
  "....KrK....",
  "....KK.....",
];
export const HuntIcon = ({ size = 52 }: { size?: number }) => render(PIN_ROWS, PIN, size);

// Calculadora (Calculadora IV).
const CALC: Record<string, string> = { K: "#16233c", S: "#8a97ad", s: "#5a6a86", G: "#35e08e", g: "#1f7d4e", D: "#38507a" };
const CALC_ROWS = [
  ".KKKKKKKKKK.",
  ".KSSSSSSSSK.",
  ".KSgGGGGgSK.",
  ".KSGGGGGGSK.",
  ".KSsssssssK.",
  ".KSDSDSDSDK.",
  ".KSDSDSDSDK.",
  ".KSDSDSDSDK.",
  ".KSDSDSDSDK.",
  ".KKKKKKKKKK.",
];
export const CalcIcon = ({ size = 52 }: { size?: number }) => render(CALC_ROWS, CALC, size);

// Cabeca da Eevee (Laboratorio da Eevee).
const EEVEE: Record<string, string> = { d: "#5c3d20", F: "#b5844f", k: "#2b1a0c", C: "#f2e2b8" };
const EEVEE_ROWS = [
  "dd......dd..",
  ".dFd....dFd.",
  ".dFFd..dFFd.",
  ".dFFFddFFFd.",
  "dFFFFFFFFFFd",
  "dFkFFFFFFkFd",
  "dFFFFFFFFFFd",
  "dFFFFkkFFFFd",
  ".dFFFFFFFFd.",
  ".dFFFFFFFFd.",
  "..dCCCCCCd..",
  "...dCCCCd...",
];
export const EeveeIcon = ({ size = 52 }: { size?: number }) => render(EEVEE_ROWS, EEVEE, size);
