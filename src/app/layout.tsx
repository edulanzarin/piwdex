import type { Metadata, Viewport } from "next";
import { Quantico } from "next/font/google";
import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ApoioFlutuante } from "@/components/apoio";
import { ADSENSE_CLIENT, temAnuncios } from "@/lib/ads";
import { Anuncio } from "@/components/anuncio";
import "./globals.css";

/**
 * Uma fonte so: **Quantico**, nos pesos 400 e 700.
 *
 * Chegou depois de quatro reprovadas — Press Start 2P (ilegivel), Silkscreen
 * (some no corpo pequeno), Jersey 10 (condensada e fina) e Orbitron (legivel,
 * mas larga e fria). O padrao das bitmap era sempre o mesmo: so funcionam com
 * traco grosso E corpo grande, e nessa combinacao a densidade morre. A Quantico
 * e quadrada e tecno com formas de letra normais, entao aguenta o site inteiro.
 *
 * Ela NAO tem numeral tabular (o "1" e ~15% mais estreito que o "0"), entao
 * coluna de numero se resolve por ALINHAMENTO A DIREITA, nunca contando com o
 * `tabular-nums` — que aqui nao tem efeito nenhum.
 */
const quantico = Quantico({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});


export const metadata: Metadata = {
  title: {
    default: "piwdex — dex e ferramentas de Poke Idle World",
    template: "%s · piwdex",
  },
  description:
    "Pokédex completa do Poke Idle World: filtro por tipo, raridade, fraqueza, " +
    "drop e faixa de nível, com stats, golpes, locais de caça e índice reverso de itens.",
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
