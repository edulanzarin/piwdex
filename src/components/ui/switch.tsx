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
  /**
   * Ocupa a largura toda.
   *
   * O padrao e encolher ate o rotulo, que e o certo numa fila de filtros. Numa
   * GRADE de cartoes e o contrario: cada chave tem um rotulo de tamanho
   * diferente, e encolher faz quatro caixas de quatro larguras. Aqui a coluna
   * manda, nao o texto.
   */
  block?: boolean;
}

export function Switch({ label, hint, block, className, ...props }: SwitchProps) {
  return (
    <label
      className={cn(
        // `w-auto self-start`: a casca dos campos nasce com `width: 100%`, e o switch
        // carrega o proprio rotulo — esticado, ele vira uma faixa vazia atras do texto.
        // O `self-start` e o que segura de verdade: em coluna flex o padrao estica.
        "field cursor-pointer select-none gap-2.5",
        block ? "w-full" : "w-auto self-start",
        // com dica a caixa cresce (a altura fixa cortaria a segunda linha), mas o
        // piso continua sendo a altura de campo — a fila nao desalinha por causa dela
        hint ? "h-auto min-h-10 items-start py-2" : "items-center",
        "pointer-coarse:min-h-11",
        props.disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...props} />
      {/* A chave em si. Ela cresceu: a anterior tinha 8px de curso e um miolo de
          10px, e a diferenca entre ligada e desligada dependia de enxergar dois
          pixels de deslocamento. Agora o estado se le pela COR de fundo e pela
          posicao, e o alvo de clique e a linha inteira. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-10 shrink-0 rounded-pix border transition-colors",
          "border-line-strong bg-surface-2",
          // com dica o texto tem duas linhas: a chave acompanha a PRIMEIRA delas
          hint && "mt-0.5",
          "peer-checked:border-accent peer-checked:bg-accent/35",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "after:absolute after:top-[3px] after:left-[3px] after:h-[12px] after:w-[12px]",
          "after:bg-text-mute after:transition-all after:content-['']",
          "peer-checked:after:left-[21px] peer-checked:after:bg-accent",
        )}
      />
      {(label || hint) && (
        <span className="min-w-0">
          {/* O rotulo ACENDE quando ligado: sem isso, uma grade de seis chaves
              obriga a conferir seis miolos de 12px pra saber o que esta ativo. */}
          {label ? (
            <span className="block text-[14px] text-text-dim peer-checked:text-text">{label}</span>
          ) : null}
          {hint ? <span className="block text-[13px] text-text-mute">{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
