import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Quantico } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

/**
 * Duas fontes, dois papeis — e a divisao e o que salva a densidade.
 *
 * O rotulo e **Quantico**: quadrada e tecno, mas com formas de letra normais —
 * le em 10px sem esforco. Chegou depois de quatro reprovadas: Press Start 2P
 * (ilegivel), Silkscreen (some no corpo pequeno), Jersey 10 (condensada e
 * fina) e Orbitron (legivel, mas larga e fria demais). O padrao das bitmap era
 * sempre o mesmo — so funcionam com traco grosso E corpo grande, e ai a
 * densidade morre.
 *
 * Fica so em texto curto em caixa alta (`.pix`); o dado — nome, numero, stat —
 * vai no mono, que alinha coluna. Peso 700 no rotulo: o 400 afina em 10px.
 */
const display = Quantico({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display-src",
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
    <html lang="pt-BR" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* Pular pro conteudo: quem navega por teclado nao deve atravessar o
            trilho de filtro inteiro pra chegar na lista. */}
        <a
          href="#conteudo"
          className="pix sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-200
                     focus:rounded-pix focus:border focus:border-accent focus:bg-surface-3
                     focus:px-3 focus:py-2 focus:text-[11px] focus:text-accent"
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
