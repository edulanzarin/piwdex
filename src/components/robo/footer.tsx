import { SITE_URL } from "@/lib/site";

/**
 * O rodape do robo: o minimo legal, e nada mais.
 *
 * Sem faixa de apoio (quem esta aqui ja paga) e sem menu repetido. A privacidade
 * fica no site — e o mesmo documento, e mante-lo em dois lugares e a forma
 * conhecida de manter duas versoes diferentes dele.
 */
export function RoboFooter() {
  return (
    <footer className="mt-10 border-t border-line bg-bg-soft/95">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-5 text-[11px] text-text-mute sm:px-5">
        <span className="pix">PIWdex · robô</span>
        <a href={`${SITE_URL}/privacidade`} className="tap pix transition-colors hover:text-accent">
          Privacidade
        </a>
        <span className="ml-auto">Projeto de fã. Sem vínculo com os autores do Poke Idle World.</span>
      </div>
    </footer>
  );
}
