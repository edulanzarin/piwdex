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
        // Pilula por fora, pilula por dentro. O trilho e o polegar de um segmentado
        // sao a mesma familia de forma do switch — os tres dizem "escolha que
        // desliza", e o raio e o que os agrupa. Com o degrau de controle (10px)
        // num trilho de 40px de altura, sobrava um retangulo de canto mordido.
        "inline-flex shrink-0 self-start items-center gap-1 rounded-pill border border-line bg-bg-soft p-1",
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
              "pix inline-flex items-center justify-center gap-1.5 rounded-pill",
              "transition-[background-color,color,box-shadow] duration-200",
              size === "sm"
                ? "h-full px-3.5 text-[10px] tracking-[0.1em] pointer-coarse:px-5"
                : "h-full px-4.5 text-[11px] tracking-[0.11em] pointer-coarse:px-6",
              on
                // O ativo e SUPERFICIE ELEVADA, e nao um retangulo de cor. O polegar
                // parece pousado sobre o trilho — que e a leitura certa pra um
                // controle que "desliza" —, enquanto o fundo tingido lia como um
                // botao aceso ao lado de outros apagados.
                ? "bg-surface-3 text-text shadow-elev-2"
                : "text-text-mute hover:text-text-dim",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
