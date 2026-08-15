// Icones pixel detalhados (18x18, com sombreado) das ferramentas da home.

function render(ROWS: string[], C: Record<string, string>, size: number) {
  const w = ROWS[0].length;
  const h = ROWS.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ROWS[y].length; x++) {
      const ch = ROWS[y][x];
      if (ch !== "." && ch !== " " && C[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={C[ch]} />);
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

// Bau de tesouro (Itens & drops).
const CHEST: Record<string, string> = {
  K: "#2a1607", N: "#9a6428", h: "#5c3a16", y: "#f4d24a", o: "#c99a30", L: "#e8c34a",
};
const CHEST_ROWS = [
  "..................",
  "...KKKKKKKKKKKK...",
  "..KNNNNNNNNNNNNK..",
  ".KNhNNNhNNhNNNhNK.",
  ".KNNNNNNNNNNNNNNK.",
  ".KyyyyyyyyyyyyyyK.",
  ".KyoooooooooooyyK.",
  ".KKKKKKLLKKKKKKKK.",
  ".KNNNNNLLLNNNNNNK.",
  ".KNhNNNKLKNNNhNNK.",
  ".KNNNNNLLLNNNNNNK.",
  ".KNNNNNNLNNNNNNNK.",
  ".KNhNNNNNNNNNhNNK.",
  ".KNNNNNNNNNNNNNNK.",
  "..KNNNNNNNNNNNNK..",
  "...KKKKKKKKKKKK...",
  "..................",
  "..................",
];
export const ItemsIcon = ({ size = 52 }: { size?: number }) => render(CHEST_ROWS, CHEST, size);

// Moeda de ouro + seta pra cima (farm de XP/ouro — Hunt Planner).
const FARM: Record<string, string> = {
  G: "#4bbd5c", K: "#6b4a10", Y: "#f4d24a", y: "#c99a30", w: "#fff6cf",
};
const FARM_ROWS = [
  "..................",
  "........GG........",
  ".......GGGG.......",
  "......GGGGGG......",
  ".....GGGGGGGG.....",
  ".......GGGG.......",
  ".......GGGG.......",
  ".......GGGG.......",
  "..................",
  "....KKKKKKKK......",
  "...KYYYYYYYYK.....",
  "..KYwwYYYYYYYK....",
  "..KYwYYYYYYYyK....",
  "..KYYYYYYYYYyK....",
  "..KYYYYYYYYyyK....",
  "...KyYYYYYyyK.....",
  "....KKKKKKKK......",
  "..................",
];
export const HuntIcon = ({ size = 52 }: { size?: number }) => render(FARM_ROWS, FARM, size);

// Calculadora com tela verde e botoes coloridos (Calculadora IV).
const CALC: Record<string, string> = {
  K: "#16233c", S: "#c3ccdb", g: "#166b45", G: "#39e08e", i: "#0c3d24", v: "#0c3d24", p: "#0c3d24",
  r: "#e0454b", y: "#f4d24a", b: "#4a6394", R: "#e0454b",
};
const CALC_ROWS = [
  "..KKKKKKKKKKKKKK..",
  ".KSSSSSSSSSSSSSSK.",
  ".KSKKKKKKKKKKKKSK.",
  ".KSKggGGGGGGggKSK.",
  ".KSKgGiGvGGGGgKSK.",
  ".KSKgGiGvGGpGgKSK.",
  ".KSKggGGGGGGggKSK.",
  ".KSKKKKKKKKKKKKSK.",
  ".KSSSSSSSSSSSSSSK.",
  ".KSrKSyKSbKSgKSSK.",
  ".KSSSSSSSSSSSSSSK.",
  ".KSbKSbKSbKSbKSSK.",
  ".KSSSSSSSSSSSSSSK.",
  ".KSbKSbKSbKSRKSSK.",
  ".KSSSSSSSSSSSSSSK.",
  ".KSbKSbKSbKSRKSSK.",
  ".KSSSSSSSSSSSSSSK.",
  "..KKKKKKKKKKKKKK..",
];
export const CalcIcon = ({ size = 52 }: { size?: number }) => render(CALC_ROWS, CALC, size);

// Beaker de laboratorio com liquido (Laboratorio da Eevee).
const LAB: Record<string, string> = {
  K: "#243543", W: "#bfe9ff", g: "#35e08e", b: "#bff3ff",
};
const LAB_ROWS = [
  "......KKKK........",
  "......KWWK........",
  "......KWWK........",
  "......KWWK........",
  ".....KKWWKK.......",
  ".....KWWWWK.......",
  "....KWWWWWWK......",
  "....KWggggWK......",
  "...KWggggggWK.....",
  "...KWgbgggbWK.....",
  "..KWggggggggWK....",
  "..KWgbggggbgWK....",
  ".KWggggggggggWK...",
  ".KWgbgggggbggWK...",
  ".KWggggggggggWK...",
  ".KKKKKKKKKKKKKK...",
  "..................",
  "..................",
];
export const LabIcon = ({ size = 52 }: { size?: number }) => render(LAB_ROWS, LAB, size);

// Ovo malhado (Breeding). Construido por perfil de meia-largura pra sair sempre
// simetrico (estreito no topo, redondo embaixo), com malhas verdes e sombra.
const EGG_SHELL = "#efe7cf";
const EGG_SHADE = "#c9bd94";
const EGG_BASE = "#dcd0a6";
const EGG_SPOT = "#35e08e";
const EGG_HALF = [1, 2, 3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 6, 6, 5, 4, 3];
const EGG_SPOTS = new Set(["6,5", "10,6", "8,8", "4,10", "12,11", "7,13"]);
export const BreedIcon = ({ size = 52 }: { size?: number }) => {
  const W = 18;
  const H = EGG_HALF.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < H; y++) {
    const hw = EGG_HALF[y];
    const x0 = Math.round(W / 2 - hw);
    const x1 = Math.round(W / 2 + hw) - 1;
    for (let x = x0; x <= x1; x++) {
      let fill = EGG_SHELL;
      if (EGG_SPOTS.has(`${x},${y}`)) fill = EGG_SPOT;
      else if (x >= x1 - 1 && y >= 4) fill = EGG_SHADE;
      else if (y >= H - 3) fill = EGG_BASE;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" shapeRendering="crispEdges" style={{ imageRendering: "pixelated", flexShrink: 0 }} aria-hidden="true">
      {rects}
    </svg>
  );
};
