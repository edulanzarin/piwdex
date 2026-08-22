"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Controle segmentado — escolha unica entre POUCAS opcoes ja visiveis
 * (grid/tabela, asc/desc). Passou de ~4 opcoes, o certo e um Select: segmento
 * demais vira barra de rolagem horizontal no celular.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ...props
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        // A altura e a MESMA do `.field` (2.5rem): segmentado e campo dividem fila
        // em toda tela de filtro, e 8px de diferenca sao os 8px que o olho pega.
        //
        // `self-start`: dentro de uma coluna flex o padrao e `align-self: stretch`, e
        // a casca esticava ate a largura do irmao mais largo (no breeding, a frase de
        // ganho por breed). O botao ficava com um vao morto a direita — "um tantao pra
        // direita". `inline-flex` nao segura isso; `self-start` segura.
        "inline-flex shrink-0 self-start items-center gap-0.5 rounded-pix border border-line bg-bg-soft p-0.5",
        size === "sm" ? "h-8 pointer-coarse:h-12" : "h-10 pointer-coarse:h-12",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "pix inline-flex items-center justify-center gap-1.5 rounded-pix transition-colors",
              size === "sm"
                ? "h-full px-2 text-[11px] pointer-coarse:px-4"
                : "h-full px-3 text-[12px] pointer-coarse:px-5",
              on
                ? "bg-accent/25 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-accent)_55%,transparent)]"
                : "text-text-mute hover:bg-surface-2 hover:text-text-dim",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
