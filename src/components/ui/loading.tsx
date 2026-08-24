"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ferramentaDoCaminho } from "@/lib/ferramentas";
import { Pokeball } from "./pokeball";

/**
 * Tela de carregamento.
 *
 * O gif e SELF-HOSTADO (`public/images/loading/`). Puxar de CDN de terceiro
 * numa tela de espera e a pior troca possivel: se a rede estiver lenta — que e
 * exatamente quando esta tela aparece — o indicador de carregamento fica
 * carregando.
 *
 * O sorteio acontece no PRIMEIRO RENDER, nao no mount. A versao anterior
 * sorteava num `useEffect` e o resultado era o oposto do pedido: no carregamento
 * inicial — justamente quando esta tela aparece — o HTML saia do servidor com a
 * pokebola parada, e o gif so entrava depois da hidratacao, que e depois de a
 * espera ter acabado. Ou seja: a animacao nunca era vista.
 *
 * Sortear no render faz servidor e cliente escolherem pokemons diferentes, e e por
 * isso que o `<img>` leva `suppressHydrationWarning`: a diferenca e
 * INTENCIONAL, e o atributo existe exatamente pra esse caso. Trocar de pokemon na
 * hidratacao nao custa nada aqui — a tela e transitoria e o slot tem tamanho
 * fixo, entao nada salta.
 *
 * ## A cor sai da ROTA, e nao do arquivo
 *
 * O halo e a barra eram `--color-t-dex` cravado. Numa tela so isso passa; nas
 * nove que existem, virava afirmacao errada — esperar a Calculadora abria uma
 * cena vermelha, que e a cor da Pokedex, e a unica peca colorida da tela dizia
 * "voce esta indo pra dex".
 *
 * A alternativa obvia era um `tint` por chamada, e ela e a errada: sao nove
 * arquivos de uma linha, e o decimo nasceria sem. O caminho ja sabe a resposta —
 * `usePathname` mais o registro de ferramentas — entao a cor se resolve sozinha
 * e a rota nova acerta sem ninguem lembrar. Na home, que nao e ferramenta, cai
 * no acento da marca.
 */

const POKEMONS = [25, 133, 143, 94, 149, 6, 448, 196, 131, 59] as const;

/** `page` toma a tela inteira (navegacao); `inline` espera DENTRO de um painel —
 *  mesma cena, um terco da altura. Sem a variante, um calculo de 700ms abria 60vh
 *  de buraco no meio da ferramenta. */
export function Loading({
  label = "Carregando",
  size = "page",
  className,
}: {
  label?: string;
  size?: "page" | "inline";
  className?: string;
}) {
  const inline = size === "inline";
  const [id] = useState(() => POKEMONS[Math.floor(Math.random() * POKEMONS.length)]);
  const [caiu, setCaiu] = useState(false);
  const cor = ferramentaDoCaminho(usePathname())?.cor ?? "var(--color-accent)";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center px-6",
        inline ? "min-h-[13rem] gap-4 py-6" : "min-h-[60vh] gap-6 py-16",
        className,
      )}
    >
      <span className={cn("relative grid place-items-center", inline ? "h-16 w-16" : "h-28 w-28")}>
        <span
          aria-hidden="true"
          className={cn(
            "anim-glow absolute rounded-full blur-2xl",
            inline ? "h-14 w-14" : "h-24 w-24",
          )}
          style={{ backgroundColor: cor, opacity: 0.35 }}
        />
        {!caiu ? (
          <img
            src={`/images/loading/${id}.gif`}
            alt=""
            width={inline ? 64 : 112}
            height={inline ? 64 : 112}
            data-pixel="true"
            className="anim-float relative h-full w-full object-contain"
            suppressHydrationWarning
            onError={() => setCaiu(true)}
          />
        ) : (
          /* A reserva veste a MESMA cor da rota: a bola herda `currentColor`, entao
             pintar o `<span>` que a embrulha basta. */
          <span className="relative" style={{ color: cor }}>
            <Pokeball size={inline ? 36 : 64} spinning />
          </span>
        )}
      </span>

      <span className="pix text-[13px] text-text-dim">{label}</span>

      {/* Barra INDETERMINADA de proposito: nao ha progresso real pra reportar, e
          barra que finge porcentagem e a que trava em 99%. */}
      {/* Pilula, e nao retangulo: um trilho de 1px de canto reto era a ultima
          peca desta tela ainda no dialeto antigo, e ela e a que mais se olha —
          e a unica coisa que se mexe enquanto se espera. */}
      <span
        aria-hidden="true"
        className={cn(
          "h-1 overflow-hidden rounded-pill bg-surface-2 ring-1 ring-line",
          inline ? "w-40" : "w-56",
        )}
      >
        <span
          className="anim-bar block h-full rounded-pill"
          style={{ backgroundColor: cor, opacity: 0.8 }}
        />
      </span>
    </div>
  );
}
