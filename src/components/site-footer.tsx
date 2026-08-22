import Link from "next/link";
import { FaixaApoio } from "@/components/apoio";

/**
 * O rodape do site: a faixa de apoio, e mais nada.
 *
 * Ele ja teve identidade, menu de ferramentas e blocos — e o Eduardo cortou, com
 * razao: o menu ja esta fixo no topo em toda pagina, e repetir link no rodape so
 * enche o fim da tela de coisa que ninguem clica. Rodape que faz duas coisas nao
 * faz nenhuma; este faz UMA.
 *
 * A largura tambem e menor que a do conteudo de proposito. O `main` vai ate
 * 1600px porque tabela de 342 hunts precisa; um recado de duas linhas esticado
 * nessa largura vira uma faixa de texto solto com um botao no fim do horizonte.
 *
 * Sem linha de aviso: o "projeto de fa, sem vinculo" saiu por decisao do Eduardo.
 * Ele continua escrito no README do repositorio.
 */
export function SiteFooter() {
  return (
    // O id nao e enfeite: o balao de apoio observa este elemento pra sumir quando
    // o rodape aparece — os dois pedem a mesma coisa e nao podem se sobrepor.
    <footer id="rodape" className="mt-10 border-t border-line bg-bg-soft/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-3 py-6 sm:px-5">
        <FaixaApoio />
        {/* A privacidade tem que ser alcancavel de qualquer pagina — e exigencia
            de quem serve anuncio, e antes disso e o minimo pra quem le. */}
        <Link
          href="/privacidade"
          className="pix self-start text-[11px] text-text-mute transition-colors hover:text-accent"
        >
          Privacidade
        </Link>
      </div>
    </footer>
  );
}
