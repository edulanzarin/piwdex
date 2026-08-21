import type { SVGProps } from "react";

/**
 * Icones em PIXEL ART de verdade — nao glifo de biblioteca reduzido, nao emoji.
 *
 * O desenho e a propria fonte: cada icone e um grid de texto onde `#` acende um
 * pixel. Isso mantem o icone editavel a olho nu (mexer no desenho e mexer no
 * texto) e garante que ele case com os sprites do jogo, que sao pixel art na
 * mesma escala.
 *
 * Regra de tamanho: pixel art nao escala em fracao. Use multiplos do grid
 * (8, 16, 24) — 14px num grid de 8 borra a linha. `shapeRendering=crispEdges`
 * fecha a porta pro antialias do browser.
 */

type Art = readonly string[];

function draw(art: Art) {
  const cells: React.ReactNode[] = [];
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        // Junta o corrido horizontal num rect so — menos nos no DOM.
        let run = 1;
        while (row[x + run] === "#") run++;
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} />);
        x += run;
      } else {
        x++;
      }
    }
  });
  return cells;
}

interface PixIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function makeIcon(art: Art, grid = 8) {
  const Icon = ({ size = 16, ...props }: PixIconProps) => (
    <svg
      viewBox={`0 0 ${grid} ${grid}`}
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {draw(art)}
    </svg>
  );
  return Icon;
}

export const IconSearch = makeIcon([
  " ###    ",
  "#   #   ",
  "#   #   ",
  "#   #   ",
  " ###    ",
  "    ##  ",
  "     ## ",
  "      ##",
]);

export const IconClose = makeIcon([
  "##    ##",
  "###  ###",
  " ###### ",
  "  ####  ",
  "  ####  ",
  " ###### ",
  "###  ###",
  "##    ##",
]);

export const IconCheck = makeIcon([
  "        ",
  "      ##",
  "     ## ",
  "    ##  ",
  "##  ##  ",
  " ####   ",
  "  ##    ",
  "        ",
]);

export const IconChevronDown = makeIcon([
  "        ",
  "        ",
  "##    ##",
  " ##  ## ",
  "  ####  ",
  "   ##   ",
  "        ",
  "        ",
]);

export const IconChevronUp = makeIcon([
  "        ",
  "        ",
  "   ##   ",
  "  ####  ",
  " ##  ## ",
  "##    ##",
  "        ",
  "        ",
]);

export const IconChevronLeft = makeIcon([
  "        ",
  "     ## ",
  "   ##   ",
  " ##     ",
  " ##     ",
  "   ##   ",
  "     ## ",
  "        ",
]);

export const IconChevronRight = makeIcon([
  "        ",
  " ##     ",
  "   ##   ",
  "     ## ",
  "     ## ",
  "   ##   ",
  " ##     ",
  "        ",
]);

export const IconFilter = makeIcon([
  "########",
  " ###### ",
  "  ####  ",
  "   ##   ",
  "   ##   ",
  "  ####  ",
  "        ",
  "        ",
]);

export const IconGrid = makeIcon([
  "###  ###",
  "###  ###",
  "###  ###",
  "        ",
  "###  ###",
  "###  ###",
  "###  ###",
  "        ",
]);

export const IconRows = makeIcon([
  "########",
  "########",
  "        ",
  "########",
  "########",
  "        ",
  "########",
  "########",
]);

export const IconSort = makeIcon([
  "   ##   ",
  "  ####  ",
  " ###### ",
  "        ",
  "        ",
  " ###### ",
  "  ####  ",
  "   ##   ",
]);

export const IconStar = makeIcon([
  "   ##   ",
  "   ##   ",
  "########",
  " ###### ",
  "  ####  ",
  " ##  ## ",
  "##    ##",
  "        ",
]);

export const IconPlus = makeIcon([
  "        ",
  "   ##   ",
  "   ##   ",
  "########",
  "########",
  "   ##   ",
  "   ##   ",
  "        ",
]);

export const IconMinus = makeIcon([
  "        ",
  "        ",
  "        ",
  "########",
  "########",
  "        ",
  "        ",
  "        ",
]);

export const IconInfo = makeIcon([
  "  ####  ",
  " ##  ## ",
  "##  # ##",
  "##    ##",
  "##  # ##",
  "##  # ##",
  " ##  ## ",
  "  ####  ",
]);

export const IconLink = makeIcon([
  "   #####",
  "   #  ##",
  "      ##",
  " ##   ##",
  " ##   ##",
  " ##     ",
  " ##   ##",
  " #######",
]);

export const IconSwap = makeIcon([
  "  ##    ",
  " ####   ",
  "########",
  "        ",
  "        ",
  "########",
  "   #### ",
  "    ##  ",
]);

/** Poder / ataque — o raio. */
export const IconBolt = makeIcon([
  "    ### ",
  "   ###  ",
  "  ###   ",
  " ###### ",
  "   ###  ",
  "  ###   ",
  " ###    ",
  "###     ",
]);

/** Moeda de ouro — valor de venda. */
export const IconCoin = makeIcon([
  "  ####  ",
  " ###### ",
  "## ## ##",
  "## ## ##",
  "## ## ##",
  "## ## ##",
  " ###### ",
  "  ####  ",
]);

/** Ponto de caca no mapa. */
export const IconPin = makeIcon([
  "  ####  ",
  " ###### ",
  "## ## ##",
  "## ## ##",
  " ###### ",
  "  ####  ",
  "   ##   ",
  "   ##   ",
]);

/** Cadeia evolutiva. */
export const IconEvolve = makeIcon([
  "   ##   ",
  "  ####  ",
  " ###### ",
  "   ##   ",
  "   ##   ",
  " ###### ",
  "  ####  ",
  "   ##   ",
]);
