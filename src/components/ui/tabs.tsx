"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Abas. A aba ATIVA e marcada por barra de acento + texto forte — nunca so por
 * cor, que some pra quem nao distingue matiz.
 *
 * O `icon` nao e enfeite: "Rota de treino" e "Todas as hunts" tem o mesmo
 * comprimento, a mesma caixa alta e o mesmo tom, e o olho tem de LER as duas pra
 * saber em qual esta. Com a silhueta na frente, a aba se acha antes da palavra.
 * Ele fica no componente, e nao dentro do `label`, pra o vao e a escala serem os
 * mesmos em toda aba do site — icone metido no rotulo vira um alinhamento
 * diferente por chamador.
 */
export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** glifo de 14px antes do rotulo */
  icon?: ReactNode;
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
              // Mais respiro e tracking maior: a aba passou a dividir tela com
              // titulo de capitulo e botao de fio, e nessa companhia um rotulo
              // apertado de 12px le como aba de planilha.
              "pix group/aba relative flex shrink-0 items-center gap-2 px-5 py-2.5 text-[11px] tracking-[0.12em]",
              "transition-colors duration-200",
              // no dedo a aba ganha altura de alvo; no mouse segue rente ao trilho
              "pointer-coarse:min-h-11 pointer-coarse:px-4",
              "disabled:pointer-events-none disabled:opacity-40",
              on ? "text-accent" : "text-text-mute hover:text-text-dim",
            )}
          >
            {t.icon ? (
              <span
                aria-hidden="true"
                className={cn(
                  "flex shrink-0 transition-transform duration-150 ease-out",
                  on ? "scale-110" : "group-hover/aba:-translate-y-px",
                )}
              >
                {t.icon}
              </span>
            ) : null}
            {t.label}
            {t.count != null ? (
              /* A contagem vira PILULA e sai do mono corrido: numero solto ao
                 lado do rotulo em caixa alta se lia como parte do nome da aba
                 ("Caçada 12"). Com casca, ele vira metadado. */
              <span
                className={cn(
                  "num rounded-pill px-1.5 py-0.5 text-[10px] leading-none transition-colors",
                  on ? "bg-accent/18 text-accent" : "bg-surface-2 text-text-mute",
                )}
              >
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
                "absolute inset-x-0 -bottom-px h-[2px] origin-center bg-accent",
                "transition-transform duration-200 ease-out motion-reduce:transition-none",
                // O halo saiu. Ele existia pra a barra de 2px se ver num tema
                // onde tudo brilhava; agora que o brilho e reservado a ESTADO e a
                // barra corre a aba inteira, o halo so borrava a linha.
                on ? "scale-x-100" : "scale-x-0 group-hover/aba:scale-x-40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
