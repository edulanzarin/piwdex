// Anuncios, num lugar so.
//
// Mesmo contrato do `apoio.ts`: **enquanto nao ha id, nao ha anuncio**. Sem o
// publisher id, o script do Google nao carrega e nenhum espaco e reservado — a
// pagina fica exatamente como e hoje, em vez de abrir buracos cinzas esperando
// um anuncio que nunca vem.
//
// A separacao entre "cliente" e "slot" e a do proprio AdSense: o CLIENTE e a
// conta (ca-pub-...), o SLOT e cada unidade criada no painel. Uma unidade nova la
// vira uma linha aqui, e o resto do site nao muda.

/**
 * Conta do AdSense (`ca-pub-...`), vinda do ambiente.
 *
 * Variavel e nao constante no codigo por dois motivos praticos: o id nao precisa
 * viver no repositorio, e `NEXT_PUBLIC_*` e INLINADO no `next build` — entao, sem
 * a variavel no build, a checagem vira codigo morto e o navegador nao recebe uma
 * linha sequer de anuncio. E o melhor gate que existe pra desenvolvimento: nem o
 * script, nem a requisicao, nem impressao invalida em localhost.
 *
 * ATENCAO no Docker: `environment:` do compose e RUNTIME e nao chega no bundle do
 * cliente. Tem que entrar como `build.args` — ver `Dockerfile` e `docker-compose.yml`.
 */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

/**
 * As unidades. A chave e o LUGAR, nao o formato: quem le o codigo precisa saber
 * onde aquilo aparece, e o formato e escolha do painel do Google.
 *
 * Cada valor e o `data-ad-slot` da unidade criada no AdSense. Vazio = aquele
 * lugar nao mostra nada, mesmo com a conta configurada — da pra ligar um lugar de
 * cada vez e medir, em vez de encher o site de uma vez.
 */
export const SLOTS = {
  /** intercalado na grade da dex e na de itens (unidade de FEED no painel) */
  grade: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GRADE ?? "",
  /** faixa horizontal antes do rodape */
  rodape: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RODAPE ?? "",
} as const;

export type LugarDeAnuncio = keyof typeof SLOTS;

/**
 * O `data-ad-layout-key` das unidades de FEED.
 *
 * Ele existe separado do slot porque e outra coisa: o slot identifica a unidade,
 * o layout key descreve o ARRANJO (onde entram imagem, titulo e descricao dentro
 * do card) que voce montou no editor do painel. Sao dois codigos, gerados na
 * mesma tela, e o AdSense so entrega o segundo depois de voce desenhar o
 * anuncio.
 *
 * Sem ele, a unidade de feed sobe **sem erro nenhum** e simplesmente nao pinta —
 * que e o pior modo de falha possivel, porque parece que o anuncio "ainda nao
 * encheu". Por isso ele e configuracao propria, e nao um valor chutado no
 * componente.
 *
 * Unidade de DISPLAY nao usa layout key. Se voce criar a da grade como display
 * em vez de feed, deixe esta variavel vazia e troque `formato` pra "auto" no
 * `CardAnuncio`.
 */
export const LAYOUTS = {
  grade: process.env.NEXT_PUBLIC_ADSENSE_LAYOUT_GRADE ?? "",
} as const;

/** Ha conta configurada? Sem isso o script nem carrega. */
export const temAnuncios = (): boolean => ADSENSE_CLIENT.trim().length > 0;

/** Aquele lugar especifico esta ligado? */
export const temSlot = (lugar: LugarDeAnuncio): boolean =>
  temAnuncios() && SLOTS[lugar].trim().length > 0;

/**
 * De quantos em quantos cards entra um anuncio na grade.
 *
 * O numero e alto de proposito. A pagina da dex mostra 24 cards por padrao: com
 * um a cada 12, sao dois anuncios por pagina — o suficiente pra render e longe da
 * densidade que faz a grade PARECER um mostruario de anuncio. A politica do
 * AdSense nao publica um numero magico; o que ela cobra e que o anuncio nao
 * domine nem se disfarce de conteudo, e densidade e a primeira coisa que quebra
 * as duas.
 */
export const CARDS_POR_ANUNCIO = 12;

/** O marcador que ocupa o lugar de um anuncio no meio da lista. O `ordem` nao e
 *  enfeite: e a CHAVE do React. Se a chave fosse a posicao na lista, mexer num
 *  filtro remontaria o slot — e slot que remonta pede outro anuncio, o que o
 *  AdSense trata como atualizacao automatica (proibida). Com o ordinal, o
 *  primeiro anuncio continua sendo o primeiro anuncio enquanto a pagina viver. */
export interface MarcaDeAnuncio {
  anuncio: true;
  ordem: number;
}

export const ehAnuncio = (x: unknown): x is MarcaDeAnuncio =>
  typeof x === "object" && x !== null && (x as MarcaDeAnuncio).anuncio === true;

/**
 * Espalha marcadores de anuncio numa lista JA paginada.
 *
 * As regras vem da politica do AdSense e do bom senso da grade:
 *  - **nunca na primeira celula** e **nunca no fim**: anuncio na entrada e o que
 *    faz a grade parecer mostruario, e no fim ele cola na faixa do rodape;
 *  - **no minimo 3 cards entre anuncios** — o Google publica esse numero pro
 *    formato de feed; aqui o intervalo padrao e 12, quatro vezes a folga;
 *  - **so com material suficiente**: pagina menor que o intervalo nao ganha
 *    anuncio nenhum, senao uma busca com 3 resultados viria com um anuncio no meio.
 */
export function intercalar<T>(itens: T[], cada = CARDS_POR_ANUNCIO): (T | MarcaDeAnuncio)[] {
  if (itens.length <= cada) return itens;
  const saida: (T | MarcaDeAnuncio)[] = [];
  let ordem = 0;
  itens.forEach((item, i) => {
    if (i > 0 && i % cada === 0 && itens.length - i > 2) {
      saida.push({ anuncio: true, ordem: ordem++ });
    }
    saida.push(item);
  });
  return saida;
}
