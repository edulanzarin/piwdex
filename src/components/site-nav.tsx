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
 * Ela lista o MESMO registro que a home e os herois (`lib/ferramentas.ts`), e
 * traz duas coisas que antes ficavam so la dentro: o icone e a cor.
 *
 * O icone paga aluguel. Seis palavras curtas em caixa alta, na mesma fonte e no
 * mesmo tom, viram uma fileira de manchas indistinguiveis — a pessoa le todas
 * pra achar a que quer. Com a silhueta na frente, "livro / caixa / calculadora /
 * radar / ovo / espadas" se acha de relance, e a palavra vira confirmacao.
 *
 * A cor entra so no estado ATIVO, e e a cor da ferramenta, nao o acento do
 * tema: a barra de baixo acende laranja na Hunt e rosa no Breeding. E o mesmo
 * sinal que a faixa de topo da, repetido onde o olho ja estava.
 */
export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const item = (f: Ferramenta, onNav?: () => void) => {
    const on = path === f.href || path.startsWith(`${f.href}/`);
    const Icone = f.Icone;
    return (
      <Link
        key={f.href}
        href={f.href}
        onClick={onNav}
        aria-current={on ? "page" : undefined}
        className={cn(
          "pix group relative flex items-center gap-1.5 px-3 py-2 text-[12px] transition-colors",
          on ? "text-text" : "text-text-mute hover:text-text-dim",
        )}
      >
        <Icone
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          className={cn(
            "shrink-0 transition-transform duration-150 ease-out",
            // No hover o glifo cresce um degrau. E resposta imediata, antes de
            // qualquer mudanca de pagina — o link diz que ouviu o ponteiro.
            "group-hover:-translate-y-px group-hover:scale-110",
          )}
          // Ativo pinta na cor da ferramenta; parado, herda o tom do texto.
          style={on ? { color: f.cor } : undefined}
        />
        {f.nome}
        {/* A barra que cresce do centro, na cor da ferramenta. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-2 -bottom-px h-0.5 origin-center transition-transform duration-150 ease-out",
            on ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50",
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/92 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.04)]">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-1 px-3 sm:px-5">
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
          <span className="pix text-[15px] normal-case text-text">
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
