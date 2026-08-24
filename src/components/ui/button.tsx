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

type Variant = "primary" | "neon" | "solido" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * As variantes, e o erro que a versao solida cometeu.
 *
 * A passada anterior fez `primary` ser um preenchimento CHEIO de `--color-accent`,
 * buscando hierarquia. Nao funcionou, e o motivo estava escrito no proprio token:
 * o acento e um aco **quase neutro de proposito** — ele marca estado e sai da
 * frente, pra a cor com significado (tipo, raridade, ferramenta) ter espaco.
 *
 * Cor quase neutra em area cheia nao vira destaque, vira BORRAO CINZA. Preenchimento
 * solido so funciona com matiz saturado; com um cinza-azulado ele le como botao
 * desabilitado de sistema operacional.
 *
 * A saida veio da referencia: fio fino, fundo quase transparente, caixa alta com
 * tracking largo. O que da presenca ali nao e area de cor, e PRECISAO — a borda de
 * 1px, o espaco entre as letras e o respiro interno generoso. Vale pro acento
 * neutro justamente porque nao depende de saturacao pra existir.
 *
 * `solido` fica pra quando HA matiz de verdade: as cenas passam a cor da ferramenta
 * por `style`, e vermelho, verde e ambar cheios funcionam onde o aco nao funcionava.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    "border-accent/45 bg-accent/8 text-accent " +
    "hover:border-accent/80 hover:bg-accent/16 hover:text-text " +
    "active:bg-accent/24",
  neon:
    "border-neon/45 bg-neon/8 text-neon " +
    "hover:border-neon/80 hover:bg-neon/16 " +
    "active:bg-neon/24",
  solido:
    // Sem cor propria: quem usa passa `style={{ backgroundColor }}`. O texto sai
    // escuro porque toda cor de ferramenta desta paleta e clara o bastante pra
    // pedir isso, e a sombra da o peso que o fio fino nao precisa ter.
    "border-transparent text-[color:var(--color-bg)] font-semibold shadow-elev-2 " +
    "hover:brightness-108 hover:shadow-elev-3 active:brightness-95 active:shadow-elev-1",
  outline:
    "border-line bg-transparent text-text-dim " +
    "hover:border-line-strong hover:bg-surface-2/60 hover:text-text active:bg-surface-3",
  ghost:
    "border-transparent bg-transparent text-text-mute " +
    "hover:text-text hover:bg-surface-2/60 active:bg-surface-3",
  danger:
    "border-danger/40 bg-danger/8 text-danger " +
    "hover:border-danger/75 hover:bg-danger/18 active:bg-danger/26",
};

/**
 * O respiro HORIZONTAL subiu muito mais que a altura, e isso e o desenho.
 *
 * Botao de fio fino vive da proporcao: com padding curto, o rotulo encosta na
 * borda e a peca le como campo de formulario. Com o dobro de folga dos lados, o
 * mesmo fio le como botao de site caro. E onde o tracking entra junto — caixa
 * alta espacada precisa da folga, senao a ultima letra bate na borda.
 */
const SIZE: Record<Size, string> = {
  sm: "h-8 px-4 text-[11px] tracking-[0.11em] gap-1.5 rounded-[var(--radius-xs)] pointer-coarse:h-11 pointer-coarse:px-5",
  md: "h-10 px-6 text-[12px] tracking-[0.12em] gap-2 rounded-pix pointer-coarse:h-11 pointer-coarse:px-7",
  lg: "h-12 px-8 text-[13px] tracking-[0.13em] gap-2.5 rounded-pix pointer-coarse:h-13 pointer-coarse:px-9",
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
    // `tracking` sai do DEGRAU e nao daqui: botao pequeno com o mesmo espacamento
    // do grande fica com o rotulo esparramado numa caixa curta.
    "border font-semibold uppercase",
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
