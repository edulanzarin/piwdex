import type { Metadata } from "next";
import Link from "next/link";
import { temAnuncios } from "@/lib/ads";
import { Panel } from "@/components/ui";

export const metadata: Metadata = {
  alternates: { canonical: "/privacidade" },
  title: "Privacidade",
  description:
    "O que o PIWdex guarda (quase nada), o que fica só no seu navegador e o que " +
    "terceiros usam quando há anúncio na página.",
};

/**
 * A politica de privacidade.
 *
 * Ela existe por duas razoes, nessa ordem: e verdade util pra quem usa — este
 * site guarda quase nada e vale dizer isso em voz alta — e e **exigencia** pra
 * quem quer servir anuncio do Google. A ausencia dela e uma das reprovacoes mais
 * comuns na revisao do AdSense.
 *
 * O texto e escrito na primeira pessoa e sem juridiques de modelo pronto: pagina
 * de privacidade copiada da internet costuma prometer coisa que o site nao faz
 * (formularios, cadastro, newsletter), e prometer errado e pior que nao prometer.
 */
export default function PrivacidadePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="pix text-[22px] text-text">Privacidade</h1>

      <Panel>
        <div className="flex flex-col gap-5 text-[14px] leading-relaxed text-text-dim">
          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">O que eu guardo sobre você</h2>
            <p>
              Nada. O PIWdex não tem cadastro, não tem login e não pede e-mail. Nenhuma
              conta do jogo é conectada aqui, e nenhum dado seu do Poke Idle World passa
              por este site.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">O que fica no seu navegador</h2>
            <p>
              As ferramentas guardam coisas <span className="text-text">na sua máquina</span>,
              e só lá: a estante de pokémon do breeding, a preferência de itens por página e
              a marca de que você fechou o aviso de apoio. Isso mora no armazenamento local
              do navegador, nunca é enviado pra mim, e limpar os dados do site apaga tudo.
            </p>
            <p>
              O que você digita nas calculadoras vai pra <span className="text-text">URL</span>{" "}
              — é o que faz um resultado virar link compartilhável. Quem tiver o link vê os
              números que estavam nele; nada além disso é registrado.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">De onde vêm os dados do jogo</h2>
            <p>
              Do catálogo público do próprio Poke Idle World, lido pelo servidor deste site.
              O acesso é só de leitura e acontece do lado do servidor: o seu navegador não
              fala com o jogo por minha causa.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">Anúncios</h2>
            {temAnuncios() ? (
              <>
                <p>
                  Este site exibe anúncios do Google. O Google e seus parceiros usam cookies
                  para exibir anúncios com base em visitas anteriores suas a este e a outros
                  sites. Você pode desativar a publicidade personalizada nas{" "}
                  <a
                    href="https://www.google.com/settings/ads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-4"
                  >
                    Configurações de anúncios do Google
                  </a>
                  , ou desativar o uso de cookies por outros fornecedores em{" "}
                  <a
                    href="https://www.aboutads.info/choices/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-4"
                  >
                    aboutads.info
                  </a>
                  .
                </p>
                <p>
                  Eu não recebo nada além do relatório agregado do próprio Google: quanto foi
                  exibido e quanto rendeu. Não vejo quem você é.
                </p>
              </>
            ) : (
              <p>
                Hoje o site não exibe anúncio nenhum. Se isso mudar, esta página passa a
                descrever exatamente o que o serviço de anúncios usa — antes de o primeiro
                anúncio aparecer, não depois.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">Apoio</h2>
            <p>
              O botão de apoio abre o jogo por um link que carrega o meu código de indicação.
              Quem passa por ele e compra diamante faz o jogo me creditar a indicação; o
              preço é o mesmo e eu não recebo nenhum dado da sua compra.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="pix text-[12px] text-text">Contato</h2>
            <p>
              Dúvida, correção ou pedido de remoção de conteúdo: fale comigo pelo repositório
              do projeto ou pelo canal onde você me encontrou. Esta página muda junto com o
              site — quando algo aqui deixar de ser verdade, é aqui que muda primeiro.
            </p>
          </section>
        </div>
      </Panel>

      <Link href="/" className="tap pix text-[11px] text-text-mute transition-colors hover:text-accent">
        voltar para a home
      </Link>
    </div>
  );
}
