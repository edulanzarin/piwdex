// URLs de imagem.
//
// Sprite do pokemon: preferimos a ARTE REAL DO JOGO, self-hostada em
// public/game-sprites/<looktype>.webp (recortada por scripts/bake-sprites.mjs a partir
// do outfit-system do jogo). Assim o piwdex fica identico ao que se ve jogando. Shiny e
// looktypes nao recortados caem no sprite da PokeAPI. O mapa pokeId->looktype + a lista
// de looktypes recortados vem de src/data/game-sprites.json.

import type { Item } from "./types";
import gameSprites from "@/data/game-sprites.json";

const GAME_HOST = "https://poke.idleworld.online";
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const POKE_TO_LOOK: Record<string, number> = gameSprites.pokeToLook;
const BAKED = new Set<number>(gameSprites.baked);
// Skins de player (trainer/premium/clan): looktype -> nome. Recortadas no mesmo lote.
const SKIN_NAMES = gameSprites.skins as Record<string, string>;

/** Arte do jogo pro pokemon (self-hostada), ou null se nao houver recorte. */
export function gameSpriteUrl(pokeId: number): string | null {
  const look = POKE_TO_LOOK[String(pokeId)];
  if (look != null && BAKED.has(look)) return `/game-sprites/${look}.webp`;
  return null;
}

/** Arte da skin do jogador (self-hostada) pelo lookType, ou null se nao recortada. */
export function skinSpriteUrl(lookType: number): string | null {
  return SKIN_NAMES[String(lookType)] ? `/game-sprites/${lookType}.webp` : null;
}

/** Nome da skin (ex.: "Gamer VIP Outfit"), ou null. */
export function skinName(lookType: number): string | null {
  return SKIN_NAMES[String(lookType)] ?? null;
}

// Variantes (Furious/Brave/Evil/Ancient...) tem pokeId >= 10000 sem sprite propria na
// PokeAPI, mas usam o MESMO visual da forma base (compartilham o looktype). Mapa
// variante -> pokeId base, pra reusar o sprite da base. Gerado do snapshot por looktype.
const VARIANT_SPRITE: Record<number, number> = {10001:9, 10501:9, 10502:160, 10503:154, 10504:3, 10505:214, 10506:123, 10507:203, 10508:26, 10509:181, 10510:125, 10511:148, 10512:91, 10513:87, 10514:124, 10515:221, 10516:241, 10517:232, 10518:28, 10519:76, 10520:112, 10521:6, 10522:157, 10523:34, 10524:31, 10525:169, 10526:94, 10527:200, 10528:107, 10529:106, 10530:237, 10531:59, 10532:126, 10533:247, 10534:208, 10535:40, 10536:178, 10537:65, 10538:97, 10539:130, 10540:226, 10541:127, 10542:36, 10543:210, 10544:227, 10545:164, 10546:18, 10547:105, 13252:252, 13253:253, 13254:254, 13255:255, 13256:256, 13257:257, 13258:258, 13259:259, 13260:260, 13261:261, 13262:262, 13270:270, 13271:271, 13272:272, 13273:273, 13274:274, 13275:275, 13276:276, 13277:277, 13278:278, 13279:279, 13280:280, 13281:281, 13282:282, 13287:287, 13288:288, 13293:293, 13294:294, 13295:295, 13296:296, 13302:302, 13303:303, 13304:304, 13305:305, 13306:306, 13307:307, 13308:308, 13309:309, 13310:310, 13322:322, 13323:323, 13324:324, 13325:325, 13326:326, 13328:328, 13329:329, 13330:330, 13332:332, 13333:333, 13334:334, 13335:335, 13336:336, 13341:341, 13342:342, 13343:343, 13344:344, 13354:354, 13355:355, 13356:356, 13357:357, 13359:359, 13361:361, 13362:362, 13363:363, 13364:364, 13365:365, 13371:371, 13372:372, 13374:374, 13375:375, 13447:447, 13448:448};

/** Sprite do pokemon pelo pokeId. Prioridade: arte do jogo (nao-shiny) -> PokeAPI.
 *  Resolve variantes pro sprite da base. null para ids fora da faixa valida na PokeAPI. */
export function spriteUrl(pokeId: number, shiny = false): string | null {
  if (!shiny) {
    const g = gameSpriteUrl(pokeId);
    if (g) return g;
  }
  const id = VARIANT_SPRITE[pokeId] ?? pokeId;
  if (id <= 0 || id >= 1e4) return null;
  return `${SPRITE_BASE}/${shiny ? "shiny/" : ""}${id}.png`;
}

/** Sprite ANIMADO (gif gen5) — existe ate ~id 649. Usado nos loaders. */
export function animatedSpriteUrl(pokeId: number): string {
  return `${SPRITE_BASE}/versions/generation-v/black-white/animated/${pokeId}.gif`;
}

/** Icone de item pelo nome do arquivo. Absoluto (/assets/...) usa a raiz do jogo;
 *  bare vira /assets/items/. Vale pra itens do catalogo e do inventario/deposito. */
export function assetIconUrl(icon: string): string {
  if (!icon) return "";
  if (icon.startsWith("http")) return icon;
  if (icon.startsWith("/")) return `${GAME_HOST}${icon}`;
  return `${GAME_HOST}/assets/items/${icon}`;
}

/** Icone do item do catalogo. */
export function itemIconUrl(item: Item): string {
  return assetIconUrl(item.icon);
}
