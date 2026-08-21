import type { AttackCategory } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Icones de DOMINIO em pixel art 8x8 — stat, categoria de golpe, raridade,
 * cabecalho de painel.
 *
 * Separados dos icones de UI (`ui/icons.tsx`) porque falam do jogo, nao da
 * interface: um chevron serve qualquer app, um icone de "Atq. Especial" nao.
 *
 * A regra do desenho e a mesma dos tipos: num grid 8x8 nao cabe ilustracao,
 * cabe SILHUETA. Cada icone tem de se distinguir dos outros a 12px — por isso
 * nenhum repete a forma de outro, nem a dos 18 tipos.
 */

type Art = readonly string[];

function cells(art: Art) {
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

function make(art: Art) {
  return function Icon({ size = 10, className }: { size?: number; className?: string }) {
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
  };
}

// ---------------------------------------------------------------------------
// Stats — na ordem canonica: vida, ataque, defesa, atq esp, def esp, velocidade
// ---------------------------------------------------------------------------

/** Vida: coracao. */
export const IconHp = make([
  " ##  ## ",
  "########",
  "########",
  "########",
  " ###### ",
  "  ####  ",
  "   ##   ",
  "        ",
]);

/** Ataque: espada de lamina vertical com guarda. */
export const IconAtk = make([
  "   ##   ",
  "   ##   ",
  "   ##   ",
  " ###### ",
  "   ##   ",
  "   ##   ",
  "   ##   ",
  "  ####  ",
]);

/** Defesa: escudo cheio. */
export const IconDef = make([
  "########",
  "########",
  "########",
  "########",
  " ###### ",
  " ###### ",
  "  ####  ",
  "   ##   ",
]);

/** Ataque especial: nucleo em losango com faiscas nos cantos. */
export const IconSpAtk = make([
  "#      #",
  "   ##   ",
  "  ####  ",
  " ###### ",
  "  ####  ",
  "   ##   ",
  "#      #",
  "        ",
]);

/** Defesa especial: escudo vazado — mesma silhueta da defesa, casca so. */
export const IconSpDef = make([
  "########",
  "##    ##",
  "##    ##",
  "##    ##",
  " ##  ## ",
  " ##  ## ",
  "  ####  ",
  "   ##   ",
]);

/** Velocidade: chevron duplo. */
export const IconSpeed = make([
  "        ",
  "##  ##  ",
  " ##  ## ",
  "  ##  ##",
  "  ##  ##",
  " ##  ## ",
  "##  ##  ",
  "        ",
]);

/** Os seis, na ordem canonica — pra iterar junto com os stats. */
export const STAT_ICONS = [IconHp, IconAtk, IconDef, IconSpAtk, IconSpDef, IconSpeed] as const;

// ---------------------------------------------------------------------------
// Categoria do golpe
// ---------------------------------------------------------------------------

/** Fisico: punho fechado. */
export const IconPhysical = make([
  "        ",
  " ###### ",
  "########",
  "## ## ##",
  "########",
  "########",
  " ###### ",
  "        ",
]);

/** Especial: orbe (anel). */
export const IconSpecial = make([
  "  ####  ",
  " ###### ",
  "##    ##",
  "##    ##",
  "##    ##",
  "##    ##",
  " ###### ",
  "  ####  ",
]);

/** Status: barras de modificador, decrescentes. */
export const IconStatus = make([
  "        ",
  "########",
  "        ",
  "######  ",
  "        ",
  "####    ",
  "        ",
  "##      ",
]);

const CATEGORY_ICON: Record<AttackCategory, ReturnType<typeof make>> = {
  PHYSICAL: IconPhysical,
  SPECIAL: IconSpecial,
  STATUS: IconStatus,
};

export function CategoryIcon({
  category,
  size = 10,
  className,
}: {
  category: AttackCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  return Icon ? <Icon size={size} className={className} /> : null;
}

// ---------------------------------------------------------------------------
// Marcadores de dominio
// ---------------------------------------------------------------------------

/** Raridade: gema lapidada. */
export const IconGem = make([
  " ###### ",
  "########",
  "## ## ##",
  " ###### ",
  "  ####  ",
  "  ####  ",
  "   ##   ",
  "        ",
]);

/** TM: o cartucho da maquina de golpe. */
export const IconTm = make([
  "########",
  "#      #",
  "# #### #",
  "# #  # #",
  "# #### #",
  "#      #",
  "########",
  "        ",
]);

/** Drop: a bolsa de loot. */
export const IconBag = make([
  "  #  #  ",
  " ###### ",
  "########",
  "########",
  "## ## ##",
  "########",
  " ###### ",
  "        ",
]);

/** Nivel: galoes empilhados. */
export const IconLevel = make([
  "        ",
  "     ###",
  "     ###",
  "  ######",
  "  ######",
  "########",
  "########",
  "        ",
]);

/** XP: estrela cheia. */
export const IconXp = make([
  "   ##   ",
  "   ##   ",
  "########",
  " ###### ",
  "  ####  ",
  " ##  ## ",
  "##    ##",
  "        ",
]);

/** Escudo rachado — "como apanha" (o lado defensivo). */
export const IconWeak = make([
  "###  ###",
  "#### ###",
  "### ####",
  "#### ###",
  " ##  ## ",
  " ### ## ",
  "  ####  ",
  "   ##   ",
]);

/** Alvo — cobertura ofensiva. */
export const IconTarget = make([
  "  ####  ",
  " #    # ",
  "#  ##  #",
  "# #### #",
  "# #### #",
  "#  ##  #",
  " #    # ",
  "  ####  ",
]);

/** Balanca — comparacao e total. */
export const IconScale = make([
  "   ##   ",
  "########",
  "##    ##",
  "##    ##",
  " #    # ",
  "   ##   ",
  "   ##   ",
  " ###### ",
]);
