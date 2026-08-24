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

/**
 * As variantes, e a hierarquia que elas passaram a ter.
 *
 * Antes as cinco eram a mesma receita com cores diferentes: fundo translucido,
 * borda da mesma cor, halo neon. Cinco botoes igualmente discretos numa tela nao
 * formam hierarquia — a acao principal nao ganhava de ninguem, e a tela ficava
 * sem um lugar obvio pra clicar.
 *
 * Agora `primary` e SOLIDO: fundo cheio, texto escuro, elevacao de verdade. Ele
 * e o unico assim de proposito, e e o que faz os outros quatro poderem ser
 * quietos sem sumirem. O halo neon saiu da superficie parada e virou estado — um
 * botao nao precisa acender pra existir, precisa pra responder.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-[#0c0e14] border-transparent font-semibold shadow-elev-2 " +
    "hover:bg-[color-mix(in_oklab,var(--color-accent)_88%,white)] hover:shadow-elev-3 " +
    "active:bg-[color-mix(in_oklab,var(--color-accent)_82%,black)] active:shadow-elev-1",
  neon:
    "bg-neon text-[#06201f] border-transparent font-semibold shadow-elev-2 " +
    "hover:bg-[color-mix(in_oklab,var(--color-neon)_88%,white)] hover:shadow-elev-3 " +
    "active:bg-[color-mix(in_oklab,var(--color-neon)_82%,black)] active:shadow-elev-1",
  outline:
    "bg-surface-2/60 text-text-dim border-line hover:text-text hover:border-line-strong " +
    "hover:bg-surface-2 active:bg-surface-3 shadow-elev-1 hover:shadow-elev-2",
  ghost:
    "bg-transparent text-text-dim border-transparent hover:text-text hover:bg-surface-2/70 " +
    "active:bg-surface-3",
  danger:
    "bg-danger/14 text-danger border-danger/35 hover:bg-danger/22 hover:border-danger/60 " +
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
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[var(--radius-xs)] pointer-coarse:h-11 pointer-coarse:px-4",
  md: "h-9.5 px-4 text-[14px] gap-2 rounded-pix pointer-coarse:h-11 pointer-coarse:px-5",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-pix pointer-coarse:h-12 pointer-coarse:px-6",
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
    "inline-flex select-none items-center justify-center whitespace-nowrap",
    // O raio nao mora aqui: ele vem do DEGRAU, porque botao pequeno com o mesmo
    // raio do grande vira pastilha. Ver `SIZE`.
    "border font-medium uppercase tracking-wide",
    // O botao so tinha `transition-colors`, e cor de hover NAO EXISTE no dedo:
    // no celular o toque nao produzia resposta nenhuma ate a tela mudar, o que
    // le como "nao funcionou" e faz a pessoa tocar de novo. Um pixel de
    // afundamento em 100ms resolve — sem `scale` e sem mola, que e o que a
    // estetica de canto reto pede.
    "transition-[color,background-color,border-color,box-shadow,transform] duration-[120ms] ease-out",
    // O afundar continua, e agora ele tem par: a sombra desce junto. Afundar sem
    // a sombra acompanhar le como o botao escorregando, nao como sendo apertado.
    "active:translate-y-[1px]",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-40",
    // ATIVO e um estado, e e aqui que o brilho ganhou o lugar dele: um anel de
    // acento em vez de fundo cheio, pra o botao ativo nao competir com o
    // primario solido que costuma estar na mesma barra.
    "data-[active]:bg-accent/18 data-[active]:text-accent data-[active]:border-accent/55",
    "data-[active]:shadow-glow-sm",
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
    md: "w-9.5 pointer-coarse:w-11",
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
