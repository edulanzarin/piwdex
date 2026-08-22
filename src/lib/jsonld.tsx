// Dados estruturados: a descricao, pro rastreador, do que a tela JA mostra.
//
// A regra que vale pra tudo aqui: **marcacao nao promete nada a mais**. Ela
// espelha o que esta visivel, com a mesma URL do canonical. Marcar o que a
// pagina nao mostra e o caminho curto pra acao manual do Google — e o site vive
// de ser exato.
//
// O que NAO entra, e por que (checado na doc do Google, nao no achismo):
//  - `Product`/`Offer` na ficha de item: exige moeda ISO e preco real, e o ouro
//    do jogo nao e nem uma coisa nem outra;
//  - `FAQPage` e `HowTo`: os dois recursos foram desligados pelo Google;
//  - `Dataset`: alimenta o Dataset Search (vertical academica), nao a Busca;
//  - `SearchAction`/sitelinks searchbox: descontinuado;
//  - `aggregateRating` em qualquer coisa: nao ha nota de usuario neste site.
//
// Sobrou o `BreadcrumbList`, que e o unico resultado rico vivo que casa com este
// site — e ele descreve a trilha que a propria ficha desenha em `<nav>`.

import { SITE_URL } from "./site";

export interface Degrau {
  nome: string;
  /** caminho relativo; vira URL absoluta aqui, porque relativa o Google descarta */
  caminho: string;
}

/**
 * A trilha, no formato do schema.org.
 *
 * Menos de dois degraus e invalido — por isso a raiz "PIWdex" sempre entra, e ela
 * e honesta: o logo do topo e um link pra home em toda pagina do site.
 */
export function trilha(degraus: Degrau[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: degraus.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.nome,
      item: `${SITE_URL}${d.caminho}`,
    })),
  };
}

/** O `<script>` do JSON-LD. Vai no corpo da pagina e nao no `generateMetadata`:
 *  a Metadata API do Next nao emite script, entao tentar por la falha calado. */
export function JsonLd({ dado }: { dado: object }) {
  return (
    <script
      type="application/ld+json"
      // O conteudo e nosso e vem de dado do catalogo, nao de entrada de usuario.
      // O `<` escapado evita que um nome com caractere estranho feche a tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dado).replace(/</g, "\\u003c") }}
    />
  );
}
