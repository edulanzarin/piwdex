import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconClose } from "./icons";

/**
 * Selo compacto. Duas familias:
 *  - `tint`: cor de DADO (tipo de pokemon, faixa de raridade) — vem do dado,
 *    nao do tema, entao entra por prop e nao por variante.
 *  - `tone`: cor de INTERFACE (neutro, ok, aviso, perigo).
 */
type Tone = "neutral" | "accent" | "neon" | "ok" | "warn" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-2 text-text-dim",
  accent: "border-accent/45 bg-accent/12 text-accent",
  neon: "border-neon/45 bg-neon/12 text-neon",
  ok: "border-ok/45 bg-ok/12 text-ok",
  warn: "border-warn/45 bg-warn/12 text-warn",
  danger: "border-danger/45 bg-danger/12 text-danger",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** cor crua do dado; vence o `tone` quando presente */
  tint?: string;
  icon?: ReactNode;
  onRemove?: () => void;
  size?: "xs" | "sm";
}

export function Chip({
  tone = "neutral",
  tint,
  icon,
  onRemove,
  size = "sm",
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      style={
        tint
          ? { borderColor: `${tint}70`, backgroundColor: `${tint}1f`, color: tint }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border whitespace-nowrap font-medium tracking-wide",
        size === "xs" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
        !tint && TONE[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover"
          className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <IconClose size={14} />
        </button>
      ) : null}
    </span>
  );
}
