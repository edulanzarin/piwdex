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
 * Fica so a linha de aviso junto: o piwdex le o catalogo publico do Poke Idle
 * World e parece oficial de longe — e essa linha e o que impede alguem cobrar dos
 * autores do jogo uma conta que e minha. Ela cabe numa linha e nao disputa nada.
 */
export function SiteFooter() {
  return (
    // O id nao e enfeite: o balao de apoio observa este elemento pra sumir quando
    // o rodape aparece — os dois pedem a mesma coisa e nao podem se sobrepor.
    <footer id="rodape" className="mt-10 border-t border-line bg-bg-soft/60">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-6 sm:px-5">
        <FaixaApoio />
        {/* Italico porque e a VOZ da ferramenta falando de si mesma, e nao mais um
            dado da tela — a mesma regra da primitiva `Note`. */}
        <p className="text-[12px] italic leading-relaxed text-text-dim">
          Projeto de fã, sem vínculo com os autores do Poke Idle World. Os dados vêm do
          catálogo público do jogo e todo acesso é de leitura.
        </p>
      </div>
    </footer>
  );
}
