import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * O SELO de estado — e por que ele nao e o `Chip`.
 *
 * Os dois sao pequenos, arredondados e coloridos, e foi por isso que o selo
 * "AO VIVO" da home nasceu como Chip. Eles respondem perguntas diferentes:
 *
 * - `Chip` e CATEGORIA, e o usuario costuma poder mexer nele (filtro escolhido,
 *   tipo, tag removivel). Canto suave, retangular, texto normal.
 * - `Badge` e ESTADO do sistema, e ninguem clica nele: ao vivo, na fila,
 *   recusado, novo. Pilula, caixa alta, e com PONTO — o ponto e o que faz o
 *   estado ser lido antes da palavra, de canto de olho.
 *
 * Misturar os dois custa mais do que parece: chip removivel com cara de estado
 * convida o clique que nao existe, e selo de estado com cara de filtro some no
 * meio dos filtros.
 */

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";

const TONE: Record<Tone, { casca: string; ponto: string }> = {
  neutral: { casca: "bg-surface-3 text-text-dim border-line-strong", ponto: "bg-text-mute" },
  accent: { casca: "bg-accent/14 text-accent border-accent/35", ponto: "bg-accent" },
  ok: { casca: "bg-ok/14 text-ok border-ok/35", ponto: "bg-ok" },
  warn: { casca: "bg-warn/14 text-warn border-warn/35", ponto: "bg-warn" },
  danger: { casca: "bg-danger/14 text-danger border-danger/35", ponto: "bg-danger" },
  info: { casca: "bg-neon/14 text-neon border-neon/35", ponto: "bg-neon" },
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** o ponto antes do texto. Ligado por padrao — e ele que da o sinal periferico */
  dot?: boolean;
  /** o ponto PULSA. So pra estado que esta acontecendo agora (ao vivo, conectando) */
  pulse?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({
  tone = "neutral",
  dot = true,
  pulse,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "pix inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[10px]",
        "whitespace-nowrap",
        t.casca,
        className,
      )}
      {...props}
    >
      {icon}
      {dot && !icon && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {/* O halo que pulsa e um IRMAO do ponto, e nao o ponto escalado: animar
              o proprio ponto faria o texto ao lado tremer junto no subpixel.
              `motion-reduce` desliga — estado que pisca e exatamente o que a
              preferencia de menos movimento existe pra conter. */}
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-pill opacity-70 motion-reduce:hidden",
                t.ponto,
              )}
              aria-hidden="true"
            />
          )}
          <span className={cn("relative h-1.5 w-1.5 rounded-pill", t.ponto)} aria-hidden="true" />
        </span>
      )}
      {children}
    </span>
  );
}
