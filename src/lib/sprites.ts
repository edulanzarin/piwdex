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
    // A ARTE OFICIAL passou a vir primeiro, e essa troca vale pro site inteiro.
    //
    // Ela mora AQUI, e nao em cada chamada, porque sao ~40 pontos de uso — do
    // card de 128px ao icone de 26px na fila de comparacao. Trocar um a um
    // deixaria metade da tela numa arte e metade na outra, que e pior do que
    // qualquer uma das duas sozinha: o mesmo pokemon com dois desenhos na mesma
    // pagina le como bug, nao como escolha.
    //
    // O que se paga: o render e ~150 KB contra ~8 KB do webp recortado, e ele e
    // desenhado pra ser visto GRANDE — a 26px o detalhe interno vira mancha.
    // Se um dia a fila miuda pesar, a saida e um segundo parametro aqui (um
    // `pequeno: true` que devolve o recorte do jogo), e nao voltar a espalhar a
    // decisao pelas telas.
    const oficial = officialArtUrl(pokeId);
    if (oficial) return oficial;
    const g = gameSpriteUrl(pokeId);
    if (g) return g;
  }
  const id = VARIANT_SPRITE[pokeId] ?? pokeId;
  if (id <= 0 || id >= 1e4) return null;
  return `${SPRITE_BASE}/${shiny ? "shiny/" : ""}${id}.png`;
}

/**
 * A ARTE OFICIAL em alta — o render de catalogo da PokeAPI (~475px).
 *
 * Ela nao substitui a arte do jogo, e a distincao e a coisa mais importante deste
 * arquivo. Cada uma responde uma pergunta diferente:
 *
 * - **Arte do jogo** (`gameSpriteUrl`) responde "e este que eu vejo jogando". Ela
 *   e a fonte certa na GRADE, onde o trabalho e reconhecer: a pessoa varre 60
 *   cards procurando o bicho que acabou de ver no campo.
 * - **Arte oficial** responde "como esta especie e". Ela e a fonte certa onde ha
 *   UMA peca grande e o nome ja esta escrito do lado — a chegada da ficha —,
 *   porque ali nao ha nada a reconhecer e ha muito a mostrar.
 *
 * Duas ressalvas, e por isso ela nao vai pra grade:
 *
 * 1. **Variante nao tem arte oficial.** Os pokeId >= 10000 (Brave, Furious,
 *    Ancient) compartilham o looktype da base no jogo, mas a PokeAPI so conhece a
 *    forma base — entao "Brave Blastoise" sairia identico a "Blastoise", e a dex
 *    passaria a afirmar que sao a mesma coisa.
 * 2. **Peso.** Sao ~150 KB por render contra ~8 KB do webp recortado. Sessenta na
 *    tela e a diferenca entre uma grade que abre e uma que carrega.
 *
 * `null` quando nao ha (variante, ou id fora da faixa) — e quem chama cai na arte
 * do jogo, que e o comportamento certo: melhor a arte menor e CERTA do que a
 * maior e de outro bicho.
 */
export function officialArtUrl(pokeId: number): string | null {
  /**
   * A variante RESOLVE pra base, e nao devolve null.
   *
   * A primeira versao barrava tudo acima de 10000 com o argumento de que "usar o
   * render da base seria dizer que sao iguais". O argumento estava errado, e a
   * prova estava no arquivo: o `VARIANT_SPRITE` logo acima existe exatamente pra
   * isso, e o comentario dele diz que as variantes "usam o MESMO visual da forma
   * base (compartilham o looktype)". Elas nao sao outro desenho — sao a mesma
   * especie com stats proprios.
   *
   * O sintoma foi o Kirlia #13281 aparecendo com o sprite miudo do jogo no meio de
   * uma grade de renders em alta, junto de dezenas de outros da faixa 13xxx.
   *
   * Licao: quando um mapa de de-para ja existe pro mesmo problema, a resposta e
   * consultar o mapa — nao inventar uma regra que o contradiz.
   */
  const id = VARIANT_SPRITE[pokeId] ?? pokeId;
  if (id <= 0 || id >= 1e4) return null;
  return `${SPRITE_BASE}/other/official-artwork/${id}.png`;
}

/**
 * Sprite ANIMADO (gif gen5).
 *
 * A fonte so tem animacao ate o id **649** — pedir 14448 devolve 404, e um 404
 * numa `<img>` renderizada no servidor pinta o icone de imagem quebrada ANTES
 * de qualquer JS poder tratar. Por isso a checagem e aqui, na origem: fora da
 * faixa a resposta e `null` e o chamador nem tenta.
 *
 * Variante (10xxx/13xxx) resolve pro id da forma base, que costuma estar na
 * faixa — o Brave Charizard anima com o gif do Charizard.
 */
const ANIMATED_MAX = 649;

export function animatedSpriteUrl(pokeId: number): string | null {
  const id = VARIANT_SPRITE[pokeId] ?? pokeId;
  if (id <= 0 || id > ANIMATED_MAX) return null;
  return `${SPRITE_BASE}/versions/generation-v/black-white/animated/${id}.gif`;
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

/**
 * A imagem e PIXEL ART?
 *
 * Existe porque `image-rendering: pixelated` e certo pra uma fonte e errado pra
 * outra, e quem chama nao devia ter de saber qual veio: o `spriteUrl` escolhe
 * entre render oficial (suavizado) e recorte do jogo (pixel) sem avisar, entao a
 * decisao de suavizacao tem de sair do MESMO lugar.
 *
 * Antes cada tela passava `pixel={!officialArtUrl(id)}` — uma segunda chamada ao
 * mesmo seletor, escrita a mao, em cada ponto de uso. Bastava esquecer num pra
 * ter render de 475px serrilhado no meio da pagina.
 */
export function ehPixelArt(src: string | null): boolean {
  if (!src) return false;
  return !src.includes("official-artwork");
}
