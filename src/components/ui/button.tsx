"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Botao primitivo.
 *
 * A primitiva FECHA o tamanho e abre so a variante: `size` e um enum de tres
 * degraus, nunca uma altura livre. Foi assim que o `!h-7` por instancia deixou
 * de existir — se um botao precisa de outra altura, ou e outro degrau ou o
 * layout esta errado.
 */

type Variant = "primary" | "neon" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent/15 text-accent border-accent/45 hover:bg-accent/25 hover:border-accent/70 " +
    "active:bg-accent/35 shadow-[0_0_16px_-6px_var(--color-accent)]",
  neon:
    "bg-neon/12 text-neon border-neon/40 hover:bg-neon/22 hover:border-neon/70 " +
    "active:bg-neon/30 shadow-[0_0_16px_-6px_var(--color-neon)]",
  outline:
    "bg-transparent text-text-dim border-line hover:text-text hover:border-line-strong " +
    "hover:bg-surface-2 active:bg-surface-3",
  ghost:
    "bg-transparent text-text-dim border-transparent hover:text-text hover:bg-surface-2 " +
    "active:bg-surface-3",
  danger:
    "bg-danger/12 text-danger border-danger/45 hover:bg-danger/22 hover:border-danger/70 " +
    "active:bg-danger/30",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2 text-[12px] gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
  lg: "h-10 px-4 text-[14px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** liga o estado ATIVO (usado por filtro/toggle) — hierarquia, nao cor solta */
  active?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** ocupa a largura toda do pai */
  block?: boolean;
}

export function Button({
  variant = "outline",
  size = "md",
  active,
  iconLeft,
  iconRight,
  block,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-active={active || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-pix",
        "border font-medium uppercase tracking-wide transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        "data-[active]:bg-accent/25 data-[active]:text-accent data-[active]:border-accent/70",
        SIZE[size],
        VARIANT[variant],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

/** Botao que so tem icone — o quadrado do mesmo degrau de altura. */
export interface IconButtonProps extends Omit<ButtonProps, "iconLeft" | "iconRight" | "block"> {
  label: string;
}

export function IconButton({ label, size = "md", className, children, ...props }: IconButtonProps) {
  const square = { sm: "w-7", md: "w-8", lg: "w-10" }[size];
  return (
    <Button
      size={size}
      aria-label={label}
      title={label}
      className={cn("px-0", square, className)}
      {...props}
    >
      {children}
    </Button>
  );
}
