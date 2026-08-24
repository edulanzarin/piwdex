import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * ROTULO a esquerda, VALOR a direita — a linha mais repetida do site inteiro.
 *
 * Ficha de especie, ficha de item, painel do robo, resumo da calculadora: todos
 * mostram pares. Cada tela escrevia o seu, e o resultado eram quatro alinhamentos
 * diferentes de valor (uns a esquerda, uns a direita) na mesma sessao de uso.
 *
 * Duas regras que a primitiva CRAVA, e sao elas que fazem a lista virar tabela
 * sem ser uma:
 *
 * 1. O valor alinha a DIREITA e vai no mono. Numero que se compara entre linhas
 *    precisa da unidade caindo na mesma coluna — com valor a esquerda, "9" e
 *    "1.204" comecam juntos e terminam em lugares diferentes, e o olho perde a
 *    escada.
 * 2. O rotulo NAO encolhe o valor. `min-w-0` no rotulo e nao no valor: quando
 *    falta espaco, quem trunca e a palavra, nunca o numero — numero truncado nao
 *    e um numero, e uma afirmacao errada.
 */
export function DataRow({
  label,
  value,
  hint,
  tint,
  emphasis,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** segunda linha, embaixo do rotulo — pro que precisa de contexto */
  hint?: ReactNode;
  /** cor do valor */
  tint?: string;
  /** destaca a linha: valor maior e texto cheio. Pro total, nao pra cada item */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate text-[13px]",
            emphasis ? "text-text" : "text-text-mute",
          )}
        >
          {label}
        </span>
        {hint && <span className="truncate text-[11px] text-text-mute">{hint}</span>}
      </span>
      <span
        className={cn(
          "num shrink-0 text-right tabular-nums",
          emphasis ? "text-[15px] font-semibold text-text" : "text-[13px] text-text-dim",
        )}
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A lista de pares, com fio entre linhas.
 *
 * `divide-y` e nao borda por linha: borda por linha desenha um fio a mais no fim
 * da lista, e aquele fio solto embaixo do ultimo item e o que faz um bloco
 * parecer cortado no meio.
 */
export function DataList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col divide-y divide-line/70", className)}>{children}</div>;
}
