"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pokeball } from "./pokeball";
import { NavAccount, NavLogout } from "./nav-icons";
import { PokedexIcon } from "./pokedex-icon";
import { ItemsIcon, HuntIcon, CalcIcon, LabIcon, BreedIcon } from "./tool-icons";
import { Star } from "./icons";
import { useT } from "./locale-provider";
import { LangSwitcher } from "./lang-switcher";
import { logout } from "@/lib/actions/auth";

export interface NavUser {
  name: string | null;
  image: string | null;
  vip: boolean;
  admin?: boolean;
}

// MESMA ordem e MESMOS icones dos cards da home (pedido do Eduardo): quem decorou a
// home reconhece a ferramenta no topo sem reler o rotulo. Mexeu aqui, mexa em
// src/app/page.tsx — e vice-versa.
const TABS: { key: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
  { key: "nav.dex", href: "/dex", Icon: PokedexIcon },
  { key: "nav.items", href: "/items", Icon: ItemsIcon },
  { key: "nav.hunt", href: "/hunt", Icon: HuntIcon },
  { key: "nav.calc", href: "/calc", Icon: CalcIcon },
  { key: "nav.eevee", href: "/eevee", Icon: LabIcon },
  { key: "nav.breed", href: "/breed", Icon: BreedIcon },
  // Conta saiu do topo: virou aba do /vip (depende da sessao de jogo, que e VIP).
  // Entra pelo botao VIP.
];

// Botao-icone do header (mesmo grid 40x40 da nav) + tooltip no hover. VIP, Entrar e
// Sair usam o mesmo chrome que os icones de navegacao, so mudando a cor.
const ICON_BTN = "group relative flex h-10 w-10 items-center justify-center rounded transition hover:bg-surface-2";
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-[color:var(--surface-solid)] px-2 py-1 text-xs uppercase tracking-wide text-text-dim opacity-0 transition group-hover:opacity-100">
      {children}
    </span>
  );
}

export function SiteNav({ user }: { user: NavUser | null }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const VipChip = () =>
    user?.vip ? (
      <span className="chip" style={{ background: "var(--yellow)", color: "#3a2c00" }}>VIP</span>
    ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[rgba(7,11,22,0.72)] backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Pokeball size={28} />
          <div className="leading-tight">
            <div className="pixel text-base text-text">PIWdex</div>
            <div className="hidden text-sm text-text-dim sm:block">Poke Idle World</div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botao VIP na nav sticky (aparece na entrada, segue o scroll, desktop+mobile).
              Nao-VIP: convite dourado pulsante -> paywall. VIP: entrada da area (cockpit),
              sem pulso. Sempre visivel: pra o VIP e o caminho pro cockpit. */}
          {user?.admin && (
            <Link
              href="/admin"
              title="Painel admin"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[#e5484d] bg-[#e5484d]/12 px-2.5 pixel text-base text-[#ff6b6b] transition hover:bg-[#e5484d]/22"
            >
              ADM
            </Link>
          )}
          <Link
            href="/vip"
            title={user?.vip ? t("vip.eyebrow") : t("vipcta.btn")}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--yellow)] px-2.5 pixel text-base text-yellow transition ${user?.vip ? "bg-[color:var(--yellow)]/20 hover:bg-[color:var(--yellow)]/30" : "glow-pulse bg-[color:var(--yellow)]/12 hover:bg-[color:var(--yellow)]/22"}`}
            style={{ "--accent": "var(--yellow)" } as React.CSSProperties}
          >
            <Star size={16} /> VIP
          </Link>
          {/* Desktop: icones com tooltip */}
          <nav className="hidden items-center gap-1 sm:flex">
            {TABS.map(({ key, href, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={t(key)}
                  aria-label={t(key)}
                  className={`${ICON_BTN} ${active ? "bg-surface-2 text-cyan ring-1 ring-[color:var(--border-strong)]" : "text-text-dim hover:text-text"}`}
                >
                  <Icon size={22} />
                  <Tip>{t(key)}</Tip>
                </Link>
              );
            })}
          </nav>
          <span className="hidden h-6 w-px bg-border sm:block" />

          {/* conta / login-logout (desktop) — so o icone de conta; sem VIP no topo */}
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                {/* nome do usuario: slot maior porque a Chakra e bem mais larga que a
                    fonte condensada antiga — 8rem cortava nome medio */}
                <span className="max-w-[11rem] truncate pixel text-base text-text">{user.name ?? "conta"}</span>
                <Link
                  href="/conta"
                  title={t("nav.account")}
                  aria-label={t("nav.account")}
                  className={`${ICON_BTN} text-text-dim hover:text-cyan`}
                >
                  <NavAccount size={22} />
                  <Tip>{t("nav.account")}</Tip>
                </Link>
                <form action={logout} className="flex">
                  <button
                    type="submit"
                    title={t("auth.logout")}
                    aria-label={t("auth.logout")}
                    className={`${ICON_BTN} text-text-dim hover:text-red`}
                  >
                    <NavLogout size={22} />
                    <Tip>{t("auth.logout")}</Tip>
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/entrar"
                title={t("nav.account")}
                aria-label={t("nav.account")}
                className={`${ICON_BTN} text-text-dim hover:text-cyan`}
              >
                <NavAccount size={22} />
                <Tip>{t("nav.account")}</Tip>
              </Link>
            )}
          </div>

          <LangSwitcher />
          <button
            type="button"
            className="flex flex-col gap-[3px] p-2 sm:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="menu"
            aria-expanded={open}
          >
            <span className={`h-0.5 w-5 bg-text transition ${open ? "translate-y-[5px] rotate-45" : ""}`} />
            <span className={`h-0.5 w-5 bg-text transition ${open ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-5 bg-text transition ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* menu mobile: overlay ABSOLUTO sob o header — abre por cima do conteudo,
          nunca empurra a pagina pra baixo */}
      {open && (
        <nav className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-[rgba(7,11,22,0.88)] shadow-[0_24px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150 sm:hidden">
          <div className="container-page flex flex-col py-1">
            {TABS.map(({ key, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 border-b border-border/40 py-3 pixel text-base last:border-0 hover:text-cyan ${isActive(href) ? "text-cyan" : "text-text-dim"}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                {t(key)}
              </Link>
            ))}

            {user?.admin && (
              <Link
                href="/admin"
                className="flex items-center gap-3 border-b border-border/40 py-3 pixel text-base text-[#ff6b6b] hover:text-[#ff8a8a]"
                onClick={() => setOpen(false)}
              >
                <Star size={20} /> Painel admin
              </Link>
            )}

            {/* conta / login-logout (mobile) — sem VIP no topo */}
            {user ? (
              <>
                <Link
                  href="/conta"
                  className="flex items-center gap-3 border-b border-border/40 py-3 pixel text-base text-text-dim hover:text-cyan"
                  onClick={() => setOpen(false)}
                >
                  <NavAccount size={20} />
                  <span className="flex items-center gap-2">{user.name ?? t("nav.account")} <VipChip /></span>
                </Link>
                <form action={logout}>
                  <button type="submit" className="flex w-full items-center gap-3 py-3 pixel text-base text-text-dim hover:text-red" onClick={() => setOpen(false)}>
                    <NavLogout size={20} /> {t("auth.logout")}
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/entrar"
                className="flex items-center gap-3 py-3 pixel text-base text-cyan"
                onClick={() => setOpen(false)}
              >
                <NavAccount size={20} /> {t("nav.account")}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
