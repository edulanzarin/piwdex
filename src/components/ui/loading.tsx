"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
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
 * Sortear no render faz servidor e cliente escolherem bichos diferentes, e e por
 * isso que o `<img>` leva `suppressHydrationWarning`: a diferenca e
 * INTENCIONAL, e o atributo existe exatamente pra esse caso. Trocar de bicho na
 * hidratacao nao custa nada aqui — a tela e transitoria e o slot tem tamanho
 * fixo, entao nada salta.
 */

const BICHOS = [25, 133, 143, 94, 149, 6, 448, 196, 131, 59] as const;

export function Loading({
  label = "Carregando",
  hint,
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [id] = useState(() => BICHOS[Math.floor(Math.random() * BICHOS.length)]);
  const [caiu, setCaiu] = useState(false);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-6 px-6 py-24", className)}
    >
      <span className="relative grid h-28 w-28 place-items-center">
        <span
          aria-hidden="true"
          className="anim-glow absolute h-24 w-24 rounded-full bg-[var(--color-t-dex)]/35 blur-2xl"
        />
        {!caiu ? (
          <img
            src={`/images/loading/${id}.gif`}
            alt=""
            width={112}
            height={112}
            data-pixel="true"
            className="anim-float relative h-full w-full object-contain"
            suppressHydrationWarning
            onError={() => setCaiu(true)}
          />
        ) : (
          <Pokeball size={64} spinning className="relative text-[var(--color-t-dex)]" />
        )}
      </span>

      <span className="flex flex-col items-center gap-2">
        <span className="pix text-[13px] text-text-dim">{label}</span>
        {hint ? <span className="text-[13px] text-text-mute">{hint}</span> : null}
      </span>

      {/* Barra INDETERMINADA de proposito: nao ha progresso real pra reportar, e
          barra que finge porcentagem e a que trava em 99%. */}
      <span
        aria-hidden="true"
        className="h-1 w-56 overflow-hidden bg-surface-2 ring-1 ring-line"
      >
        <span className="anim-bar block h-full bg-[var(--color-t-dex)]/80" />
      </span>
    </div>
  );
}
