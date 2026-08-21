"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Pokeball } from "./pokeball";

/**
 * Sprite do pokemon, com estado de carga e modo animado.
 *
 * Tres armadilhas ja pagas, e as tres viram regra aqui:
 *
 * 1. **A imagem nao pode depender do JS pra aparecer.** Uma versao nascia
 *    `opacity-0` ate o `onLoad` e a pagina renderizada no servidor mostrava 60
 *    pokebolas e nenhum bicho ate a hidratacao. A imagem nasce visivel; o
 *    marcador fica ATRAS dela.
 * 2. **`onLoad` pode nunca chegar**, porque a imagem costuma terminar de
 *    carregar antes do React ligar o listener. O mount confere `img.complete`,
 *    que e a verdade do DOM.
 * 3. **O animado NAO pode ser o que o servidor renderiza.** O gif so existe ate
 *    o id 649; acima disso o HTML sai com uma URL 404 e o navegador pinta o
 *    icone de imagem quebrada — `onError` so socorre depois da hidratacao, e o
 *    estrago ja aconteceu. Entao: servidor manda sempre o ESTATICO (arquivo
 *    local, garantido), e o cliente PRE-CARREGA o gif em memoria, trocando so
 *    quando ele confirma que carregou. Quem nao tem gif nunca pisca.
 */
export interface SpriteProps {
  src: string | null;
  /** gif animado; quando null ou indisponivel, fica no estatico e ninguem nota */
  animatedSrc?: string | null;
  alt: string;
  size?: number;
  className?: string;
  /** sprite do jogo e pixel art: escala sem suavizacao */
  pixel?: boolean;
  priority?: boolean;
}

export function Sprite({
  src,
  animatedSrc,
  alt,
  size = 64,
  className,
  pixel = true,
  priority,
}: SpriteProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"load" | "ok" | "fail">(src ? "load" : "fail");
  // comeca sempre falso: o servidor renderiza o estatico
  const [anim, setAnim] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setState("fail");
      return;
    }
    setState("load");
    if (ref.current?.complete) setState(ref.current.naturalWidth > 0 ? "ok" : "fail");
  }, [src]);

  useEffect(() => {
    setAnim(null);
    if (!animatedSrc) return;
    // pre-carrega fora da arvore: se falhar, ninguem ve nada acontecer
    const probe = new Image();
    let vivo = true;
    probe.onload = () => {
      if (vivo) setAnim(animatedSrc);
    };
    probe.src = animatedSrc;
    return () => {
      vivo = false;
    };
  }, [animatedSrc]);

  const atual = anim ?? src;

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {state !== "ok" ? (
        <Pokeball
          size={Math.round(size * 0.45)}
          spinning={state === "load"}
          className={cn("absolute", state === "load" ? "text-accent" : "text-line-strong")}
        />
      ) : null}

      {atual && state !== "fail" ? (
        <img
          ref={ref}
          src={atual}
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
