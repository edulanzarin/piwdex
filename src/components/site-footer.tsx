/**
 * Rodape. Diz de onde o dado vem — uma dex que nao declara a fonte nao da pra
 * conferir, e conferir e metade do valor da ferramenta.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-soft/60">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-1 px-3 py-6 text-[11px] text-text-mute sm:px-5">
        <p>
          <span className="pix text-[9px] text-text-dim">piwdex</span> — dex e ferramentas
          para Poke Idle World.
        </p>
        <p>
          Dado lido direto do catalogo publico do jogo (creatures, items e map-markers).
          Projeto de fa, sem vinculo com os autores do jogo.
        </p>
      </div>
    </footer>
  );
}
