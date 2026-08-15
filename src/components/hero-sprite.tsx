"use client";

import { useState } from "react";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";

const ANIM_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated";

// Gen5 tem gif animado ate ~id 649; acima disso (e custom) so estatico.
const hasAnimated = (id: number) => id > 0 && id <= 649;

/**
 * Sprite grande da ficha: ANIMADO por padrao (gif gen5) — o parado fica so nos
 * cards da dex. Alterna shiny. Ids sem gif caem no sprite estatico.
 */
export function HeroSprite({ pokeId, name, size = 132 }: { pokeId: number; name: string; size?: number }) {
  const t = useT();
  const [shiny, setShiny] = useState(false);
  const animated = hasAnimated(pokeId);
  const src = animated
    ? `${ANIM_BASE}/${shiny ? "shiny/" : ""}${pokeId}.gif`
    : spriteUrl(pokeId, shiny);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded bg-[rgba(6,11,22,0.7)] ring-1 ring-[color:var(--border)]"
        style={{ width: size, height: size }}
      >
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded">
          <span className="pkdx-scan absolute inset-0" />
        </span>
        <Sprite key={src} src={src} alt={name} size={size - 16} />
      </div>
      <button
        onClick={() => setShiny((s) => !s)}
        className="chip transition"
        style={{ background: shiny ? "var(--yellow)" : "var(--surface-2)", color: shiny ? "#3a2c00" : "var(--text)" }}
        title={shiny ? "Ver forma normal" : "Ver forma shiny"}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: shiny ? "#3a2c00" : "var(--yellow)" }} />
        {shiny ? t("cr.seeNormal") : t("cr.seeShiny")}
      </button>
    </div>
  );
}
