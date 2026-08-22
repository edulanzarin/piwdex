import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldLabel } from "./panel";

/**
 * A celula de formulario do site: rotulo em cima, controle embaixo.
 *
 * Ela existe por um motivo bem concreto — o Eduardo olhou a barra de cenario da
 * Hunt e viu tres alturas diferentes na mesma linha: campo de 40px, segmentado de
 * 32px e um switch solto, sem casca, boiando no meio. Cada tela montava a propria
 * celula com um `<div><FieldLabel/>...</div>` na mao, e bastava um controle com
 * altura propria pra linha inteira desalinhar.
 *
 * Duas regras fecham isso, e as duas moram aqui:
 *
 * 1. **Todo controle tem a MESMA altura** (`.field`, 2.5rem). Segmented, Switch e
 *    Checkbox ganharam a mesma casca — quem nao tinha altura passou a ter.
 * 2. **O rotulo ocupa lugar mesmo quando nao existe.** Uma celula sem rotulo
 *    reserva a linha dele; sem isso o controle vizinho sobe 20px e a fila
 *    desalinha de novo — que e exatamente o que acontecia com o VIP.
 *
 * Com as duas, uma fila de `Field` alinha sozinha, sem `items-end` nem margem
 * corretiva em nenhuma tela.
 */
export interface FieldProps {
  /** rotulo curto; ausente reserva a linha do mesmo jeito */
  label?: ReactNode;
  icon?: ReactNode;
  /** recado por baixo do controle (nao o placeholder, nao o rotulo) */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, icon, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {/* Altura fixa (e ela que alinha a fila) mas SEM apertar a linha: `truncate`
          esconde o que passa da caixa nos DOIS eixos, e numa linha de 11px o acento
          de "ÁREA" e "NÍVEL" e a primeira coisa a sumir — o rotulo aparecia como
          "AREA". Dai o `leading-[1.5]` na parte que trunca. */}
      <FieldLabel className="flex h-5 items-center gap-1.5">
        {label ? (
          <>
            {icon}
            <span className="truncate leading-[1.5]">{label}</span>
          </>
        ) : (
          // espaco reservado: mantem o controle na mesma linha de base dos vizinhos
          <span aria-hidden="true">&nbsp;</span>
        )}
      </FieldLabel>
      {children}
      {hint ? <span className="text-[12px] leading-snug text-text-mute">{hint}</span> : null}
    </div>
  );
}

/** Uma fila de `Field`. O alinhamento sai da altura fixa dos controles, nao de
 *  `items-end` — que so disfarçaria alturas diferentes. */
export function FieldRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap items-start gap-x-3 gap-y-3", className)}>{children}</div>;
}
