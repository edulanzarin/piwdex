/**
 * Pokebola em pixel art — logo, spinner e marcador de estado.
 *
 * Nao e vermelha: o piwdex2 tem acento proprio (violeta/ciano), e a bola herda
 * `currentColor` na metade de cima pra viver dentro do tema em vez de brigar com
 * ele. Quem quiser a bola canonica passa `className="text-danger"`.
 */

type Palette = { K: string; A: string; B: string };

// K = casco/faixa, A = metade de cima (currentColor), B = metade de baixo.
const ART = [
  ".....KKKKKK.....",
  "...KKAAAAAAKK...",
  "..KAAAAAAAAAAK..",
  ".KAAAAAAAAAAAAK.",
  ".KAAAAAAAAAAAAK.",
  "KAAAAAAAAAAAAAAK",
  "KAAAAAAAAAAAAAAK",
  "KKKKKKKBBKKKKKKK",
  "KKKKKKBBBBKKKKKK",
  "KBBBBBKBBKBBBBBK",
  "KBBBBBBBBBBBBBBK",
  ".KBBBBBBBBBBBBK.",
  ".KBBBBBBBBBBBBK.",
  "..KBBBBBBBBBBK..",
  "...KKBBBBBBKK...",
  ".....KKKKKK.....",
];

function cells(fill: keyof Palette) {
  const out: React.ReactNode[] = [];
  ART.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === fill) {
        let run = 1;
        while (row[x + run] === fill) run++;
        out.push(<rect key={`${fill}${x}-${y}`} x={x} y={y} width={run} height={1} />);
        x += run;
      } else {
        x++;
      }
    }
  });
  return out;
}

export interface PokeballProps {
  size?: number;
  className?: string;
  /** gira em passos (steps), como sprite de jogo — nao rotacao suave de CSS */
  spinning?: boolean;
  title?: string;
}

export function Pokeball({ size = 16, className, spinning, title }: PokeballProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={[spinning ? "anim-spin" : "", className ?? ""].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g fill="#0a0d15">{cells("K")}</g>
      <g fill="currentColor">{cells("A")}</g>
      <g fill="#e8edf7">{cells("B")}</g>
    </svg>
  );
}
