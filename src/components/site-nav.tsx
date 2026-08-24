"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { IconClose, IconRows, Pokeball } from "@/components/ui";
import { FERRAMENTAS, type Ferramenta } from "@/lib/ferramentas";

/**
 * Barra de navegacao. Fixa no topo porque a dex e uma tela de rolagem longa e
 * voltar pro topo pra trocar de ferramenta e atrito puro.
 *
 * Ela lista o MESMO registro que a home e os herois (`lib/ferramentas.ts`), e o
 * que ela pega de la e a COR — nao o glifo.
 *
 * ## Por que aqui nao entra icone
 *
 * Entrou, e saiu. O argumento pro glifo de traco era que seis palavras curtas em
 * caixa alta viram uma fileira de manchas iguais; olhando a barra pronta, isso
 * nao se sustenta: POKEDEX, ITENS, CALCULADORA, HUNT, BREEDING e META tem
 * comprimentos bem diferentes, e o comprimento ja e a silhueta. O glifo estava
 * resolvendo um problema que a tipografia resolvia sozinha, e num chrome de 56px
 * de altura cada elemento a mais custa densidade.
 *
 * A alternativa era usar a ARTE das ferramentas, que e o que o site tem de
 * proprio. Ela nao cabe: e uma grade de 32x32, e a nav pede 14 a 20px — nao ha
 * como desenhar 32 pixels em 20, e o teste (a 3x de zoom, ja) devolveu seis
 * manchas coloridas que nao se distinguem. E a fronteira de
 * [[Arte de icone se julga no tamanho de uso, e o acento e a massa]]: arte de
 * figura vive de 24px pra cima, o chrome miudo e do traco — ou de nada. De
 * quebra, o `pokedex.png` tem 571 KB e passaria a carregar em TODA pagina.
 *
 * O que sobrou e o que de fato informa: a COR da ferramenta no estado ativo. A
 * barra de baixo acende laranja na Hunt e rosa no Breeding, que e o mesmo sinal
 * da faixa de topo repetido onde o olho ja estava — sem custar um pixel de
 * largura.
 */
export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const item = (f: Ferramenta, onNav?: () => void) => {
    const on = path === f.href || path.startsWith(`${f.href}/`);
    return (
      <Link
        key={f.href}
        href={f.href}
        onClick={onNav}
        aria-current={on ? "page" : undefined}
        className={cn(
          // Subiu de 12 pra 13px e de px-3 pra px-4. Numa barra que agora abre
          // pra uma pagina de CENA, item miudo e apertado le como menu de
          // sistema — e o menu e a primeira coisa que a pessoa ve, entao ele
          // define a expectativa do resto antes de qualquer conteudo aparecer.
          "pix group relative flex items-center px-4 py-2 text-[13px] transition-colors",
          on ? "text-text" : "text-text-mute hover:text-text-dim",
        )}
      >
        {/* A palavra tambem acende na cor quando ativa: a barra sozinha e um
            sinal de 2px, e num trilho de seis ela pede que o olho procure. */}
        <span style={on ? { color: f.cor } : undefined}>{f.nome}</span>
        {/* A barra que cresce do centro, na cor da ferramenta. */}
        <span
          aria-hidden="true"
          className={cn(
            // A faixa corre o item INTEIRO (`inset-x-0`) e engrossou pra 3px. A
            // versao anterior recuava 8px de cada lado e ficava com 2px: num
            // trilho de seis, um tracinho curto e fino no meio de palavras
            // parecidas obriga o olho a procurar qual esta aceso.
            "absolute inset-x-0 bottom-0 h-[3px] origin-center transition-transform duration-150 ease-out",
            on ? "scale-x-100" : "scale-x-0 group-hover:scale-x-60",
          )}
          style={{
            backgroundColor: f.cor,
            boxShadow: on ? `0 0 10px 0 ${f.cor}` : undefined,
          }}
        />
      </Link>
    );
  };

  return (
    /* A barra ficou mais ALTA (56 -> 64) e mais OPACA (92% -> 97%).
       As duas mudam pela mesma razao, e ela e a pagina nova: com faixas de cena
       sangrando ate a borda e arte grande passando por baixo, uma barra baixa e
       translucida deixava o topo da tela virar sopa — a arte da secao seguinte
       aparecia atras do menu e as duas competiam. Barra que flutua sobre cena
       precisa ser superficie, nao vidro. */
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/97 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.04)]">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="group mr-3 flex shrink-0 items-center gap-2">
          {/* A bola e VERMELHA — ela e uma pokebola, e essa e a unica cor de marca
              que sobrou depois que o roxo saiu do tema. Ela BALANCA no hover: a
              marca e o unico lugar do topo onde cabe uma piscadela. */}
          <Pokeball
            size={26}
            className="text-[var(--color-t-dex)] transition-transform duration-150 group-hover:rotate-12"
          />
          {/* `normal-case`: a marca e PIWdex — PIW em caixa alta (as iniciais do
              jogo) e "dex" em caixa baixa. O `.pix` poe caixa alta em tudo, entao
              aqui ele e desligado e a palavra vai literal. */}
          <span className="pix text-[17px] normal-case tracking-normal text-text">
            PIW<span className="text-accent">dex</span>
          </span>
        </Link>

        <nav className="hidden items-center md:flex">{FERRAMENTAS.map((f) => item(f))}</nav>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          className="ml-auto rounded-pix border border-line p-1.5 text-text-dim transition-colors hover:text-text md:hidden"
        >
          {open ? <IconClose size={16} /> : <IconRows size={16} />}
        </button>
      </div>

      {open ? (
        <nav className="anim-rise flex flex-col border-t border-white/10 bg-surface/95 px-3 py-1 backdrop-blur-xl md:hidden">
          {FERRAMENTAS.map((f) => item(f, () => setOpen(false)))}
        </nav>
      ) : null}
    </header>
  );
}
