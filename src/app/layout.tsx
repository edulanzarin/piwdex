import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Silkscreen } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

/**
 * Duas fontes, dois papeis — e a divisao e o que salva a densidade.
 *
 * A pixel (Silkscreen) fica so em ROTULO curto em caixa alta. Foi a licao da
 * versao anterior: Press Start 2P em texto corrido come o dobro da largura e
 * derruba pela metade o que cabe na tela. O dado — nome, numero, stat — vai no
 * mono, que alinha coluna e se le em 11px.
 */
const pixel = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "piwdex — dex e ferramentas de Poke Idle World",
    template: "%s · piwdex",
  },
  description:
    "Pokedex completa do Poke Idle World: filtro por tipo, raridade, fraqueza, " +
    "drop e faixa de nivel, com stats, golpes, locais de caca e indice reverso de itens.",
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* Pular pro conteudo: quem navega por teclado nao deve atravessar o
            trilho de filtro inteiro pra chegar na lista. */}
        <a
          href="#conteudo"
          className="pix sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-200
                     focus:rounded-pix focus:border focus:border-accent focus:bg-surface-3
                     focus:px-3 focus:py-2 focus:text-[10px] focus:text-accent"
        >
          Pular para o conteudo
        </a>
        <SiteNav />
        <main id="conteudo" className="mx-auto w-full max-w-[1600px] px-3 pb-16 pt-4 sm:px-5">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
