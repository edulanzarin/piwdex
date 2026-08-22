"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Chave liga/desliga. Usar quando o efeito e IMEDIATO; se precisa de "aplicar", o
 * certo e um checkbox dentro de um formulario.
 *
 * Ela vem SEMPRE com a casca dos campos (`.field`), e isso nao e enfeite: o switch
 * e um controle solto — sem casca ele boia numa fila de filtros e muda de cara de
 * tela pra tela (com moldura na Hunt, sem moldura na dex e no breeding). Um
 * controle, um visual. Com `hint` a casca cresce em vez de cortar o texto.
 */
export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  hint?: ReactNode;
}

export function Switch({ label, hint, className, ...props }: SwitchProps) {
  return (
    <label
      className={cn(
        // `w-auto self-start`: a casca dos campos nasce com `width: 100%`, e o switch
        // carrega o proprio rotulo — esticado, ele vira uma faixa vazia atras do texto.
        // O `self-start` e o que segura de verdade: em coluna flex o padrao estica.
        "field w-auto self-start cursor-pointer select-none gap-2.5",
        // com dica a caixa cresce (a altura fixa cortaria a segunda linha), mas o
        // piso continua sendo a altura de campo — a fila nao desalinha por causa dela
        hint ? "h-auto min-h-10 items-start py-2" : "items-center",
        "pointer-coarse:min-h-11",
        props.disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-8 shrink-0 rounded-pix border border-line-strong bg-bg-soft transition-colors",
          // com dica o texto tem duas linhas: a chave acompanha a PRIMEIRA delas
          hint && "mt-1",
          "peer-checked:border-accent peer-checked:bg-accent/30",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "after:absolute after:top-[2px] after:left-[2px] after:h-[10px] after:w-[10px]",
          "after:bg-text-mute after:transition-all after:content-['']",
          "peer-checked:after:left-[18px] peer-checked:after:bg-accent",
        )}
      />
      {(label || hint) && (
        <span className="min-w-0">
          {label ? <span className="block text-[14px] text-text-dim group-has-[:checked]:text-text">{label}</span> : null}
          {hint ? <span className="block text-[13px] text-text-mute">{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
