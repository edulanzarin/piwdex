import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Rarity } from "@/lib/types";

/**
 * O BRASAO de cada raridade.
 *
 * As seis paginas de `/dex/raridade/*` mostravam o MESMO icone de gema, cada uma
 * numa cor. Seis raridades, um desenho — e cor sozinha nunca separa pra quem nao
 * distingue matiz, que e justamente o argumento que este site usa em todo lugar
 * pra parear cor com forma.
 *
 * ## A escada esta na FORMA, e nao so na cor
 *
 * pedra bruta -> pedra lapidada -> gema facetada -> gema com brilho -> gema
 * coroada -> cristal com estrelas em volta. Cada degrau acrescenta uma coisa ao
 * anterior, entao a ordem se le sem legenda e sem depender de matiz: quem ve um
 * brasao com coroa sabe que ele vem depois do que so tem brilho.
 *
 * ## Tudo em `currentColor`, com opacidade fazendo o volume
 *
 * A cor vem de fora (`RARITY_COLOR`, herdada por `color`), entao o mesmo desenho
 * serve a escada inteira e nunca sai de sincronia com ela. As facetas sao o mesmo
 * `currentColor` em opacidades diferentes — cravar um segundo hex aqui criaria
 * uma cor de raridade que a escada nao conhece.
 */
const BRASAO: Record<Rarity, ReactNode> = {
  COMMON: (
    <>
      <path d="M6.4 9.2 12 3.6l5.6 5.6-2.2 9.6H8.6z" opacity=".95"/>
      <path d="M12 3.6 6.4 9.2h11.2z" opacity=".55"/>
    </>
  ),
  UNCOMMON: (
    <>
      <path d="M5.6 9 12 3l6.4 6-2.5 10.4H8.1z" opacity=".95"/>
      <path d="M12 3 5.6 9h12.8z" opacity=".5"/>
      <path d="M12 9h4.2l-2.1 10.4H12z" opacity=".35"/>
    </>
  ),
  RARE: (
    <>
      <path d="M7.6 3.2h8.8l4.6 5.6-9 12.4L3 8.8z" opacity=".95"/>
      <path d="M7.6 3.2h8.8l4.6 5.6H3z" opacity=".5"/>
      <path d="M12 8.8h9l-9 12.4z" opacity=".3"/>
    </>
  ),
  EPIC: (
    <>
      <path d="M7.6 3.6h8.8l4.6 5.4-9 11.8-9-11.8z" opacity=".95"/>
      <path d="M7.6 3.6h8.8l4.6 5.4H3z" opacity=".5"/>
      <path d="M12 9h9l-9 11.8z" opacity=".3"/>
      <path d="m3.4 1 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>
      <path d="m20.8 15.4.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/>
    </>
  ),
  LEGENDARY: (
    <>
      <path d="M7.4 10.4h9.2l4 4.6-8.6 7.4-8.6-7.4z" opacity=".95"/>
      <path d="M7.4 10.4h9.2l4 4.6H3.4z" opacity=".5"/>
      <path d="M12 15h8.6l-8.6 7.4z" opacity=".3"/>
      <path d="M4.2 2.2 7.6 6l4.4-3.8L16.4 6l3.4-3.8-1.6 7.2H5.8z"/>
    </>
  ),
  MYTHIC: (
    <>
      <path d="M8.4 9.6h7.2l3.8 4.3-7.4 7.3-7.4-7.3z" opacity=".95"/>
      <path d="M8.4 9.6h7.2l3.8 4.3H4.6z" opacity=".5"/>
      <path d="M12 13.9h7.4l-7.4 7.3z" opacity=".3"/>
      <path d="M12 .6c.3 0 .5.2.6.4l.85 2.25 2.25.85a.55.55 0 0 1 0 1.1l-2.25.85-.85 2.25a.55.55 0 0 1-1.1 0l-.85-2.25-2.25-.85a.55.55 0 0 1 0-1.1l2.25-.85.85-2.25a.6.6 0 0 1 .6-.4z"/>
      <path d="m3.2 11.6.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6L1 13.8l1.6-.6z"/>
      <path d="m20.8 11.6.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>
    </>
  ),
};

/** Piso de 14px, como todo glifo do site. */
const MIN = 14;

export function RarityIcon({
  rarity,
  size = 16,
  className,
}: {
  rarity: Rarity;
  size?: number;
  className?: string;
}) {
  const s = Math.max(MIN, size);
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="currentColor"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      {BRASAO[rarity]}
    </svg>
  );
}
