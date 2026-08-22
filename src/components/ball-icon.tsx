import type { Ball } from "@/lib/balls";
import { assetIconUrl } from "@/lib/sprites";
import { Pokeball } from "@/components/ui";

/**
 * O icone da bola, do proprio jogo (`/assets/markitems/*.png`).
 *
 * Bola e coisa que se reconhece pela COR antes do nome — "Ultra" e "Idle" sao
 * duas palavras parecidas e dois desenhos diferentes. Quem nao tem arte (a
 * Master nao vem com `iconUrl`) cai na pokebola desenhada, que ainda diz "isto e
 * uma bola" — melhor que um quadrado vazio.
 */
export function BallIcon({ ball, size = 18 }: { ball: Ball; size?: number }) {
  if (!ball.iconUrl) return <Pokeball size={size} className="shrink-0 text-text-mute" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetIconUrl(ball.iconUrl)}
      alt=""
      width={size}
      height={size}
      data-pixel="true"
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
