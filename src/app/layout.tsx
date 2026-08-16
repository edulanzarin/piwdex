import type { Metadata } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { LocaleProvider, T } from "@/components/locale-provider";
import { SiteNav } from "@/components/site-nav";
import { auth } from "@/lib/auth";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name ?? null, image: session.user.image ?? null, vip: session.user.vip }
    : null;
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <LocaleProvider>
          <SiteNav user={user} />
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
