// Icones pixel (SVG, crispEdges) — moeda de DOLAR do jogo e preco formatado. Sem emoji.
// O jogo nao publica um arquivo de icone pra moeda (usa emoji/formato de numero); entao
// desenhamos a nossa, uma moeda dourada com "$" pra ler como dolar (nao "ouro generico").

export function Coin({ size = 14, className = "" }: { size?: number; className?: string }) {
  // moeda 12x12 gerada por circulo: anel escuro, ouro, brilho e um "$" em relevo.
  const G = "#f4c430", D = "#8a5a12", L = "#ffe98a", K = "#6b4310";
  const N = 12, c = 5.5, r = 5.7, rIn = 4.5;
  const dollar = new Set([
    "6,2", "4,3", "5,3", "6,3", "7,3", "4,4", "6,4", "4,5", "5,5", "6,5",
    "5,6", "6,6", "6,7", "7,7", "4,8", "5,8", "6,8", "7,8", "5,9", "6,9",
  ]);
  const hi = new Set(["3,3", "3,4", "2,4", "4,2"]);
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > r + 0.5) continue;
      const key = `${x},${y}`;
      const fill = dollar.has(key) ? K : d > rIn ? D : hi.has(key) ? L : G;
      cells.push(<rect key={key} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} aria-hidden>
      {cells}
    </svg>
  );
}

/** Diamante pixel (moeda premium). Corpo herda a cor (currentColor) — envolver em
 *  text-cyan pra moeda, ou outra cor pra VIP/etc. Brilho branco fixo. */
export function Diamond({ size = 12, className = "" }: { size?: number; className?: string }) {
  const rows = [
    ".....CC.....", "....CwwC....", "...CwwCCC...", "..CCCCCCCC..",
    ".CCCCCCCCCC.", "CCCCCCCCCCCC", ".CCCCCCCCCC.", "..CCCCCCCC..",
    "...CCCCCC...", "....CCCC....", ".....CC.....",
  ];
  const cells: React.ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "C") cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />);
      else if (ch === "w") cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#ffffff" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
      {cells}
    </svg>
  );
}

/** Estrela pixel (shiny/destaque). Herda a cor (currentColor). */
export function Star({ size = 12, className = "" }: { size?: number; className?: string }) {
  const rows = ["....##....", "....##....", "...####...", ".########.", "..######..", ".########.", "..##..##..", ".##....##."];
  const cells: React.ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "#") cells.push(<rect key={`${x}-${y}`} x={x} y={y + 1} width={1} height={1} fill="currentColor" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
      {cells}
    </svg>
  );
}

/** Sino pixel (alertas). Herda currentColor; mesmo dialeto do Star. Sem emoji. */
export function Bell({ size = 20, className = "" }: { size?: number; className?: string }) {
  const rows = ["....##....", "...####...", "...####...", "..######..", "..######..", ".########.", "##########", "....##...."];
  const cells: React.ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "#") cells.push(<rect key={`${x}-${y}`} x={x} y={y + (y === 7 ? 3 : 1)} width={1} height={1} fill="currentColor" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
      {cells}
    </svg>
  );
}

/** Coracao pixel (desejos/wishlist). Herda currentColor. Sem emoji. */
export function Heart({ size = 12, className = "" }: { size?: number; className?: string }) {
  const rows = ["..##..##..", ".########.", ".########.", "..######..", "...####...", "....##...."];
  const cells: React.ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "#") cells.push(<rect key={`${x}-${y}`} x={x} y={y + 3} width={1} height={1} fill="currentColor" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
      {cells}
    </svg>
  );
}

// glyph pixel generico (mesmo dialeto do Star/Bell): linhas de "#", herda currentColor.
function Glyph({ rows, size = 12, dx = 0, dy = 0, className = "" }: { rows: string[]; size?: number; dx?: number; dy?: number; className?: string }) {
  const cells: React.ReactNode[] = [];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "#") cells.push(<rect key={`${x}-${y}`} x={x + dx} y={y + dy} width={1} height={1} fill="currentColor" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
      {cells}
    </svg>
  );
}

/** Raio (XP). Herda currentColor. */
export function Xp({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["....##..", "...###..", "..###...", ".######.", "...###..", "..###...", ".##....."]} />;
}

/** Caveira (derrotados). */
export function Skull({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={3} dy={3} className={className} rows={[".#####.", "#######", "#.###.#", "#######", ".#####.", "..#.#.."]} />;
}

/** Relogio (tempo). */
export function Clock({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["..####..", ".#....#.", "#..#...#", "#..##..#", "#......#", ".#....#.", "..####.."]} />;
}

/** Caret pra baixo (dropdown). Triangulo cheio, mesmo desenho da seta do select nativo. */
export function Caret({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={4} className={className} rows={["#######", ".#####.", "..###..", "...#..."]} />;
}

/** Check (confirmado, aplicado, sucesso). Herda currentColor. */
export function Check({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={3} className={className} rows={[".......#", "......##", ".....##.", "#...##..", "##.##...", ".###....", "..#....."]} />;
}

/** X de fechar/remover. Herda currentColor. */
export function Close({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["##...##", ".##.##.", "..###..", "...#...", "..###..", ".##.##.", "##...##"]} />;
}

/** Chevron pra esquerda (paginacao anterior). */
export function ChevronLeft({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={4} dy={3} className={className} rows={["..##", ".##.", "##..", ".##.", "..##"]} />;
}

/** Chevron pra direita (paginacao proxima, "ir pra"). */
export function ChevronRight({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={4} dy={3} className={className} rows={["##..", ".##.", "..##", ".##.", "##.."]} />;
}

/** Mais (adicionar, incrementar). */
export function Plus({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["...##...", "...##...", "...##...", "########", "########", "...##...", "...##..."]} />;
}

/** Menos (remover, decrementar). */
export function Minus({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={5} className={className} rows={["########", "########"]} />;
}

/** Infinito (ilimitado, sem cap). */
export function Infinity_({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={1} dy={4} className={className} rows={[".##...##.", "#..#.#..#", "#..#.#..#", ".##...##."]} />;
}

/** Seta pra baixo (download, baixar/importar bookmarklet). */
export function ArrowDown({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["...##...", "...##...", "...##...", "########", ".######.", "..####..", "...##..."]} />;
}

/** Preco em dolares do jogo: moeda + valor. */
export function Gold({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Coin />
      {value.toLocaleString("pt-BR")}
    </span>
  );
}
