// Icones pixel (SVG, crispEdges) — moeda de DOLAR do jogo e preco formatado. Sem emoji.
// O jogo nao publica um arquivo de icone pra moeda (usa emoji/formato de numero); entao
// desenhamos a nossa, uma moeda dourada com "$" pra ler como dolar (nao "ouro generico").

export function Coin({ size = 14, className = "" }: { size?: number; className?: string }) {
  // A moeda do jogo e DOLAR, nao ouro — entao o icone e uma NOTA de dolar (verde) com
  // "$" claro no centro, borda escura. 12x12, cantos retos (pixel).
  const D = "#1b8a52", G = "#35e08e", L = "#eafff2";
  const C: Record<string, string> = { D, G, L };
  const ROWS = [
    "............",
    "............",
    ".DDDDDDDDDD.",
    ".DGGGGGGGGD.",
    ".DGGGLLLGGD.",
    ".DGGGLLGGGD.",
    ".DGGGLLLGGD.",
    ".DGGGGLLGGD.",
    ".DGGGLLLGGD.",
    ".DDDDDDDDDD.",
    "............",
    "............",
  ];
  const cells: React.ReactNode[] = [];
  ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = C[ch];
      if (fill) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" className={className} style={{ imageRendering: "pixelated" }} aria-hidden>
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

/** Treinador (conta): busto pixel. Herda currentColor. Mesma familia do Star/Bell —
 *  fecha o set pra a aba de conta nao precisar de icone de linha. */
export function Trainer({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={1} className={className} rows={["...##...", "..####..", "..####..", "...##...", ".######.", "########", "########", "########"]} />;
}

/** Robo (automacao): cabeca de robo pixel com antena e olhos (vazados). currentColor. */
export function Robot({ size = 14, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={1} className={className} rows={["...##...", "...##...", ".######.", "#.####.#", "#.#..#.#", "#.####.#", ".######.", "..#..#.."]} />;
}

/** Sinal/conexao (monitor do robo): barras crescentes estilo wifi pixel. currentColor. */
export function Signal({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["......##", "......##", "...##.##", "...##.##", "##.##.##", "##.##.##", "##.##.##"]} />;
}

/** Alvo/mira (hunt, modo auto): crosshair pixel. currentColor. */
export function Target({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["...##...", ".######.", ".#.##.#.", "########", "########", ".#.##.#.", ".######.", "...##..."]} />;
}

/** Bandeira (meta de leveling). currentColor. */
export function Flag({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["##......", "#######.", "########", "#######.", "##......", "##......", "##......", "##......"]} />;
}

/** Cerebro (o "analisador brutal": decisoes do robo). currentColor. */
export function Brain({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={[".##..##.", "########", "##.##.##", "########", "##.##.##", "########", ".######.", "..#..#.."]} />;
}

/** Grafico de barras (estatisticas/painel). currentColor. */
export function Chart({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={["......##", "......##", "...##.##", "...##.##", "##.##.##", "########", "########"]} />;
}

/** Espada (kills/combate). currentColor. */
export function Sword({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={2} className={className} rows={[".....###", "....###.", "...###..", "#..##...", ".####...", "..##....", ".#..#...", "#....#.."]} />;
}

/** Mochila (acervo/capturados). currentColor. */
export function Backpack({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <Glyph size={size} dx={2} dy={1} className={className} rows={["..####..", ".#....#.", "########", "##....##", "##.##.##", "##.##.##", "##....##", "########"]} />;
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
