import type { Metadata } from "next";
import { CascaSite } from "@/components/casca-site";
import { ADSENSE_CLIENT, temAnuncios } from "@/lib/ads";

/** Token da meta de verificacao do Search Console. Vazio = a meta nao sai. */
const GOOGLE_VERIFICACAO = process.env.NEXT_PUBLIC_GOOGLE_VERIFICACAO?.trim() ?? "";

/**
 * A DEX — a metade publica do piwdex, a que vive de busca.
 *
 * Tudo que este arquivo declara e sobre ser encontrado: descricao, metadado
 * social, verificacao de rastreador. Nada disso desce pro robo, que e area
 * logada e paga, e cujo layout declara o oposto (`noindex`).
 */
export const metadata: Metadata = {
  description:
    "Pokédex completa do Poke Idle World: filtro por tipo, raridade, fraqueza, " +
    "drop e faixa de nível, com stats, golpes, locais de caça e índice reverso de itens.",
  openGraph: {
    type: "website",
    siteName: "PIWdex",
    locale: "pt_BR",
    title: "PIWdex — dex e ferramentas de Poke Idle World",
    description:
      "Stats, drops com a chance real, onde farmar cada item, rota de caça e " +
      "tier list — direto do catálogo do Poke Idle World.",
  },
  twitter: { card: "summary_large_image" },
  /**
   * Verificacao do Search Console e do AdSense, as duas por variavel.
   *
   * Sem o Search Console o site esta no ar no escuro: nao da pra submeter o
   * sitemap, nem ver que consulta traz gente, nem descobrir que uma pagina caiu
   * do indice. E o unico instrumento que responde "meu SEO funcionou?" — todo o
   * resto e teoria.
   *
   * A propriedade se verifica de dois jeitos, e os dois estao cobertos: a meta
   * abaixo (basta colar o token no ambiente) ou o registro DNS, que nem precisa
   * de deploy. O que nao existe e adivinhar o token, entao ele e configuracao.
   */
  other: {
    ...(temAnuncios() ? { "google-adsense-account": ADSENSE_CLIENT } : {}),
    ...(GOOGLE_VERIFICACAO ? { "google-site-verification": GOOGLE_VERIFICACAO } : {}),
  },
};

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return <CascaSite>{children}</CascaSite>;
}
