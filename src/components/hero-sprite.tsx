"use client";

import { useState } from "react";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";

const ANIM_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated";

// Gen5 tem gif animado ate ~id 649; acima disso so estatico.
const hasAnimated = (id: number) => id > 0 && id <= 649;

/**
 * Sprite grande da ficha: alterna shiny e anima no hover (gif gen5 quando existe).
 * O aparelho parece vivo — pedido do jogo ser animado.
 */
export function HeroSprite({ pokeId, name, size = 132 }: { pokeId: number; name: string; size?: number }) {
  const [shiny, setShiny] = useState(false);
  const [hover, setHover] = useState(false);

  const animated = hasAnimated(pokeId);
  const src =
    hover && animated
      ? `${ANIM_BASE}/${shiny ? "shiny/" : ""}${pokeId}.gif`
      : spriteUrl(pokeId, shiny);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="group relative flex items-center justify-center rounded bg-[rgba(6,11,22,0.7)] ring-1 ring-[color:var(--border)]"
        style={{ width: size, height: size }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* varredura de "scanner" da pokedex ao passar o mouse */}
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded">
          <span className="scanline absolute inset-x-0 h-6 opacity-0 group-hover:opacity-100" />
        </span>
        <Sprite key={src} src={src} alt={name} size={size - 16} />
        {animated && (
          <span className="pixel absolute bottom-1 right-1 rounded bg-black/50 px-1 py-0.5 text-[0.4rem] text-text-dim">
            {hover ? "animando" : "hover"}
          </span>
        )}
      </div>
      <button
        onClick={() => setShiny((s) => !s)}
        className={`chip transition ${shiny ? "" : "opacity-70"}`}
        style={{ background: shiny ? "var(--yellow)" : "var(--surface-2)", color: shiny ? "#3a2c00" : "var(--text)" }}
        title="Alternar shiny"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: shiny ? "#3a2c00" : "var(--yellow)" }} />
        shiny {shiny ? "on" : "off"}
      </button>
    </div>
  );
}
