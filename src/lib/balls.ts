// Pokebolas do Poke Idle World (dado-verdade, de src/data/balls.json).
//
// catchRate e o multiplicador de chance de captura do jogo (FIXO): quanto maior,
// menos bolas por captura. Master = captura garantida. O jogo NAO publica a formula
// de captura em si (chance absoluta = f(catchRate, hp%, ...)); logo so da pra falar
// em EFICIENCIA RELATIVA entre bolas, nao em "% de captura". priceGold vem null ate
// rodar o sync autenticado (`PIW_TOKEN=... npm run ingest`).

import ballsData from "@/data/balls.json";

export interface Ball {
  key: string;
  name: string;
  catchRate: number;
  priceGold: number | null;
  iconUrl?: string | null;
  buyable?: boolean;
  infinite: boolean;
}

export const BALLS: Ball[] = ballsData.balls;
export const BALLS_SYNCED_AT: string | null = ballsData.syncedAt;

export const ballByKey = (key: string): Ball | undefined => BALLS.find((b) => b.key === key);

/** Eficiencia RELATIVA de captura vs Poke Ball (catchRate 1). Ultra (4) = ~4x menos
 *  bolas por captura. Nao e "% de captura" — o jogo nao publica a formula absoluta. */
export const relativeEfficiency = (ball: Ball): number => ball.catchRate;
