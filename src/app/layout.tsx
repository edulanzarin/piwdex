import type { Metadata, Viewport } from "next";
import { Oxanium } from "next/font/google";
import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ApoioFlutuante } from "@/components/apoio";
import { ADSENSE_CLIENT, temAnuncios } from "@/lib/ads";
import { SITE_URL } from "@/lib/site";
import { Anuncio } from "@/components/anuncio";
import "./globals.css";

/**
 * Uma fonte so: **Oxanium**, nos pesos 400/500/600/700.
 *
 * Ela sucede a Quantico, que sucedeu quatro reprovadas — Press Start 2P
 * (ilegivel), Silkscreen (some no corpo pequeno), Jersey 10 (condensada e fina) e
 * Orbitron (larga e fria). O padrao das bitmap era sempre o mesmo: so funcionam
 * com traco grosso E corpo grande, e nessa combinacao a densidade morre.
 *
 * A troca comecou por gosto — "quadrada e um pouco mais grossa" — e a Quantico
 * nao tinha como atender: ela existe so em 400 e 700, entao nao ha meio termo
 * entre fino e negrito. Seis familias quadradas foram comparadas RENDERIZADAS na
 * mesma tabela da Hunt, e nao no catalogo.
 *
 * Quem decidiu, no fim, foi um numero: **o digito da Oxanium tem largura fixa**.
 * Medido no proprio site, "1111" e "0000" dao a MESMA largura (0% de diferenca),
 * contra 6% da Quantico e 30-44% de Chakra Petch, Bai Jamjuree, Saira e Rubik.
 * Num site que e coluna de numero de ponta a ponta — XP/h, ouro/h, stats, notas
 * de tier —, digito de largura variavel desalinha a coluna inteira a cada "1".
 * O `tabular-nums` do CSS nao salva ninguem aqui: nenhuma das seis publica a
 * feature, entao ou a fonte ja nasce com o digito fixo, ou nao ha o que ligar.
 */
const quantico = Oxanium({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
});


export const metadata: Metadata = {
  // `metadataBase` e a base de TODA URL relativa que o Next escreve — og:image,
  // canonical, alternates. Sem ela o Next emite caminho relativo e nenhum
  // rastreador resolve; e o pre-requisito dos dois blocos abaixo.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PIWdex — dex e ferramentas de Poke Idle World",
    template: "%s · PIWdex",
  },
  description:
    "Pokédex completa do Poke Idle World: filtro por tipo, raridade, fraqueza, " +
    "drop e faixa de nível, com stats, golpes, locais de caça e índice reverso de itens.",
  applicationName: "PIWdex",
  // CANONICAL NAO ENTRA AQUI. Metadata de layout e HERDADA: um canonical fixo no
  // topo colapsaria as 918 fichas numa URL so, que e a unica forma de esta
  // passada PERDER busca em vez de ganhar. Cada rota declara a sua.
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
  ...(temAnuncios() ? { other: { "google-adsense-account": ADSENSE_CLIENT } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={quantico.variable}>
      {/* flex-col + `main` que cresce: o rodape encosta no fim da JANELA quando a
          pagina e curta, em vez de subir e deixar uma faixa de fundo embaixo dele. */}
      <body className="flex min-h-dvh flex-col antialiased">
        {/* O script do AdSense so entra quando existe conta: sem id, a pagina nao
            carrega um kilobyte de terceiro nem abre conexao pra rede de anuncio.
            `afterInteractive` porque ele nao pode disputar a rede com o catalogo,
            que e o que a pessoa veio buscar. */}
        {temAnuncios() ? (
          <Script
            id="adsense"
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        ) : null}
        {/* Pular pro conteudo: quem navega por teclado nao deve atravessar o
            trilho de filtro inteiro pra chegar na lista. */}
        <a
          href="#conteudo"
          className="pix sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-200
                     focus:rounded-pix focus:border focus:border-accent focus:bg-surface-3
                     focus:px-3 focus:py-2 focus:text-[12px] focus:text-accent"
        >
          Pular para o conteúdo
        </a>
        <SiteNav />
        {/* ANTES do conteudo, e nao no fim do documento: a ordem do DOM e a ordem
            do Tab. Depois do rodape, chegar no X do balao exigia atravessar a
            pagina inteira — e ao chegar la o rodape entrava em cena e o balao
            sumia, entao ele era literalmente inalcancavel pelo teclado. Aqui ele
            fica a dois Tabs da navegacao, e quem so quer o conteudo tem o "pular
            para o conteudo" como primeiro elemento da pagina. */}
        <ApoioFlutuante />
        <main id="conteudo" className="mx-auto w-full max-w-[1600px] flex-1 px-3 pb-16 pt-4 sm:px-5">
          {children}
        </main>
        {/* A faixa antes do rodape: e o unico lugar FIXO do site. Nada de anuncio
            dentro de painel de ferramenta — ali o numero ao lado e resultado de
            calculo, e anuncio colado em dado e o jeito mais rapido de fazer a
            pessoa clicar sem querer (e de perder a conta por isso). */}
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-5">
          <Anuncio lugar="rodape" minH={100} rotulo />
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
