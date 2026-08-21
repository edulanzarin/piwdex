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
        "inline-flex shrink-0 items-center gap-0.5 rounded-pix border border-line bg-bg-soft p-0.5",
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
              size === "sm" ? "h-6 px-1.5 text-[9px]" : "h-7 px-2.5 text-[10px]",
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
