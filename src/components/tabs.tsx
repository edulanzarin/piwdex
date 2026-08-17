"use client";

// Controle de abas segmentado, um dialeto so em todo o site (usa .tab/.tab-active
// do globals). O acento (cor da aba ativa) vem por prop: cada ferramenta passa o
// seu neon — a cor carrega a intencao, o tamanho e fechado. Aba pode ter icone.

import type { CSSProperties } from "react";

export interface TabItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export function Tabs({
  tabs,
  active,
  onChange,
  accent = "var(--cyan)",
  className = "",
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** cor da aba ativa (token/hex). Default: cyan. */
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 border-b border-border pb-3 ${className}`}>
      {tabs.map((tb) => {
        const on = tb.key === active;
        return (
          <button
            key={tb.key}
            type="button"
            onClick={() => onChange(tb.key)}
            aria-pressed={on}
            className={`tab inline-flex items-center gap-1.5 active:translate-y-px ${on ? "tab-active" : ""}`}
            style={on ? ({ color: accent, borderColor: accent } as CSSProperties) : undefined}
          >
            {tb.icon}
            {tb.label}
          </button>
        );
      })}
    </div>
  );
}
