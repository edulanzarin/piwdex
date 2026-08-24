/**
 * Simbolo dos 18 tipos.
 *
 * Cada tipo tem um icone do lucide escolhido pela SILHUETA distinta — a 14px o
 * que se le e a forma, e dois contornos parecidos lado a lado no mesmo badge
 * viram a mesma mancha. Por isso Terrestre e camada e Pedra e montanha, e nao
 * as duas montanhas; e por isso Psiquico e olho e Fada e faisca, e nao as duas
 * estrelas.
 *
 * O par COR + FORMA e proposital: quem nao distingue matiz continua separando
 * os tipos pela forma, coisa que cor sozinha nunca resolve.
 */
import {
  Bug,
  Circle,
  Droplet,
  Eye,
  Feather,
  Flame,
  Gem,
  Ghost,
  Layers,
  Leaf,
  Moon,
  Mountain,
  Bolt as Nut,
  Skull,
  Snowflake,
  Sparkles,
  Swords,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PokeType } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, multWord } from "@/lib/labels";
import type { TypeMult } from "@/lib/typing";
import { cn } from "@/lib/cn";

const TYPE_ICON: Record<PokeType, LucideIcon> = {
  NORMAL: Circle,
  FIRE: Flame,
  WATER: Droplet,
  ELECTRIC: Zap,
  GRASS: Leaf,
  ICE: Snowflake,
  FIGHTING: Swords,
  POISON: Skull,
  GROUND: Layers,
  FLYING: Feather,
  PSYCHIC: Eye,
  BUG: Bug,
  ROCK: Mountain,
  GHOST: Ghost,
  DRAGON: Gem,
  DARK: Moon,
  STEEL: Nut,
  FAIRY: Sparkles,
};

export function TypeIcon({
  type,
  size = 14,
  className,
  style,
}: {
  type: PokeType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = TYPE_ICON[type];
  if (!Icon) return null;
  const s = Math.max(13, size);
  return (
    <Icon
      size={s}
      strokeWidth={s <= 16 ? 2.25 : 2}
      className={cn("shrink-0", className)}
      style={style}
      aria-hidden="true"
    />
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
  const label = known ? TYPE_LABEL[type] : "Sem tipo";

  return (
    <span
      style={{ borderColor: `${color}5c`, backgroundColor: `${color}1f`, color }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border whitespace-nowrap",
        size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
        "font-medium tracking-wide",
        !showLabel && (size === "xs" ? "w-6 justify-center px-0" : "w-7 justify-center px-0"),
        className,
      )}
      title={label}
    >
      {known ? <TypeIcon type={type} size={size === "xs" ? 13 : 14} /> : null}
      {showLabel ? label : null}
    </span>
  );
}

/**
 * Tipo + multiplicador de efetividade, na cor do tipo.
 *
 * O `title` traz a leitura por EXTENSO ("dano dobrado") porque "x2" e "1/4" sao
 * dialeto de quem ja joga — e a ficha tambem serve quem esta chegando.
 */
export function TypeMultChip({
  m,
  tone,
  className,
}: {
  m: TypeMult;
  /** classe de cor do multiplicador: perigo, ok, acento ou neutro */
  tone: string;
  className?: string;
}) {
  const color = TYPE_COLOR[m.type];
  return (
    <span
      style={{ borderColor: `${color}5c`, backgroundColor: `${color}1c` }}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-xs)] border px-2.5 text-[12px] font-medium",
        className,
      )}
      title={`${TYPE_LABEL[m.type]}: ${multWord(m.mult)}`}
    >
      <TypeIcon type={m.type} size={16} style={{ color }} />
      <span style={{ color }}>{TYPE_LABEL[m.type]}</span>
      <span className={cn("font-bold", tone)}>{m.label}</span>
    </span>
  );
}
