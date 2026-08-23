import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ApoioFlutuante } from "@/components/apoio";
import { Anuncio } from "@/components/anuncio";
import { JsonLd, siteDoJogo } from "@/lib/jsonld";
import { ADSENSE_CLIENT, temAnuncios } from "@/lib/ads";

/**
 * A moldura da DEX: navegacao, rodape, anuncio e o balao de apoio.
 *
 * Ela morava no layout raiz, e saiu de la quando o robo voltou. O layout raiz e
 * herdado por tudo que o processo serve, e o robo nao pode herdar nada disto: e
 * area paga (anuncio ali seria cobrar duas vezes pela mesma pessoa) e a
 * navegacao da dex nao leva a lugar nenhum de dentro do painel.
 *
 * E componente, e nao so o corpo do `(site)/layout.tsx`, porque o `not-found.tsx`
 * precisa da mesma moldura e vive FORA do grupo — 404 tem que pegar endereco que
 * nao casa com rota nenhuma, e um not-found dentro do grupo so pegaria os
 * endereços do grupo.
 */
export function CascaSite({ children }: { children: React.ReactNode }) {
  return (
    <>
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
      {/* Quem e este site, uma vez so pro site inteiro. Vai no corpo e nao no
          `generateMetadata`: a Metadata API do Next nao emite `<script>`, e
          tentar por la falha calado. */}
      <JsonLd dado={siteDoJogo()} />
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
    </>
  );
}
