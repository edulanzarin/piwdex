"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconCheck, IconMinus } from "./icons";

/**
 * Caixa de marcar. O `input` nativo continua existindo (teclado, form, leitor
 * de tela) — so fica invisivel, e o quadrado pixel desenha o estado por cima.
 */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  /** estado parcial: alguns filhos marcados */
  indeterminate?: boolean;
  /** cor de DADO (tipo, raridade) pra marcar a caixa com a cor da coisa */
  tint?: string;
  /** veste a casca `.field`: mesma altura e borda dos campos (ver `field.tsx`) */
  boxed?: boolean;
}

export function Checkbox({ label, indeterminate, tint, boxed, className, ...props }: CheckboxProps) {
  const on = props.checked ?? props.defaultChecked;
  return (
    <label
      className={cn(
        "group flex cursor-pointer select-none items-center gap-2 rounded-pix px-1.5 py-1",
        // O quadradinho tem 16px e nunca vai crescer — quem carrega o toque e a
        // LINHA inteira (label incluso), que ja e o alvo de clique do <label>.
        "pointer-coarse:min-h-11 pointer-coarse:px-2",
        "text-[14px] text-text-dim transition-colors hover:bg-surface-2 hover:text-text",
        boxed && "field w-auto whitespace-nowrap hover:bg-[color-mix(in_oklab,var(--color-bg-soft)_66%,transparent)]",
        props.disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        /* Com cor de DADO, a caixa enche na cor e a marca sai escura — o mesmo
           trato do estado ligado padrao. Antes o `tint` pintava um fundo de 20%
           com a marca NA cor, e marca colorida sobre fundo da mesma cor e o pior
           contraste possivel: a 18px, o simbolo sumia. */
        style={
          tint && (on || indeterminate)
            ? { borderColor: tint, backgroundColor: tint, color: "var(--color-bg)" }
            : undefined
        }
        className={cn(
          // 18px e raio miudo. A caixa tinha 16px com o raio de CONTROLE (10px)
          // — num quadrado de 16, um raio de 10 arredonda quase tudo e a peca
          // vira uma bolha, que e a forma do radio e nao a do checkbox. A
          // distincao entre "escolha uma" e "marque varias" mora na silhueta,
          // antes de qualquer rotulo.
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[var(--radius-xs)]",
          "border border-line-strong bg-bg-soft",
          "transition-[border-color,background-color] duration-150 group-hover:border-accent/50",
          "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-[color:var(--color-bg)]",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
        )}
      >
        {/* O icone nao e irmao do input, entao `peer-checked:` nao o alcanca —
            quem liga a marca e o `group-has-[:checked]` do rotulo inteiro. */}
        {indeterminate ? (
          <IconMinus size={14} />
        ) : (
          /* A marca ENTRA crescendo em vez de so aparecer. Sao 120ms e um salto
             de 0.6 pra 1 — o suficiente pro olho registrar que ALGO respondeu ao
             clique, que e o que falta num checkbox que so troca de cor. */
          <IconCheck
            size={13}
            className={cn(
              "scale-60 opacity-0 transition-[opacity,transform] duration-[120ms] ease-out",
              "group-has-[:checked]:scale-100 group-has-[:checked]:opacity-100",
              "motion-reduce:transition-none",
            )}
          />
        )}
      </span>
      {label ? <span className="min-w-0 flex-1 truncate group-has-[:checked]:text-text">{label}</span> : null}
    </label>
  );
}
