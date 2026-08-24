"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Chave liga/desliga. Usar quando o efeito e IMEDIATO; se precisa de "aplicar", o
 * certo e um checkbox dentro de um formulario.
 *
 * Ela vem SEMPRE com a casca dos campos (`.field`), e isso nao e enfeite: o switch
 * e um controle solto — sem casca ele boia numa fila de filtros e muda de cara de
 * tela pra tela. Um controle, um visual. Com `hint` a casca cresce em vez de
 * cortar o texto.
 *
 * ## A chave virou PILULA, e por que ela nao podia ser quadrada
 *
 * Ela era um retangulo de raio 10 com miolo quadrado de 12px — sobra do tempo em
 * que o raio do tema inteiro era zero. Um interruptor e a unica peca de interface
 * que IMITA um objeto fisico, e o objeto que ele imita e redondo e desliza. Com
 * canto reto e miolo quadrado, o gesto se perde: a peca deixa de parecer algo que
 * corre num trilho e vira duas caixinhas que trocam de cor.
 *
 * Ela e tambem a excecao consciente a escada de raio do tema: enquanto botao e
 * campo usam o degrau de controle, aqui e pilula cheia. A escada existe pra dar
 * coerencia entre pecas do mesmo tipo, e este e o unico controle que representa um
 * objeto — a coerencia dele e com o mundo, nao com o formulario.
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
        "field cursor-pointer select-none gap-3",
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

      {/* ---- o trilho ---- */}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-pill border transition-colors duration-200",
          "border-line-strong bg-bg-soft",
          // com dica o texto tem duas linhas: a chave acompanha a PRIMEIRA delas
          hint && "mt-px",
          "peer-checked:border-transparent peer-checked:bg-accent",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",

          // ---- o miolo ----
          // Ele anda por `translate` e nao por `left`: `left` faz layout a cada
          // quadro, `translate` compoe. Numa tela de filtros com dez chaves isso e
          // a diferenca entre deslizar e pular.
          "after:absolute after:top-1/2 after:left-[3px] after:h-[18px] after:w-[18px]",
          "after:-translate-y-1/2 after:rounded-pill after:content-['']",
          "after:bg-text-mute after:shadow-elev-1",
          "after:transition-[transform,background-color] after:duration-200 after:ease-out",
          "peer-checked:after:translate-x-[20px] peer-checked:after:bg-[color:var(--color-bg)]",
          "motion-reduce:after:transition-none",
        )}
      />

      {(label || hint) && (
        <span className="min-w-0">
          {/* O rotulo ACENDE quando ligado: sem isso, uma grade de seis chaves
              obriga a conferir seis miolos pra saber o que esta ativo. */}
          {label ? (
            <span className="block text-[14px] text-text-dim peer-checked:text-text">{label}</span>
          ) : null}
          {hint ? <span className="block text-[13px] text-text-mute">{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
