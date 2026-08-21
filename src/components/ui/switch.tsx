"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Chave liga/desliga. Usar quando o efeito e IMEDIATO; se precisa de "aplicar",
 *  o certo e um checkbox dentro de um formulario. */
export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  hint?: ReactNode;
}

export function Switch({ label, hint, className, ...props }: SwitchProps) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer select-none items-center gap-2.5",
        props.disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-8 shrink-0 rounded-pix border border-line-strong bg-bg-soft transition-colors",
          "peer-checked:border-accent peer-checked:bg-accent/30",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "after:absolute after:top-[2px] after:left-[2px] after:h-[10px] after:w-[10px]",
          "after:bg-text-mute after:transition-all after:content-['']",
          "peer-checked:after:left-[18px] peer-checked:after:bg-accent",
        )}
      />
      {(label || hint) && (
        <span className="min-w-0">
          {label ? <span className="block text-[12px] text-text-dim group-has-[:checked]:text-text">{label}</span> : null}
          {hint ? <span className="block text-[11px] text-text-mute">{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
