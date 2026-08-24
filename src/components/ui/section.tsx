import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * O TITULO DE SECAO, com o fio que corre ate a borda.
 *
 * Existia inline em cinco telas, sempre com a mesma receita e nunca com a mesma
 * medida: icone de tamanho diferente, gradiente comecando em cor diferente,
 * espessura ora `h-px` ora `border-t`. Cinco versoes de um separador nao sao
 * cinco decisoes — sao uma decisao que ninguem tomou.
 *
 * O fio vai da palavra ate a borda e MORRE em transparente. Um fio de ponta a
 * ponta com opacidade cheia divide a pagina em duas; este ancora o titulo e
 * solta o resto, que e o que separador de secao deve fazer.
 */
export function SectionTitle({
  children,
  icon,
  actions,
  id,
  size = "md",
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  /** o que fica na PONTA direita, depois do fio */
  actions?: ReactNode;
  id?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} id={id}>
      {icon && <span className="shrink-0 text-accent">{icon}</span>}
      <h2 className={cn("pix text-text-dim", size === "sm" ? "text-[12px]" : "text-[14px]")}>
        {children}
      </h2>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-gradient-to-r from-line to-transparent"
      />
      {actions}
    </div>
  );
}

/**
 * A CHEGADA de uma tela: titulo grande, uma linha do que ela responde, e acoes.
 *
 * O topo de ferramenta e chegada, e nao rotulo — quem abre /calc precisa saber em
 * uma linha o que perguntar ali, e nao ler a palavra "calculadora" de novo depois
 * de ter clicado em "calculadora".
 */
export function PageHeader({
  title,
  lead,
  actions,
  tint,
  icon,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** a cor da ferramenta: pinta o icone e o titulo */
  tint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="shrink-0" style={tint ? { color: tint } : undefined}>
              {icon}
            </span>
          )}
          <h1
            className="pix text-[22px] leading-none sm:text-[26px]"
            style={tint ? { color: tint } : undefined}
          >
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {lead && <p className="max-w-2xl text-[14px] leading-relaxed text-text-dim">{lead}</p>}
    </header>
  );
}

/** O fio solto, pra dentro de painel. Existe pra ninguem escrever `h-px bg-line`
 *  na mao pela vigesima vez — e pra o dia em que essa linha mudar mudar num lugar. */
export function Divider({ className, soft }: { className?: string; soft?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-px w-full", soft ? "bg-line/60" : "bg-line", className)}
    />
  );
}
