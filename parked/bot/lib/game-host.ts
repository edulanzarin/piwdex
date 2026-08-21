// Host do jogo e resolucao de asset, num lugar so. Existia uma copia de `abs` em
// game-auto.ts e outra em game-shop.ts, e o game-account.ts nao tinha nenhuma — por
// isso o icone das bolas saia como caminho RELATIVO ("/assets/markitems/pokeball.png")
// e o navegador resolvia contra piwdex.com.br, dando 404.
export const GAME_HOST = process.env.GAME_HOST || "https://poke.idleworld.online";

/** Caminho de asset do jogo -> URL absoluta. Idempotente: URL absoluta passa direto. */
export const gameAssetUrl = (u: string): string =>
  !u ? "" : u.startsWith("http") ? u : `${GAME_HOST}${u.startsWith("/") ? "" : "/"}${u}`;
