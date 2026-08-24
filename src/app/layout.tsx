import type { Metadata, Viewport } from "next";
import { Lexend_Deca, JetBrains_Mono, Archivo } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * O layout RAIZ — e so o documento.
 *
 * Ele emagreceu quando o robo voltou: a moldura da dex (navegacao, anuncio,
 * rodape) desceu pro `(site)/layout.tsx`, porque o robo e servido pelo mesmo
 * codigo e nao pode herdar nenhuma das tres. O que sobra aqui e o que vale pros
 * DOIS: a lingua, as fontes, o tema escuro e o endereco base dos metadados.
 *
 * Os grupos `(site)` e `(robo)` nao aparecem em URL nenhuma — parenteses no nome
 * da pasta e organizacao, nao caminho. Nenhum endereco da dex mudou.
 */

/**
 * DUAS familias, e a segunda existe por causa de um numero.
 *
 * ## O texto: Lexend Deca
 *
 * Ela sucede a Oxanium, que sucedeu a Quantico, que sucedeu quatro bitmap
 * reprovadas. A mudanca acompanha a virada pro console macio: a Oxanium e
 * quadrada e tecnica, desenhada pra combinar com canto reto — com o raio novo
 * ela passou a brigar com a propria geometria da tela.
 *
 * A Lexend nao e escolha de gosto sozinha: a familia foi desenhada pra
 * legibilidade em leitura longa, com contraforma aberta e largura generosa. Num
 * site que e paragrafo curto ao lado de tabela densa, ela sustenta os dois.
 *
 * ## O numero: JetBrains Mono, e por que a troca EXIGIU isso
 *
 * A Oxanium tinha uma propriedade rara e medida no proprio site: **digito de
 * largura fixa**. "1111" e "0000" davam a MESMA largura (0% de diferenca), contra
 * 30-44% de Chakra Petch, Bai Jamjuree, Saira e Rubik. Num site que e coluna de
 * numero de ponta a ponta — XP/h, ouro/h, stats, tier — digito de largura
 * variavel desalinha a coluna inteira a cada "1".
 *
 * A Lexend Deca NAO tem essa propriedade, e trocar sem mais nada teria devolvido
 * exatamente o defeito que a escolha da Oxanium existia pra evitar. A saida nao e
 * abrir mao da fonte nova: e parar de pedir duas coisas incompativeis a uma
 * familia so. Texto quer largura proporcional (e o que se le); numero em coluna
 * quer largura fixa (e o que se compara).
 *
 * Mono resolve por CONSTRUCAO — num monoespacado todo glifo tem a mesma largura,
 * entao o alinhamento nao depende da fonte publicar a feature `tnum`. E mais
 * garantido do que a Oxanium era, porque la a propriedade era um acidente feliz
 * do desenho, e aqui e a definicao da classe.
 *
 * O `.tabular` no `globals.css` e onde a troca acontece; toda celula de numero ja
 * passa por ele.
 */
const lexend = Lexend_Deca({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
});

/**
 * ## O titulo: Archivo, e por que uma TERCEIRA familia
 *
 * Acrescentar familia e caro e quase sempre errado. Aqui ela paga por uma razao
 * so, e e mecanica: **a Lexend Deca nao tem italico**. Nenhum corte dela publica
 * um, entao pedir `font-style: italic` faz o navegador SINTETIZAR — ele inclina a
 * letra reta por transformacao geometrica. Em corpo de 14px ninguem nota; num
 * titulo de 84px a haste sai torta, o contraste entre grossura vai pro lugar
 * errado e a curva do "S" quebra. O italico e a assinatura do titulo display
 * desta passada, entao ou ele e de verdade, ou nao existe.
 *
 * A Archivo tem italico desenhado, peso ate 900, e e uma grotesca de mesma
 * familia visual da Lexend — as duas convivem sem parecer que a pagina trocou de
 * assunto no meio.
 *
 * Ela entra SO no display. Titulo de secao, corpo e rotulo continuam na Lexend.
 */
const display = Archivo({
  weight: ["700", "800", "900"],
  style: ["italic", "normal"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
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
  themeColor: "#0c0e14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${lexend.variable} ${display.variable} ${mono.variable}`}>
      {/* flex-col + filho que cresce: o rodape encosta no fim da JANELA quando a
          pagina e curta, em vez de subir e deixar uma faixa de fundo embaixo dele. */}
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
