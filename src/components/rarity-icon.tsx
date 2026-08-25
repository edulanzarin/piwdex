import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RarityTier } from "@/lib/rarity";

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
 *
 * ## Sao NOVE degraus, e nao seis
 *
 * A escada nasceu com os seis da RARIDADE DA ESPECIE (`creatures.json`), porque
 * era o que as paginas de `/dex/raridade` pediam. Mas o site tem uma segunda
 * escada com os mesmos nomes: a QUALITY do INDIVIDUO, que vai de `WEAK` (abaixo
 * de 1.0) ate `DIVINE` (4.0+) e e a que a calculadora, a hunt e o painel do robo
 * mostram. Ver o aviso no topo de `lib/rarity.ts`.
 *
 * Ficar nos seis obrigaria essas telas a nao ter brasao nenhum — ou, pior, a
 * emprestar o de `MYTHIC` pra `ANCIENT`, que e afirmar que os dois degraus sao o
 * mesmo. Entao a escada foi completada, e a regra da forma continua valendo nas
 * pontas: `WEAK` e a pedra PARTIDA (menos que uma pedra inteira), `ANCIENT` e a
 * gema dentro de um anel (relíquia) e `DIVINE` e a gema irradiando.
 *
 * `Rarity` continua servido por aqui sem conversao: os seis nomes dela sao um
 * subconjunto dos nove.
 */
const BRASAO: Record<RarityTier, ReactNode> = {
  /* Pedra PARTIDA: duas lascas em vez de um bloco. E o unico degrau que TIRA
     massa do anterior em vez de acrescentar, e e assim que ele diz "abaixo de
     comum" sem depender do cinza. */
  WEAK: (
    <>
      <path d="M6.6 10.4 11 5.6l1.2 4.4-1.9 8.4H8.5z" opacity=".9"/>
      <path d="M11 5.6 6.6 10.4h5.6z" opacity=".5"/>
      <path d="m14.4 12.2 3.6-2.2 1.4 3.1-1.2 5.3h-2.2z" opacity=".55"/>
    </>
  ),
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
  /* RELIQUIA: a gema encerrada num anel. O anel e o que separa este degrau do
     MYTHIC sem repetir estrela — os dois somam alguma coisa em volta da gema, e
     duas somas parecidas viravam a mesma mancha em 14px. */
  ANCIENT: (
    <>
      <path d="M12 1.2a10.8 10.8 0 1 1 0 21.6 10.8 10.8 0 0 1 0-21.6zm0 2.6a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4z" opacity=".45"/>
      <path d="M9 8.2h6l3 3.4-6 6.2-6-6.2z" opacity=".95"/>
      <path d="M9 8.2h6l3 3.4H6z" opacity=".5"/>
      <path d="M12 11.6h6l-6 6.2z" opacity=".3"/>
    </>
  ),
  /* IRRADIANDO: oito raios curtos em volta da gema. Curtos de proposito — na
     folha de contato a versao com raio longo comia a gema em 14px e o topo da
     escada virava um asterisco, perdendo justamente a peca que os outros oito
     degraus constroem. */
  DIVINE: (
    <>
      <path d="M7.8 8h8.4l3 3.4-7.2 7.4-7.2-7.4z" opacity=".95"/>
      <path d="M7.8 8h8.4l3 3.4H4.8z" opacity=".5"/>
      <path d="M12 11.4h7.2L12 18.8z" opacity=".3"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(0 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(45 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(90 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(135 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(180 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(225 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(270 12 12)"/>
      <rect x="11.05" y="0" width="1.9" height="2.8" rx=".95" transform="rotate(315 12 12)"/>
    </>
  ),
};

/** Piso de 14px, como todo glifo do site. */
const MIN = 14;

export function RarityIcon({
  rarity,
  size = 16,
  className,
  style,
}: {
  rarity: RarityTier;
  size?: number;
  className?: string;
  /** o brasao herda `color`; o `style` existe pra quem precisa dar essa cor no
   *  proprio elemento, como as opcoes de menu, em vez de embrulhar num span */
  style?: CSSProperties;
}) {
  const s = Math.max(MIN, size);
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="currentColor"
      className={cn("shrink-0", className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {BRASAO[rarity]}
    </svg>
  );
}
