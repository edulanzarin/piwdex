import type { Metadata } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Link from "next/link";
import { Pokeball } from "@/components/pokeball";
import { LocaleProvider, T } from "@/components/locale-provider";
import { LangSwitcher } from "@/components/lang-switcher";
import "./globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "piwdex — ferramentas Poke Idle World", template: "%s · piwdex" },
  description:
    "Dex e ferramentas completas para Poke Idle World: stats, drops com chance real, onde farmar cada item, localizacoes e evolucoes.",
};

const TABS: [string, string][] = [
  ["nav.dex", "/dex"],
  ["nav.items", "/items"],
  ["nav.hunt", "/hunt"],
  ["nav.calc", "/calc"],
];

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[rgba(7,11,22,0.72)] backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Pokeball size={30} />
          <div className="leading-tight">
            <div className="pixel text-[0.8rem] text-text">piwdex</div>
            <div className="text-[0.62rem] text-text-dim">Poke Idle World</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            {TABS.map(([key, href]) => (
              <Link key={href} href={href} className="tab">
                <T k={key} />
              </Link>
            ))}
          </nav>
          <span className="h-5 w-px bg-border" />
          <LangSwitcher />
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <LocaleProvider>
          <Nav />
          <main className="container-page py-10">{children}</main>
          <footer className="border-t border-border">
            <div className="container-page py-8 text-[0.68rem] text-text-dim">
              <T k="footer" />
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
