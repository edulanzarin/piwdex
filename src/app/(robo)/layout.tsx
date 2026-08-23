import type { Metadata } from "next";
import { RoboNav } from "@/components/robo/nav";
import { usuarioAtual } from "@/lib/robo/sessao";

/**
 * A moldura do ROBO — a metade logada, em `bot.piwdex.com.br`.
 *
 * Ela e o oposto da moldura da dex em tudo que importa:
 *
 * - **Sem anuncio.** Quem esta aqui paga assinatura. Anuncio numa area paga e
 *   cobrar duas vezes pela mesma pessoa.
 * - **`noindex`.** Nao ha nada aqui pra buscador achar, e a tela de login
 *   indexada so serviria pra confundir quem procura a dex.
 * - **Navegacao propria.** Os links da dex nao levam a lugar nenhum de dentro
 *   do painel, e o painel tem os seus.
 * - **Sem rodape.** O painel e uma tela de trabalho que ja rola muito; um rodape
 *   institucional no fim dela nao e lido por ninguem e ainda empurra o conteudo.
 *   O aviso de projeto de fa vive na dex, que e a parte publica.
 */
export const metadata: Metadata = {
  title: { default: "Robô · PIWdex", template: "%s · Robô PIWdex" },
  description: "Área logada do PIWdex: o robô que joga Poke Idle World por você.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LayoutRobo({ children }: { children: React.ReactNode }) {
  // A sessao e lida AQUI e desce como prop: a barra e componente de cliente e
  // nao pode ler cookie, e um `fetch` de sessao a partir dela piscaria a versao
  // deslogada em toda navegacao.
  const u = await usuarioAtual();
  return (
    <>
      <a
        href="#painel"
        className="pix sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-200
                   focus:rounded-pix focus:border focus:border-[var(--color-t-robo)] focus:bg-surface-3
                   focus:px-3 focus:py-2 focus:text-[12px] focus:text-[var(--color-t-robo)]"
      >
        Pular para o conteúdo
      </a>
      <RoboNav nome={u ? (u.nome ?? u.email) : undefined} />
      <main id="painel" className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-16 pt-4 sm:px-5">
        {children}
      </main>
    </>
  );
}
