import type { Metadata, Viewport } from "next";
import { Oxanium } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * O layout RAIZ — e so o documento.
 *
 * Ele emagreceu quando o robo voltou: a moldura da dex (navegacao, anuncio,
 * rodape) desceu pro `(site)/layout.tsx`, porque o robo e servido pelo mesmo
 * codigo e nao pode herdar nenhuma das tres. O que sobra aqui e o que vale pros
 * DOIS: a lingua, a fonte, o tema escuro e o endereco base dos metadados.
 *
 * Os grupos `(site)` e `(robo)` nao aparecem em URL nenhuma — parenteses no nome
 * da pasta e organizacao, nao caminho. Nenhum endereco da dex mudou.
 */

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
const oxanium = Oxanium({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  // `metadataBase` e a base de TODA URL relativa que o Next escreve — og:image,
  // canonical, alternates. Sem ela o Next emite caminho relativo e nenhum
  // rastreador resolve; e o pre-requisito de tudo que as duas areas declaram.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PIWdex — dex e ferramentas de Poke Idle World",
    template: "%s · PIWdex",
  },
  applicationName: "PIWdex",
  // CANONICAL NAO ENTRA AQUI. Metadata de layout e HERDADA: um canonical fixo no
  // topo colapsaria as 918 fichas numa URL so, que e a unica forma de esta
  // passada PERDER busca em vez de ganhar. Cada rota declara a sua.
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={oxanium.variable}>
      {/* flex-col + filho que cresce: o rodape encosta no fim da JANELA quando a
          pagina e curta, em vez de subir e deixar uma faixa de fundo embaixo dele. */}
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
