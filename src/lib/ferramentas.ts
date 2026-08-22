import {
  BookOpen,
  Calculator,
  Egg,
  Package,
  Radar,
  Swords,
  type LucideIcon,
} from "lucide-react";

/**
 * As seis ferramentas, num lugar so.
 *
 * Antes o mesmo dado morava em tres arquivos: a home tinha nome, cor, arte e
 * paragrafo; a navegacao tinha nome e rota; cada pagina repetia arte, cor e
 * icone de reserva na chamada do cabecalho. Nada disso e opiniao de tela — e
 * identidade de ferramenta, e identidade repetida em tres lugares e identidade
 * que envelhece em dois.
 *
 * Aqui elas viram uma lista so, e a ordem da lista e a ordem da navegacao.
 *
 * Sobre o TEXTO: sao dois campos, e eles nao dizem a mesma coisa em tamanhos
 * diferentes. `linha` e o que a pessoa le no topo da ferramenta ja aberta, com
 * a tela na frente dela — uma frase, direta, sem lista. `desc` e o que ela le
 * na home, ANTES de escolher, e por isso pode gastar duas frases dizendo o que
 * tem la dentro.
 */
export interface Ferramenta {
  href: string;
  /** como o nome se escreve, com acento — a navegacao e o heroi usam este */
  nome: string;
  /** nome do PNG em public/images/icons, sem extensao */
  arte: string;
  /** token de cor da ferramenta */
  cor: string;
  /** icone de linha: reserva de quando o PNG nao vem, e o glifo da navegacao */
  Icone: LucideIcon;
  /** uma frase: o que a ferramenta faz, lida no topo dela */
  linha: string;
  /** o paragrafo do card da home */
  desc: string;
}

export const FERRAMENTAS: Ferramenta[] = [
  {
    href: "/dex",
    nome: "Pokédex",
    arte: "pokedex",
    cor: "var(--color-t-dex)",
    Icone: BookOpen,
    linha: "Todas as espécies do jogo, com filtro pra achar quem você procura.",
    desc:
      "Stats, moveset, evolução e drops de cada espécie. Filtra por tipo, raridade, " +
      "origem, estágio, fraqueza e faixa de nível, valor, XP e poder de golpe.",
  },
  {
    href: "/itens",
    nome: "Itens",
    arte: "itens",
    cor: "var(--color-t-itens)",
    Icone: Package,
    linha: "Cada item do jogo e quem dropa ele, com a chance de verdade.",
    desc:
      "O catálogo de itens com o índice ao contrário: em vez de olhar o pokémon e ver o " +
      "que ele solta, você olha o item e descobre de quem farmar.",
  },
  {
    href: "/calc",
    nome: "Calculadora",
    arte: "calculadora",
    cor: "var(--color-t-calc)",
    Icone: Calculator,
    linha: "Descobre o IV que o jogo esconde, a partir dos stats que ele mostra.",
    desc:
      "IV, Quality e Poder pela fórmula do jogo. Projeta os stats no nível que você " +
      "quiser e mostra quanto falta pro teto da espécie.",
  },
  {
    href: "/hunt",
    nome: "Hunt",
    arte: "hunt",
    cor: "var(--color-t-hunt)",
    Icone: Radar,
    linha: "Onde o seu pokémon rende mais, e até onde ele aguenta caçar.",
    desc:
      "Simula todo alvo do jogo contra o seu pokémon e mede os dois lados do combate: " +
      "XP/h, ouro/h e o risco de apanhar. No fim, monta a rota de níveis até a sua meta.",
  },
  {
    href: "/breed",
    nome: "Breeding",
    arte: "breeding",
    cor: "var(--color-t-breed)",
    Icone: Egg,
    linha: "Se o par vale a pena, o que sai do ovo e quantos breeds faltam.",
    desc:
      "Valida o par, mostra o sorteio de Quality e o IV que o filho herda. Também diz " +
      "quantos breeds faltam até a Quality alvo, no melhor caso, no típico e no azarado.",
  },
  {
    href: "/meta",
    nome: "Meta",
    arte: "meta",
    cor: "var(--color-t-meta)",
    Icone: Swords,
    linha: "Quem ganha de quem, medindo dano por segundo e resistência.",
    desc:
      "Tier list por nota, duelo entre dois pokémon com nível e quality, e o panorama " +
      "ofensivo de cada tipo. A nota sai de combate, não de soma de stat.",
  },
];

/**
 * A ferramenta de uma rota.
 *
 * Estoura se a rota nao existir, e isso e de proposito: a alternativa e o heroi
 * renderizar sem cor e sem arte por causa de um erro de digitacao na rota, o que
 * so seria descoberto olhando a tela.
 */
export function ferramentaDe(href: string): Ferramenta {
  const f = FERRAMENTAS.find((x) => x.href === href);
  if (!f) throw new Error(`ferramenta desconhecida: ${href}`);
  return f;
}
