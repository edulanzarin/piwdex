import type { MetadataRoute } from "next";
import { getData } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { TODOS_SLUGS } from "@/lib/tipo-url";
import { TODOS_SLUGS_RARIDADE } from "@/lib/raridade-url";

/**
 * O mapa do site.
 *
 * Ele nao e exigido por ninguem, e mesmo assim vale: as fichas de especie e de
 * item sao paginas dinamicas (`ƒ`) que so existem quando alguem pede. Sem mapa, o
 * Google enxerga meia duzia de telas e um monte de rota parametrizada — e "site
 * sem conteudo" e a reprovacao mais comum de quem se inscreve no AdSense. Com o
 * mapa, as ~900 fichas aparecem como o que sao.
 *
 * `lastModified` sai da data do CATALOGO, nao do relogio: dizer que tudo mudou
 * hoje, todo dia, e ruido que o rastreador aprende a ignorar.
 */
// Dinamico pelo mesmo motivo das telas (source.ts busca com no-store), entao o
// `revalidate = 86400` que morava aqui tambem era letra morta.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getData();
  const quando = new Date(db.generatedAt);

  const telas: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...["/dex", "/itens", "/calc", "/hunt", "/breed", "/meta", "/stadium", "/eevee", "/atualizacoes", "/privacidade"].map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "/privacidade" ? 0.2 : 0.8,
    })),
  ];

  // Os hubs de tipo. Eles sao a camada do MEIO — a home leva neles, eles levam
  // nas ~910 fichas —, e prioridade maior que a da folha diz exatamente isso.
  const hubs: MetadataRoute.Sitemap = TODOS_SLUGS.map((slug) => ({
    url: `${SITE_URL}/dex/tipo/${slug}`,
    lastModified: quando,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const raridades: MetadataRoute.Sitemap = TODOS_SLUGS_RARIDADE.map((slug) => ({
    url: `${SITE_URL}/dex/raridade/${slug}`,
    lastModified: quando,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const fichas: MetadataRoute.Sitemap = [
    ...db.creatures.map((c) => ({ url: `${SITE_URL}/dex/${c.pokeId}`, lastModified: quando, priority: 0.6 })),
    ...db.items.map((i) => ({ url: `${SITE_URL}/itens/${i.id}`, lastModified: quando, priority: 0.4 })),
  ];

  return [...telas.map((t) => ({ ...t, lastModified: quando })), ...hubs, ...raridades, ...fichas];
}
