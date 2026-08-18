import type { Metadata } from "next";
import { JetBrains_Mono, Silkscreen } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteNav } from "@/components/site-nav";
import { VipCta } from "@/components/vip-cta";
import { auth } from "@/lib/auth";
import "./globals.css";

// Fonte pixel: Silkscreen no lugar da Press Start 2P — continua quadrada/pixelada, mas
// com x-height generoso e formas abertas: legivel nos tamanhos pequenos dos titulos.
const pixel = Silkscreen({
  weight: ["400", "700"],
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
  // Titulo fixo em toda aba (sem prefixo da pagina): template sem %s ignora o titulo do
  // segmento filho e usa este texto literal em todas as rotas.
  title: {
    default: "PIWdex - A dex completa do Poke Idle World",
    template: "PIWdex - A dex completa do Poke Idle World",
  },
  description:
    "Dex e ferramentas completas para Poke Idle World: stats, drops com chance real, onde farmar cada item, localizacoes e evolucoes.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name ?? null, image: session.user.image ?? null, vip: session.user.vip, admin: session.user.admin }
    : null;
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <LocaleProvider>
          <SiteNav user={user} />
          <main className="container-page py-10">{children}</main>
          <VipCta vip={user?.vip ?? false} />
        </LocaleProvider>
      </body>
    </html>
  );
}
