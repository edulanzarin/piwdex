"use client";

import { useEffect, useRef, useState } from "react";
import { animatedSpriteUrl } from "@/lib/sprites";
import { Pokeball } from "./pokeball";

// Sprite com loading: skeleton + pokebola girando ate a imagem (vem do GitHub e
// demora) carregar, entao fade-in. Erro cai num placeholder.
// Cuidado importante: no SSR a <img> ja esta no HTML e pode terminar de carregar
// ANTES do React anexar onLoad — o evento nunca dispara e travaria em "loading".
// Por isso, no mount, checamos img.complete/naturalWidth manualmente.
export function Sprite({
  src,
  alt,
  size = 80,
  className = "",
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (img.complete) {
      setState(img.naturalWidth > 0 ? "ok" : "error");
    }
  }, [src]);

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {state === "loading" && (
        <span className="skeleton absolute inset-0 flex items-center justify-center rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={animatedSpriteUrl(151)}
            alt=""
            className="spin"
            style={{ imageRendering: "pixelated", width: Math.min(size * 0.72, 44), height: Math.min(size * 0.72, 44) }}
          />
        </span>
      )}
      {state === "error" && (
        <span className="absolute inset-0 flex items-center justify-center rounded bg-surface-2 opacity-50">
          <Pokeball size={Math.min(24, size / 2.4)} />
        </span>
      )}
      {src && state !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt={alt}
          width={size}
          height={size}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={`max-h-full max-w-full ${state === "ok" ? "fadein" : "opacity-0"}`}
          style={{ imageRendering: "pixelated" }}
        />
      )}
    </span>
  );
}
