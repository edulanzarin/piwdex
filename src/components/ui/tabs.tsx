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
              "pix relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] transition-colors",
              // no dedo a aba ganha altura de alvo; no mouse segue rente ao trilho
              "pointer-coarse:min-h-11 pointer-coarse:px-4",
              "disabled:pointer-events-none disabled:opacity-40",
              on ? "text-accent" : "text-text-mute hover:text-text-dim",
            )}
          >
            {t.label}
            {t.count != null ? (
              <span className={cn("text-[11px] tabular", on ? "text-accent/70" : "text-text-mute")}>
                {t.count}
              </span>
            ) : null}
            {/* A barra CRESCE do centro em vez de trocar de cor. So
                `transition-colors` fazia ela teletransportar de uma aba pra
                outra: aparecia pronta no destino, sem nada ligar a origem ao
                fim. `scaleX` sai de graca (composicao, nao layout) e e o unico
                sinal que conta pra onde a selecao foi. */}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-0.5 origin-center bg-accent transition-transform duration-150 ease-out",
                on ? "scale-x-100 shadow-[0_0_10px_0_var(--color-accent)]" : "scale-x-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
