import type { PokeType } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { cn } from "@/lib/cn";

/**
 * Simbolo de cada um dos 18 tipos, em pixel art 8x8.
 *
 * Num grid de 8x8 nao cabe desenho: cabe SIMBOLO. Por isso cada tipo virou uma
 * silhueta distinta a distancia (gota, chama, crescente, engrenagem) em vez de
 * uma ilustracao encolhida, que a 16px vira mancha. O par cor+forma tambem e
 * proposital — quem nao distingue matiz ainda separa os tipos pela forma, o que
 * cor sozinha nunca resolve.
 *
 * O tipo pode vir `NEUTRAL` num golpe (golpe sem tipo, fora dos 18 canonicos):
 * quem consome isto precisa de fallback — ver `TypeBadge`.
 */

const ART: Record<PokeType, readonly string[]> = {
  NORMAL: [
    "  ####  ",
    " ###### ",
    "########",
    "########",
    "########",
    "########",
    " ###### ",
    "  ####  ",
  ],
  FIRE: [
    "   ##   ",
    "  ###   ",
    "  ####  ",
    " ###### ",
    " ###### ",
    "########",
    " ###### ",
    "  ####  ",
  ],
  WATER: [
    "   ##   ",
    "   ##   ",
    "  ####  ",
    " ###### ",
    "########",
    "########",
    " ###### ",
    "  ####  ",
  ],
  ELECTRIC: [
    "    ### ",
    "   ###  ",
    "  ###   ",
    " ###### ",
    "   ###  ",
    "  ###   ",
    " ###    ",
    "###     ",
  ],
  GRASS: [
    "    ####",
    "   #####",
    "  ######",
    " #######",
    " ###### ",
    " #####  ",
    "###     ",
    "#       ",
  ],
  ICE: [
    "#  ##  #",
    "## ## ##",
    " ###### ",
    "   ##   ",
    "   ##   ",
    " ###### ",
    "## ## ##",
    "#  ##  #",
  ],
  FIGHTING: [
    " ###### ",
    "########",
    "## ## ##",
    "########",
    "########",
    " ###### ",
    "  ####  ",
    "        ",
  ],
  POISON: [
    " ###### ",
    "########",
    "## ## ##",
    "## ## ##",
    "########",
    " ###### ",
    " # ## # ",
    " ###### ",
  ],
  GROUND: [
    "        ",
    "   ##   ",
    "  ####  ",
    " ###### ",
    "########",
    "        ",
    "########",
    "########",
  ],
  FLYING: [
    "        ",
    "##      ",
    "####    ",
    "####### ",
    "########",
    " ###### ",
    "   ###  ",
    "        ",
  ],
  PSYCHIC: [
    " ###### ",
    " #      ",
    " # #### ",
    " # #  # ",
    " # ## # ",
    " #    # ",
    " ###### ",
    "        ",
  ],
  BUG: [
    "#      #",
    " #    # ",
    "  ####  ",
    " ###### ",
    "########",
    " ###### ",
    "  ####  ",
    " #    # ",
  ],
  ROCK: [
    "        ",
    "   ###  ",
    "  ##### ",
    " #######",
    "########",
    "########",
    " ###### ",
    "        ",
  ],
  GHOST: [
    "  ####  ",
    " ###### ",
    "## ## ##",
    "########",
    "########",
    "########",
    "########",
    "# ## # #",
  ],
  DRAGON: [
    "   ##   ",
    "  ####  ",
    " ###### ",
    "########",
    "########",
    " ###### ",
    "  ####  ",
    "   ##   ",
  ],
  DARK: [
    "  ####  ",
    " ###### ",
    "###   ##",
    "###     ",
    "###     ",
    "###   ##",
    " ###### ",
    "  ####  ",
  ],
  STEEL: [
    " # ## # ",
    " ###### ",
    "###  ###",
    "##    ##",
    "##    ##",
    "###  ###",
    " ###### ",
    " # ## # ",
  ],
  FAIRY: [
    "   ##   ",
    "   ##   ",
    "#  ##  #",
    "########",
    "########",
    "#  ##  #",
    "   ##   ",
    "   ##   ",
  ],
};

function cells(art: readonly string[]) {
  const out: React.ReactNode[] = [];
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let run = 1;
        while (row[x + run] === "#") run++;
        out.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} />);
        x += run;
      } else {
        x++;
      }
    }
  });
  return out;
}

export function TypeIcon({
  type,
  size = 10,
  className,
}: {
  type: PokeType;
  size?: number;
  className?: string;
}) {
  const art = ART[type];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      {cells(art)}
    </svg>
  );
}

/**
 * Selo de tipo: icone + nome, na cor canonica do tipo.
 *
 * A cor vem de `TYPE_COLOR` (dado do jogo), nunca do tema — por isso entra por
 * `style` e nao por classe utilitaria.
 */
export function TypeBadge({
  type,
  size = "sm",
  showLabel = true,
  className,
}: {
  type: PokeType | "NEUTRAL";
  size?: "xs" | "sm";
  showLabel?: boolean;
  className?: string;
}) {
  // Golpe sem tipo existe no jogo (`NEUTRAL`) e nao esta nos 18 — cai no neutro.
  const known = type !== "NEUTRAL";
  const color = known ? TYPE_COLOR[type] : "var(--color-text-mute)";

  return (
    <span
      style={{ borderColor: `${color}66`, backgroundColor: `${color}1c`, color }}
      className={cn(
        "pix inline-flex items-center gap-1 rounded-pix border whitespace-nowrap",
        size === "xs" ? "h-4 px-1 text-[10px]" : "h-5 px-1.5 text-[11px]",
        !showLabel && (size === "xs" ? "w-4 justify-center px-0" : "w-5 justify-center px-0"),
        className,
      )}
      title={known ? type : "Sem tipo"}
    >
      {known ? <TypeIcon type={type} size={size === "xs" ? 8 : 10} /> : null}
      {showLabel ? type : null}
    </span>
  );
}
