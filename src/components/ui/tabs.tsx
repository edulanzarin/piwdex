"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Abas. A aba ATIVA e marcada por barra de acento + texto forte — nunca so por
 *  cor, que some pra quem nao distingue matiz. */
export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: TabItem<T>[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex items-end gap-0.5 overflow-x-auto border-b border-line", className)}>
      {items.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={on}
            disabled={t.disabled}
            onClick={() => onChange(t.value)}
            className={cn(
              "pix relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[11px] transition-colors",
              "disabled:pointer-events-none disabled:opacity-40",
              on ? "text-accent" : "text-text-mute hover:text-text-dim",
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className={cn("text-[10px] tabular", on ? "text-accent/70" : "text-text-mute")}>
                {t.count}
              </span>
            ) : null}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-0.5 transition-colors",
                on ? "bg-accent shadow-[0_0_10px_0_var(--color-accent)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
