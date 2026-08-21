"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Pokeball } from "./pokeball";

/**
 * Sprite do pokemon com estado de carga.
 *
 * Duas armadilhas ja pagas, e as duas viram regra aqui:
 *
 * 1. **A imagem nao pode depender do JS pra aparecer.** A versao anterior nascia
 *    `opacity-0` e so acendia quando o React trocava de estado — ou seja, a
 *    pagina renderizada no servidor mostrava 60 pokebolas e nenhum bicho ate a
 *    hidratacao terminar. Agora a imagem ja nasce visivel e o marcador fica
 *    ATRAS dela: enquanto nao pinta, ve-se a bola; quando pinta, a imagem cobre.
 * 2. **`onLoad` pode nunca chegar.** Num componente hidratado a imagem costuma
 *    terminar de carregar ANTES do React ligar o listener. Por isso o mount
 *    confere `img.complete`, que e a verdade do DOM, em vez de so esperar o
 *    evento.
 */
export interface SpriteProps {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
  /** sprite do jogo e pixel art: escala sem suavizacao */
  pixel?: boolean;
  priority?: boolean;
}

export function Sprite({ src, alt, size = 64, className, pixel = true, priority }: SpriteProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"load" | "ok" | "fail">(src ? "load" : "fail");

  useEffect(() => {
    if (!src) {
      setState("fail");
      return;
    }
    setState("load");
    // a imagem pode ja estar completa quando o efeito roda — o evento nao vira
    if (ref.current?.complete) setState(ref.current.naturalWidth > 0 ? "ok" : "fail");
  }, [src]);

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {/* atras da imagem: some quando ela pinta, fica quando ela falha */}
      {state !== "ok" ? (
        <Pokeball
          size={Math.round(size * 0.42)}
          spinning={state === "load"}
          className={cn("absolute", state === "load" ? "text-accent" : "text-line-strong")}
        />
      ) : null}

      {src && state !== "fail" ? (
        <img
          ref={ref}
          src={src}
          alt={alt}
          width={size}
          height={size}
          data-pixel={pixel || undefined}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("fail")}
          className="relative h-full w-full object-contain"
        />
      ) : null}
    </span>
  );
}
