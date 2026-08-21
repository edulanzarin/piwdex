/**
 * Rodape. Diz de onde o dado vem — uma dex que nao declara a fonte nao da pra
 * conferir, e conferir e metade do valor da ferramenta.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-white/10 bg-bg/40 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-1 px-3 py-6 text-[13px] text-text-mute sm:px-5">
        <p>
          <span className="pix text-[11px] text-text-dim">piwdex</span> — dex e ferramentas
          para Poke Idle World.
        </p>
        <p>
          Dado lido direto do catálogo público do jogo (creatures, items e map-markers).
          Projeto de fã, sem vínculo com os autores do jogo.
        </p>
      </div>
    </footer>
  );
}
