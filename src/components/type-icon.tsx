/**
 * Simbolo dos 18 tipos, DESENHADO aqui.
 *
 * Eram lucide embrulhado, e o problema nao era o desenho — era o registro: traco
 * fino e neutro num produto que pede massa, e a 12-14px (onde 16 dos 21 usos
 * vivem) o contorno perde metade da forma pro antisserrilhado e vira cinza.
 * Cheio se le.
 *
 * ## A silhueta continua sendo o criterio, e nao a metafora bonita
 *
 * A 14px o que se le e a FORMA, e dois contornos parecidos lado a lado no mesmo
 * badge viram a mesma mancha. Por isso Terrestre e camada e Pedra e bloco
 * facetado, e nao as duas montanhas; Psiquico e olho e Fada e flor, e nao as
 * duas estrelas; Fogo tem a base ondulada e Agua a base redonda, que e o que
 * separa duas gotas.
 *
 * O par COR + FORMA e proposital: quem nao distingue matiz continua separando os
 * tipos pela forma, coisa que cor sozinha nunca resolve.
 */
import type { ReactNode } from "react";
import type { PokeType } from "@/lib/types";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, multWord } from "@/lib/labels";
import type { TypeMult } from "@/lib/typing";
import { cn } from "@/lib/cn";

const TYPE_ICON: Record<PokeType, ReactNode> = {
  NORMAL: (
    <>
    <path d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8zm0 4.6a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z"/>
    </>
  ),
  FIRE: (
    <>
    <path d="M12.6 1.4c3.4 4 2 6.4.6 8.2-1.2 1.5-2.6 2.9-2.2 5-2-1-2.4-3-2.4-3-2 2-2.6 4-2.6 5.6a8 8 0 0 0 16 0c0-6-6-9.8-9.4-15.8z"/>
    </>
  ),
  WATER: (
    <>
    <path d="M12 1.6c4 5.4 8 9.4 8 13.2a8 8 0 0 1-16 0c0-3.8 4-7.8 8-13.2z"/>
    </>
  ),
  ELECTRIC: (
    <>
    <path d="M14.6 1.2 4.4 13.4a.9.9 0 0 0 .7 1.5h4.2l-1.5 7.5a.9.9 0 0 0 1.6.7l10-12.2a.9.9 0 0 0-.7-1.5h-4.1l1.5-7.5a.9.9 0 0 0-1.5-.7z"/>
    </>
  ),
  GRASS: (
    <>
    <path d="M20.6 2.4C10.4 2 3.4 6.6 3.4 13.8c0 2.3.8 4.2 2 5.6L3 21.8l1.7 1.7 2.4-2.4c1.5 1.1 3.3 1.7 5.2 1.7 0-6.4 2.6-11.2 7-14.6-4.8 1.4-8 4.4-9.8 8.6-.5-1-.7-2-.7-3 0-5.2 5-8.8 11.8-8.4z"/>
    </>
  ),
  ICE: (
    <>
    <path d="M13.2 1.4v4.2l2.2-2.2 1.7 1.7-3.9 3.9v2.4l2-1.2 5.4-3.1.9 2.3-2.9 1.7 3 .8-.6 2.3-5.7-1.5-2.1 1.2 2.1 1.2 5.7-1.5.6 2.3-3 .8 2.9 1.7-.9 2.3-5.4-3.1-2-1.2v2.4l3.9 3.9-1.7 1.7-2.2-2.2v4.2h-2.4v-4.2l-2.2 2.2-1.7-1.7 3.9-3.9v-2.4l-2 1.2-5.4 3.1-.9-2.3 2.9-1.7-3-.8.6-2.3 5.7 1.5 2.1-1.2-2.1-1.2-5.7 1.5-.6-2.3 3-.8-2.9-1.7.9-2.3 5.4 3.1 2 1.2V9l-3.9-3.9 1.7-1.7 2.2 2.2V1.4z" transform="translate(0 .6) scale(.96)"/>
    </>
  ),
  FIGHTING: (
    <>
    <path d="M5.6 9.2h11a3 3 0 0 1 3 3v4.4a4.8 4.8 0 0 1-4.8 4.8H8.4a4.8 4.8 0 0 1-4.8-4.8v-4.4a3 3 0 0 1 2-3z"/><path d="M6.6 3.4a1.9 1.9 0 0 1 1.9 1.9v4H4.7v-4a1.9 1.9 0 0 1 1.9-1.9z"/><path d="M11 2.8a1.9 1.9 0 0 1 1.9 1.9v4.5H9.1V4.7A1.9 1.9 0 0 1 11 2.8z"/><path d="M15.4 3.4a1.9 1.9 0 0 1 1.9 1.9v4h-3.8v-4a1.9 1.9 0 0 1 1.9-1.9z"/><path d="M20.4 11.2a2.2 2.2 0 0 1 0 4.4h-1.6v-4.4z"/>
    </>
  ),
  POISON: (
    <>
    <path d="M12 1.8a8 8 0 0 0-8 8c0 2.7 1.3 5 3.4 6.5v2.3a1.6 1.6 0 0 0 1.6 1.6h6a1.6 1.6 0 0 0 1.6-1.6v-2.3A8 8 0 0 0 20 9.8a8 8 0 0 0-8-8zM8.8 8.4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6.4 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/><path d="M9.4 20.4h1.4v1.8H9.4zm3.2 0H14v1.8h-1.4z"/>
    </>
  ),
  GROUND: (
    <>
    <path d="M2 12.6h20v2.6H2z"/><path d="M2 17.2h20v2.6H2z"/><path d="M6.4 4.2h11.2l3 6.2H3.4z"/>
    </>
  ),
  FLYING: (
    <>
    <path d="M22 3.2c-1.4 8-6.6 12.4-12 13.6l-1.6 4.4-2.4-.8 1.4-3.8C4 16.2 2.4 14.4 2 12.2c2.6 2 5.6 1.8 7.6.4-2.4-.4-4.2-1.6-5.2-3.4 3 1.8 6 1.2 8-.4-2 0-3.8-.8-5-2.2 3.8 1.2 7.4-.2 9.6-2.2 2-1.8 3.6-1.6 5-1.2z"/>
    </>
  ),
  PSYCHIC: (
    <>
    <path d="M12 4.4c-5 0-9.2 3.4-11 7.6 1.8 4.2 6 7.6 11 7.6s9.2-3.4 11-7.6c-1.8-4.2-6-7.6-11-7.6zm0 3.4a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4z"/><path d="M12 9.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z"/>
    </>
  ),
  BUG: (
    <>
    <path d="M12 6.4c3.2 0 5.6 2.8 5.6 6.6s-2.4 6.8-5.6 6.8-5.6-3-5.6-6.8 2.4-6.6 5.6-6.6z"/><path d="M8.6 1.6 11 5l-1.9 1.4-2.4-3.4zM15.4 1.6l1.9 1.4-2.4 3.4L13 5z"/><path d="M2.6 9.4h4v2.2h-4zm14.8 0h4v2.2h-4zM2.6 15h4v2.2h-4zm14.8 0h4v2.2h-4z"/>
    </>
  ),
  ROCK: (
    <>
    <path d="M8.6 2.8h7l6 7.4-9.6 11-9.6-11z"/><path d="M8.6 2.8 2.4 10.2h8.2z" opacity=".45"/><path d="M15.6 2.8 21.6 10.2h-8.2z" opacity=".65"/><path d="M12 21.2 2.4 10.2h19.2z" opacity=".85"/>
    </>
  ),
  GHOST: (
    <>
    <path d="M12 1.8a8.4 8.4 0 0 0-8.4 8.4v11.2l2.8-2.4 2.8 2.4 2.8-2.4 2.8 2.4 2.8-2.4 2.8 2.4V10.2A8.4 8.4 0 0 0 12 1.8zM9 8.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zm6 0a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z"/>
    </>
  ),
  DRAGON: (
    <>
    <path d="M4.2 2.2c2 .4 3.4 1.6 4.2 3.4l2-1.2 1.8 2.6 2.4-1.4 1.2 3 3-.6-.4 3.2 2.6.8-1.8 2.6 2 1.8-2.8 1.6.8 2.8-3.2-.4-.6 3-2.6-1.8-2 2.4-1.6-2.8-3 1.2.2-3.2-3.2-.2 1.4-2.8-2.4-2 2.8-1.6-1.4-2.8 3-.2z"/><path d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z" fill="none"/>
    </>
  ),
  DARK: (
    <>
    <path d="M13.6 1.8a10.2 10.2 0 1 0 8.6 14.6 8 8 0 0 1-8.6-14.6z"/>
    </>
  ),
  STEEL: (
    <>
    <path d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8zm0 5.8a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2z"/>
    </>
  ),
  FAIRY: (
    <>
    <path d="M12 2.4c1.8 0 2.4 2 2 3.6 1.4-.9 3.3-.7 3.9.8.6 1.5-.8 2.9-2.4 3.3 1.6.4 3 1.8 2.4 3.3-.6 1.5-2.5 1.7-3.9.8.4 1.6-.2 3.6-2 3.6s-2.4-2-2-3.6c-1.4.9-3.3.7-3.9-.8-.6-1.5.8-2.9 2.4-3.3-1.6-.4-3-1.8-2.4-3.3.6-1.5 2.5-1.7 3.9-.8-.4-1.6.2-3.6 2-3.6z"/><path d="M19.6 17.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>
    </>
  ),
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
  const corpo = TYPE_ICON[type];
  if (!corpo) return null;
  const s = Math.max(13, size);
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="currentColor"
      className={cn("shrink-0", className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {corpo}
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
  const label = known ? TYPE_LABEL[type] : "Sem tipo";

  return (
    <span
      style={{ borderColor: `${color}5c`, backgroundColor: `${color}1f`, color }}
      className={cn(
        "inline-flex items-center gap-1.5 border whitespace-nowrap",
        size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
        "font-medium tracking-wide",
        // Com rotulo e uma PASTILHA (retangulo de canto miudo); sem rotulo e um
        // DISCO. Nao e capricho: um quadrado de 28px com um glifo dentro le como
        // botao de barra de ferramentas, e um disco le como emblema. O selo de
        // tipo sem palavra e emblema — ele identifica, nao aciona.
        showLabel ? "rounded-[var(--radius-xs)]" : "rounded-pill",
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
