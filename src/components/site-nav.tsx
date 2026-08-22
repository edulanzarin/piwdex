"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { IconClose, IconRows, Pokeball } from "@/components/ui";

/**
 * Barra de navegacao. Fixa no topo porque a dex e uma tela de rolagem longa e
 * voltar pro topo pra trocar de ferramenta e atrito puro.
 *
 * A ferramenta ATIVA e marcada por barra de acento embaixo, nao so por cor —
 * mesma regra das abas.
 */
const LINKS = [
  { href: "/dex", label: "Pokedex" },
  { href: "/itens", label: "Itens" },
  { href: "/calc", label: "Calculadora" },
  { href: "/hunt", label: "Hunt" },
  { href: "/breed", label: "Breeding" },
  { href: "/meta", label: "Meta", soon: true },
];

export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const item = (l: (typeof LINKS)[number], onNav?: () => void) => {
    const on = path === l.href || path.startsWith(`${l.href}/`);
    const cls = cn(
      "pix relative flex items-center gap-1.5 px-3 py-2 text-[12px] transition-colors",
      on ? "text-accent" : "text-text-mute hover:text-text-dim",
      l.soon && "cursor-not-allowed opacity-45 hover:text-text-mute",
    );
    const inner = (
      <>
        {l.label}
        {l.soon ? <span className="text-[11px] text-text-mute">em breve</span> : null}
        <span
          className={cn(
            "absolute inset-x-2 -bottom-px h-0.5 transition-colors",
            on ? "bg-accent shadow-[0_0_10px_0_var(--color-accent)]" : "bg-transparent",
          )}
        />
      </>
    );
    if (l.soon) return <span key={l.href} className={cls} aria-disabled="true">{inner}</span>;
    return (
      <Link key={l.href} href={l.href} onClick={onNav} className={cls}>
        {inner}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg/45 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_-1px_0_0_rgb(255_255_255/0.04)]">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-1 px-3 sm:px-5">
        <Link href="/" className="mr-3 flex shrink-0 items-center gap-2">
          {/* A bola e VERMELHA — ela e uma pokebola, e essa e a unica cor de marca
              que sobrou depois que o roxo saiu do tema. */}
          <Pokeball size={26} className="text-[var(--color-t-dex)]" />
          <span className="pix text-[15px] text-text">
            piw<span className="text-accent">dex</span>
          </span>
        </Link>

        <nav className="hidden items-center md:flex">{LINKS.map((l) => item(l))}</nav>

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
        <nav className="anim-rise flex flex-col border-t border-white/10 bg-surface/90 px-3 py-1 backdrop-blur-2xl md:hidden">
          {LINKS.map((l) => item(l, () => setOpen(false)))}
        </nav>
      ) : null}
    </header>
  );
}
