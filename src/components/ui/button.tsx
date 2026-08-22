"use client";

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
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

/**
 * O degrau vale pro MOUSE; no dedo ele sobe.
 *
 * `pointer-coarse` e a pergunta certa — "quem aponta e um dedo?" —, nao a
 * largura da janela: desktop com a janela estreita continua no mouse e nao
 * precisa de 44px, tablet grande com toque precisa. O enum continua fechado (o
 * chamador nao escolhe altura); o que muda e o valor de cada degrau por
 * apontador, e isso vive AQUI, num lugar so.
 */
const SIZE: Record<Size, string> = {
  sm: "h-7 px-2 text-[13px] gap-1.5 pointer-coarse:h-11 pointer-coarse:px-3",
  md: "h-8 px-3 text-[14px] gap-2 pointer-coarse:h-11 pointer-coarse:px-4",
  lg: "h-10 px-4 text-[15px] gap-2 pointer-coarse:h-12 pointer-coarse:px-5",
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

/** A casca do botao, sem o elemento. Existe pra o `ButtonLink` nao copiar a lista
 *  de classes: botao e link que parecem iguais TEM que ser a mesma casca, senao um
 *  dos dois envelhece sozinho. */
function shell(variant: Variant, size: Size, block?: boolean, className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-none",
    "border font-medium uppercase tracking-wide",
    // O botao so tinha `transition-colors`, e cor de hover NAO EXISTE no dedo:
    // no celular o toque nao produzia resposta nenhuma ate a tela mudar, o que
    // le como "nao funcionou" e faz a pessoa tocar de novo. Um pixel de
    // afundamento em 100ms resolve — sem `scale` e sem mola, que e o que a
    // estetica de canto reto pede.
    "transition-[color,background-color,border-color,transform] duration-100 ease-out",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-40",
    "data-[active]:bg-accent/25 data-[active]:text-accent data-[active]:border-accent/70",
    SIZE[size],
    VARIANT[variant],
    block && "w-full",
    className,
  );
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
      className={shell(variant, size, block, className)}
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
  // Quadrado do mesmo degrau — e no toque ele acompanha a altura, senao o botao
  // de fechar do modal fica 32x44: alto o bastante e estreito demais.
  const square = {
    sm: "w-8 pointer-coarse:w-11",
    md: "w-9 pointer-coarse:w-11",
    lg: "w-11 pointer-coarse:w-12",
  }[size];
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

/**
 * O mesmo botao, mas e um LINK.
 *
 * Nao e preciosismo semantico: navegacao que nasce de `<button onClick>` perde o
 * "abrir em nova aba", o menu de contexto, o atalho do teclado e o rastro que o
 * leitor de tela le. E um link de saida (pagamento, jogo) e exatamente o caso em
 * que a pessoa vai querer abrir noutra aba.
 *
 * `external` liga `target="_blank"` com o `rel` que fecha a brecha do
 * `window.opener` — a aba nova nao pode ganhar controle da nossa.
 */
export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  external?: boolean;
}

export function ButtonLink({
  variant = "outline",
  size = "md",
  iconLeft,
  iconRight,
  block,
  external,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={shell(variant, size, block, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : null)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </a>
  );
}
