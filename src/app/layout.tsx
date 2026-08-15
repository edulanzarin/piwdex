import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "piwdex", template: "%s · piwdex" },
  description:
    "Dex e ferramentas completas para Poke Idle World: stats, drops com chance real, onde farmar cada item, localizacoes e evolucoes.",
};

function Nav() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-10">
      <div className="container-page flex h-14 items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span
            className="inline-block h-5 w-5 rounded-full"
            style={{ background: "var(--accent)" }}
            aria-hidden
          />
          piwdex
        </Link>
        <nav className="flex items-center gap-4 text-sm text-text-dim">
          <Link href="/dex" className="hover:text-text">Pokedex</Link>
          <Link href="/items" className="hover:text-text">Itens</Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <Nav />
        <main className="container-page py-8">{children}</main>
        <footer className="container-page py-10 text-xs text-text-dim">
          Dados extraidos da fonte publica de Poke Idle World. Projeto nao oficial.
        </footer>
      </body>
    </html>
  );
}
