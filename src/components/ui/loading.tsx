"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { arteUrl, ferramentaDoCaminho } from "@/lib/ferramentas";
import { Pokeball } from "./pokeball";

/**
 * Tela de carregamento.
 *
 * ## O gif de pokemon saiu
 *
 * Ela sorteava um dos dez gifs animados do gen5 e mostrava o bicho se mexendo.
 * Era carisma, e era tambem a ultima peca do site em pixel: com a dex, a ficha,
 * o card e o cartao ja em arte suavizada, e os icones de ferramenta em vetor,
 * abrir uma tela e receber um sprite de 96px serrilhado dizia "a pagina que vem
 * e de outro site".
 *
 * O que entra no lugar e o icone da PROPRIA ferramenta. Ele resolve duas coisas
 * de uma vez: a espera passa a mostrar pra onde se esta indo (esperar a Hunt
 * mostra a mira, nao um Gengar sorteado), e a arte e a mesma que a faixa de topo
 * vai mostrar um segundo depois — a tela de espera vira o primeiro quadro da
 * tela que chega, e nao um intervalo com outro assunto dentro.
 *
 * Na home, que nao e ferramenta, fica a pokebola girando: ali nao ha destino
 * unico pra anunciar.
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
 * e a rota nova acerta sem ninguem lembrar.
 */

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
  const [caiu, setCaiu] = useState(false);
  const f = ferramentaDoCaminho(usePathname());
  const cor = f?.cor ?? "var(--color-accent)";

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
        {f && !caiu ? (
          <img
            src={arteUrl(f.arte)}
            alt=""
            width={inline ? 64 : 112}
            height={inline ? 64 : 112}
            className="anim-float relative h-full w-full object-contain"
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
