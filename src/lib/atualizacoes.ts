// O que mudou no site, escrito pra quem USA — não pra quem programa.
//
// Por que isto é um arquivo escrito à mão e não o `git log`. O histórico do
// repositório é ótimo pra mim e péssimo pra quem visita: ele conta a mudança pelo
// que foi mexido no código ("o flutuante passa a vencer o modal no desenho e no
// Escape"), numa granularidade de commit, incluindo dezenas de passadas que
// ninguém de fora percebe. Gerar a página a partir dele daria uma lista longa,
// técnica e sem hierarquia — exatamente o que faz ninguém ler changelog.
//
// Aqui entra o que MUDA A RESPOSTA que a ferramenta dá, e a frase diz o efeito, não
// o mecanismo. Conserto que corrigiu um número entra sempre, mesmo pequeno: quem
// tomou a decisão errada com o número velho merece saber que ele mudou.
//
// A ordem é a do arquivo, do mais novo pro mais antigo. Não há ordenação por data
// no código de propósito — duas entradas do mesmo dia têm uma ordem que só quem
// escreveu sabe, e o `sort` embaralharia.

/** O que a entrada faz com a ferramenta. Decide a cor e o rótulo, nada mais. */
export type TipoAtualizacao = "novo" | "conserto" | "melhoria";

export const TIPO_LABEL: Record<TipoAtualizacao, string> = {
  novo: "Novo",
  conserto: "Conserto",
  melhoria: "Melhoria",
};

export const TIPO_COR: Record<TipoAtualizacao, string> = {
  novo: "var(--color-ok)",
  conserto: "var(--color-warn)",
  melhoria: "var(--color-t-calc)",
};

export interface Atualizacao {
  /** AAAA-MM-DD, e é só isso: hora não interessa a ninguém que lê */
  data: string;
  titulo: string;
  tipo: TipoAtualizacao;
  /**
   * A rota da ferramenta que mudou, exatamente como está em `FERRAMENTAS` — é
   * assim que a entrada herda a cor e o nome dela sem repetir nenhum dos dois.
   * `null` = mudou o site todo (ou nada em particular).
   */
  onde: string | null;
  /** uma frase: o que passou a acontecer, do ponto de vista de quem usa */
  resumo: string;
  /** o detalhe, pra quem quiser. Cada item é uma frase inteira. */
  itens?: string[];
}

export const ATUALIZACOES: Atualizacao[] = [
  {
    data: "2026-08-25",
    titulo: "Eevee, a oitava ferramenta",
    tipo: "novo",
    onde: "/eevee",
    resumo:
      "O Eevee não evolui: ele é trocado com o Marlon por um de cinco destinos, e as cinco " +
      "trocas custam exatamente o mesmo. A ferramenta mostra o que muda de verdade — onde " +
      "farmar as dez pedras no seu nível e qual eeveelution rende mais em combate.",
    itens: [
      "A tabela das cinco pedras não existe em fonte pública nenhuma; ela veio da tela da loja no jogo.",
      "Você informa os seis stats do seu Eevee e o IV sai lido de volta pela fórmula — a projeção dos cinco ramos passa a falar do SEU bicho, não de um médio.",
      "A Pokédex parou de desenhar 'Eevee vira Vaporeon no nível 80' nas fichas do Eevee e das cinco eeveelutions. O catálogo do jogo afirma isso, e é falso.",
    ],
  },
  {
    data: "2026-08-24",
    titulo: "O Stadium estava mentindo sobre o boss",
    tipo: "conserto",
    onde: "/stadium",
    resumo:
      "Três erros ao mesmo tempo faziam a arena prometer vitória em luta perdida. Os três " +
      "foram corrigidos, e o veredito mudou de lado nos casos reais.",
    itens: [
      "A penalidade de grupo entrou na conta: o dano que você TOMA é multiplicado por 3 elevado ao que falta de força no time. Um pokémon sozinho no nível toma 243x.",
      "Boss é elemento Neutro, e não o tipo da espécie de que ele é feito — a ferramenta prometia vantagem de 2,5x numa luta que é 1x.",
      "Os seis stats do alvo viraram campos editáveis, porque a projeção erra por ordem de grandeza: o Ancient Aero tem 72 mil de vida e a conta sobre o Aerodactyl dava 4,6 mil. O que você corrigir fica guardado por boss.",
    ],
  },
  {
    data: "2026-08-24",
    titulo: "O time entra com os stats do jogo",
    tipo: "melhoria",
    onde: "/stadium",
    resumo:
      "A arena parou de supor IV médio. Você cadastra o pokémon com os seis stats que o jogo " +
      "mostra, e o combate roda sobre esses números.",
    itens: [
      "A bolsa é do site inteiro: o mesmo pokémon serve de lutador no Stadium e de pai no Breeding.",
      "Deck aponta pras cartas em vez de copiar os números — corrigiu o nível de um, e todo deck em que ele está passa a contar a verdade.",
    ],
  },
  {
    data: "2026-08-24",
    titulo: "Stadium: seu time de seis contra um boss",
    tipo: "novo",
    onde: "/stadium",
    resumo:
      "A sétima ferramenta simula a luta inteira: quem entra, quanto cada um tira do boss, " +
      "quem cai e onde o time quebra. O HP do boss atravessa a troca de lutador, então o " +
      "segundo não entra contra um boss inteiro.",
    itens: [
      "Os 87 bosses do jogo, com o nível oficial de cada um.",
      "A medida que manda na tela é a fatia: quanto do boss cada um leva embora antes de cair.",
    ],
  },
  {
    data: "2026-08-24",
    titulo: "Os 18 tipos ganharam símbolo próprio",
    tipo: "melhoria",
    onde: null,
    resumo:
      "Tipo deixou de ser uma faixa de cor com nome e passou a ter o símbolo oficial, " +
      "desenhado em vetor. Vale no site inteiro — dex, meta, hunt e fichas.",
  },
  {
    data: "2026-08-24",
    titulo: "O destaque da home é quem está EM ALTA",
    tipo: "melhoria",
    onde: null,
    resumo:
      "Antes era o mais forte do jogo, que nunca muda — então a home nunca mudava. Agora é " +
      "quem foi mais procurado nas últimas 24 horas, com o topo da tier list assumindo quando " +
      "ninguém pesquisou nada.",
  },
  {
    data: "2026-08-24",
    titulo: "O IV parou de sair de conta invertida",
    tipo: "conserto",
    onde: "/calc",
    resumo:
      "A calculadora achava o IV invertendo a fórmula, e o arredondamento do jogo fazia ela " +
      "errar. Agora ela enumera os valores possíveis e devolve a FAIXA compatível com o stat " +
      "que você digitou — que é a resposta honesta, porque o jogo mostra o número já arredondado.",
  },
  {
    data: "2026-08-23",
    titulo: "A tier list mede combate, não soma de stat",
    tipo: "conserto",
    onde: "/meta",
    resumo:
      "A nota passou a sair de dano por segundo e HP efetivo. Somar poder de golpe trata um " +
      "golpe de 160 com 30s de recarga igual a um de 160 com 5s, e no Poke Idle World o " +
      "combate não tem turno.",
    itens: [
      "O tier virou nota contra régua fixa, e não posição na fila: se metade do catálogo fosse ótima, cortar por posição rebaixaria 40% dela.",
      "Lendários saem por padrão, porque uma lista de 'quem eu uso' não pode ser liderada por quem ninguém pode pôr em campo.",
    ],
  },
  {
    data: "2026-08-23",
    titulo: "O farm de ouro entrou na rota da Hunt",
    tipo: "melhoria",
    onde: "/hunt",
    resumo:
      "A hunt passou a medir ouro por hora junto com XP por hora, contando o valor esperado " +
      "de cada drop e o teto de chance que o Tipo do Dia respeita.",
  },
  {
    data: "2026-08-22",
    titulo: "O PIWdex no ar",
    tipo: "novo",
    onde: null,
    resumo:
      "Pokédex com 17 filtros, Itens com o índice reverso de drop, Calculadora de IV, Hunt, " +
      "Breeding e Meta. Tudo com o estado na URL, pra qualquer consulta virar link.",
  },
];

/** As `n` mais recentes — o que a home mostra. */
export const ultimasAtualizacoes = (n = 3): Atualizacao[] =>
  ATUALIZACOES.slice(0, n);

/** A data da mais recente, pra tela dizer desde quando ela está parada. */
export const ultimaMudanca = (): string => ATUALIZACOES[0]?.data ?? "";

/**
 * "25 de agosto de 2026".
 *
 * Sem `new Date(...)` na string crua: `new Date("2026-08-25")` é lido como UTC e
 * volta um dia atrás em qualquer fuso a oeste de Greenwich — o Brasil inteiro.
 * Partindo o texto à mão, a data que sai é a data que está escrita.
 */
const MES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function dataLonga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return `${d} de ${MES[m - 1]} de ${a}`;
}

/** "25/08" — a forma curta, pra caber no cartão da home. */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : iso;
}
