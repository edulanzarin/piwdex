// Host do jogo e resolucao de asset, num lugar so. No v1 existiam tres copias de
// `abs` espalhadas e um modulo sem nenhuma — por isso o icone das bolas saia como
// caminho RELATIVO e o navegador o resolvia contra piwdex.com.br, dando 404.
export const GAME_HOST = process.env.GAME_HOST || "https://poke.idleworld.online";

/** Caminho de asset do jogo -> URL absoluta. Idempotente: URL absoluta passa direto. */
export const gameAssetUrl = (u: string): string =>
  !u ? "" : u.startsWith("http") ? u : `${GAME_HOST}${u.startsWith("/") ? "" : "/"}${u}`;
