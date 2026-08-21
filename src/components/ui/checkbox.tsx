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
}

export function Checkbox({ label, indeterminate, tint, className, ...props }: CheckboxProps) {
  const on = props.checked ?? props.defaultChecked;
  return (
    <label
      className={cn(
        "group flex cursor-pointer select-none items-center gap-2 rounded-pix px-1.5 py-1",
        "text-[12px] text-text-dim transition-colors hover:bg-surface-2 hover:text-text",
        props.disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        style={tint && (on || indeterminate) ? { borderColor: tint, backgroundColor: `${tint}33`, color: tint } : undefined}
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-pix border border-line-strong bg-bg-soft",
          "transition-colors group-hover:border-accent/50",
          "peer-checked:border-accent peer-checked:bg-accent/25 peer-checked:text-accent",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
        )}
      >
        {/* O icone nao e irmao do input, entao `peer-checked:` nao o alcanca —
            quem liga a marca e o `group-has-[:checked]` do rotulo inteiro. */}
        {indeterminate ? (
          <IconMinus size={8} />
        ) : (
          <IconCheck size={8} className="opacity-0 transition-opacity group-has-[:checked]:opacity-100" />
        )}
      </span>
      {label ? <span className="min-w-0 flex-1 truncate group-has-[:checked]:text-text">{label}</span> : null}
    </label>
  );
}
