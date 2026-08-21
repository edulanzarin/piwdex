import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bloco de conteudo. A hierarquia e por SUPERFICIE (profundidade), nao por
 * borda grossa — a borda so aparece porque o fundo sozinho nao separa o
 * suficiente num tema quase preto.
 */

// `title` do HTML e string (vira tooltip nativo); aqui ele e o CABECALHO do
// painel e aceita no. Por isso o nativo sai do tipo herdado.
export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** rotulo pixel no topo, com a linha divisoria */
  title?: ReactNode;
  /** area a direita do titulo: acoes, contagem, toggles */
  actions?: ReactNode;
  /** camada acima da base — pra painel dentro de painel */
  raised?: boolean;
  /** o brilho de scanline do console */
  scan?: boolean;
  bodyClassName?: string;
}

export function Panel({
  title,
  actions,
  raised,
  scan,
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn("panel relative", raised && "bg-surface-2/90", scan && "scanline", className)}
      {...props}
    >
      {(title || actions) && (
        <header className="flex min-h-9 items-center justify-between gap-3 border-b border-line px-3 py-2">
          {title ? <h2 className="pix text-[10px] text-text-dim">{title}</h2> : <span />}
          {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
        </header>
      )}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Rotulo de secao dentro de um painel — o degrau abaixo do titulo. */
export function FieldLabel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <span className={cn("pix block text-[9px] text-text-mute", className)} {...props}>
      {children}
    </span>
  );
}
