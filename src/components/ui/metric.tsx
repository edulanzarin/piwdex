import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * O NUMERO como peca de tela.
 *
 * Nasceu de um bloco que morava inline na home ("o catalogo agora": 482 especies,
 * 428 itens, 347 locais) e ja tinha nascido duas vezes — a mesma grade de numero
 * grande com rotulo pequeno reaparecia no painel do robo com outro CSS. Duas
 * copias da mesma peca envelhecem separadas: uma ganha o mono e a outra nao, e
 * ninguem percebe ate as duas estarem na mesma tela.
 *
 * A diferenca pro `StatTile` e a pergunta que cada um responde. `StatTile` mede
 * um valor CONTRA UM TETO — por isso ele tem barra e exige `ratio`. `Metric` e
 * contagem sem teto: 2.657 registros de drop nao sao 2.657 de coisa nenhuma.
 * Pedir `ratio` ali obrigaria a inventar um maximo, e maximo inventado e o tipo
 * de numero que a tela passa a afirmar sem ter.
 */

export interface MetricProps {
  /** o numero ja formatado — quem formata sabe a lingua, a primitiva nao */
  value: ReactNode;
  label: ReactNode;
  /** cor do numero. E acento de INTERFACE (cor de ferramenta), nao cor de dado */
  tint?: string;
  /** colado no numero, menor: "/h", "%" */
  suffix?: ReactNode;
  hint?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

const TAMANHO = {
  sm: "text-[20px] sm:text-[22px]",
  md: "text-[28px] sm:text-[32px]",
  lg: "text-[36px] sm:text-[44px]",
} as const;

export function Metric({
  value,
  label,
  tint,
  suffix,
  hint,
  size = "md",
  className,
  style,
}: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} style={style}>
      <span className="flex items-baseline gap-1">
        {/* `.num` troca a familia pro mono: numero em grade e pra COMPARAR, e
            comparar exige que os digitos ocupem a mesma largura em toda linha. */}
        <span
          className={cn("num leading-none font-bold text-text", TAMANHO[size])}
          style={tint ? { color: tint } : undefined}
        >
          {value}
        </span>
        {suffix && <span className="num text-[13px] text-text-mute">{suffix}</span>}
      </span>
      <span className="pix text-[11px] text-text-mute">{label}</span>
      {hint && <span className="text-[12px] text-text-mute">{hint}</span>}
    </div>
  );
}

/**
 * A grade de metricas, com o fio entre celulas.
 *
 * O fio sai de `gap-px` sobre um fundo de linha, e nao de uma borda por celula:
 * borda por celula soma DUAS no meio da grade, e o fio do meio fica com o dobro
 * da espessura do fio da ponta. E o tipo de defeito que ninguem nomeia e todo
 * mundo sente como "desalinhado".
 */
export function MetricGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-pix bg-line",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uma celula da grade: o fundo dela e o que faz o `gap-px` virar fio. */
export function MetricCell({
  className,
  style,
  ...props
}: MetricProps & { className?: string }) {
  return (
    <Metric
      {...props}
      className={cn("bg-surface/95 px-3.5 py-4", className)}
      style={style}
    />
  );
}
