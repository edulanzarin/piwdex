// O catálogo de bosses do jogo, e o problema que ele traz junto.
//
// A fonte (`/game/bossCatalog.json`) publica QUATRO coisas de cada boss: nome,
// categoria, nível e drops. Não publica tipo, não publica base de stat, não
// publica moveset. Isso é servidor, e não tem endpoint público.
//
// Sem tipo e sem stat não há combate a simular. Então este arquivo faz uma coisa
// só, e é a única honesta que dá pra fazer: procura, no catálogo de espécies, a
// espécie DE QUE AQUELE BOSS É FEITO. "Mega Alakazam Lv 350" é um Mega Alakazam;
// "Clone Blastoise" é um Blastoise; "Ancient Aero" é um Aerodactyl.
//
// O que sai daqui é ESTIMATIVA, e a tela é obrigada a dizer isso. O jogo pode dar
// ao boss stat próprio, HP inflado ou golpe que espécie nenhuma tem — nada disso
// aparece na fonte. O que o de-para entrega é a única coisa que se sabe de
// verdade: com que TIPO ele bate e o que ele resiste, que é a metade da pergunta
// que mais muda a resposta.
//
// ## Por que metade do catálogo fica de fora
//
// Uns quarenta bosses não são pokémon nenhum. A categoria Terror inteira
// (Gyakkyo, Yurei, Kitsune) é criação do jogo; as Mystery Dungeons trazem os
// humanos da Rocket (Ariana, Proton, Archer); e há Ancient Temple, que é um
// lugar. Não existe espécie pra eles, e INVENTAR uma seria pior do que não ter:
// a tela devolveria um número com cara de resposta pra um combate que ninguém
// modelou.
//
// Esses ficam listados assim mesmo — com nível, categoria e drops — e a
// ferramenta diz, na cara, que não sabe simular aquele. Boss que existe e não
// aparece na lista é pior: parece que a lista está desatualizada.

import bossData from "@/data/bosses.json";
import type { MetaMon } from "./meta";

export interface Boss {
  key: string;
  name: string;
  /** caminho no host do jogo (/assets/bosses/...), ou null */
  img: string | null;
  icon: string | null;
  category: string;
  /** o nível OFICIAL do boss, o único número de combate que a fonte publica */
  level: number;
  drops: string[];
}

export interface BossResolvido extends Boss {
  /** a espécie de que ele é feito, ou null quando não é pokémon nenhum */
  mon: MetaMon | null;
}

const BRUTO = bossData.bosses as Boss[];

/** Quando o catálogo foi baixado do jogo. */
export const BOSSES_GERADO_EM: string = bossData.generatedAt;

/**
 * A ordem das categorias na lista.
 *
 * É a ordem do JOGO, não a alfabética: quem abre a ferramenta procura pelo grupo
 * em que entrou ontem, e "Especiais" antes de "Lendary Beasts" só porque E vem
 * antes de L é ordenação que não ajuda ninguém a achar nada. Categoria que
 * aparecer na fonte e não estiver aqui cai no fim, junta, em vez de sumir.
 */
const ORDEM_CATEGORIA = [
  "Especiais",
  "Mystery Dungeons",
  "Lendary Beasts",
  "Terror",
  "Raids",
];

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Ornamento de nome de boss: o que o jogo pendura na frente e atrás da espécie.
 *
 * A lista é de PREFIXO e SUFIXO de verdade, e a ordem de descasque importa:
 * "megaVenusaurHP" precisa perder o `mega` e o `hp` pra virar `venusaur`, mas
 * "Mega Alakazam" É uma espécie do catálogo e não pode ser descascado antes da
 * primeira tentativa. Por isso o laço tenta o nome inteiro ANTES de tirar
 * qualquer coisa, a cada passada.
 */
const PREFIXO = /^(mystery|terror|boss|the|giant|dark|cyber|mecha|shiny|clone|mega|ancient|hisuian|furious|brave|evil)/;
const SUFIXO = /(hp|main|halloween|valentines|easter|christmas|15th|johto|kanto|boss|dungeon|art|2)$/;

/**
 * O que a regra automática não alcança.
 *
 * Cada linha aqui é um boss cujo nome É de uma espécie, mas com uma grafia que
 * nenhuma regra de descasque resolve sem virar chute: `Mr. Mime` perde o ponto e
 * vira `mrmime`, e "Mecha Shiny Mime" descasca até `mime`, que não é igual;
 * `Bowstoise` é um trocadilho, e trocadilho não tem regra.
 *
 * A tabela é curta de propósito. Boss que exigiria uma decisão de VALOR — o
 * Overqwil é um Qwilfish? o Kleavor é um Scyther? — fica FORA, mesmo sendo
 * evidente pra quem joga: as bases desses são muito diferentes, e herdar a base
 * errada devolve um combate inteiro errado com cara de certo. Sem espécie, a
 * tela pelo menos avisa.
 */
const DE_PARA: Record<string, string> = {
  mecha_shiny_mime: "Mr. Mime",
  mecha_shiny_farfetch: "Farfetchd",
  theRedGyarados: "Gyarados",
  "fight-the-bite_meowth": "Meowth",
  megaCharizardyHP: "Charizard",
  bowstoiseEaster: "Blastoise",
  mystery_celebi_dragon: "Celebi",
  mystery_celebi_wood_dragon: "Celebi",
  mystery_celebi_dungeon: "Celebi",
};

/**
 * A espécie de um boss, ou null.
 *
 * Tenta o nome inteiro, depois vai descascando ornamento; a cada passada tenta de
 * novo antes de tirar mais. Prefixo primeiro, sufixo só quando o prefixo não tem
 * mais o que tirar — senão "megaCharizardHP" perderia o `hp` numa passada em que
 * o `mega` ainda estava lá, e as duas voltas gastariam uma tentativa cada.
 */
function resolverEspecie(boss: Boss, porNome: Map<string, MetaMon>): MetaMon | null {
  const manual = DE_PARA[boss.key];
  if (manual) return porNome.get(norm(manual)) ?? null;

  for (const bruto of [boss.name, boss.key]) {
    let s = norm(bruto);
    for (let i = 0; i < 6 && s; i++) {
      const achou = porNome.get(s);
      if (achou) return achou;
      const antes = s;
      s = s.replace(PREFIXO, "");
      if (s === antes) s = s.replace(SUFIXO, "");
      if (s === antes) break;
    }
    const ultimo = porNome.get(s);
    if (ultimo) return ultimo;
  }
  return null;
}

/**
 * O catálogo de bosses com a espécie de cada um resolvida.
 *
 * Ordenado por categoria (na ordem do jogo) e, dentro dela, por nível — que é
 * como a pessoa escolhe: ela sabe o nível que aguenta antes de saber o nome do
 * boss.
 */
export function resolverBosses(mons: MetaMon[]): BossResolvido[] {
  const porNome = new Map<string, MetaMon>();
  for (const m of mons) {
    const k = norm(m.name);
    // O PRIMEIRO ganha. O catálogo tem nome repetido (dois "Blastoise", um deles
    // variante de skin), e trocar a espécie resolvida por causa da ordem de
    // leitura trocaria os stats do boss sem nada na tela mudar.
    if (!porNome.has(k)) porNome.set(k, m);
  }

  const ordem = (c: string): number => {
    const i = ORDEM_CATEGORIA.indexOf(c);
    return i < 0 ? ORDEM_CATEGORIA.length : i;
  };

  return BRUTO.map((b) => ({ ...b, mon: resolverEspecie(b, porNome) })).sort(
    (a, b) =>
      ordem(a.category) - ordem(b.category) ||
      a.category.localeCompare(b.category) ||
      a.level - b.level ||
      a.name.localeCompare(b.name),
  );
}

/** Quantos bosses o catálogo tem, sem precisar resolver espécie nenhuma. */
export const TOTAL_BOSSES = BRUTO.length;
