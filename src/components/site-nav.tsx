"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pokeball } from "./pokeball";
import { NavDex, NavItems, NavHunt, NavCalc, NavLab, NavBreed, NavAccount, NavLogout } from "./nav-icons";
import { useT } from "./locale-provider";
import { LangSwitcher } from "./lang-switcher";
import { logout } from "@/lib/actions/auth";

export interface NavUser {
  name: string | null;
  image: string | null;
  vip: boolean;
}

const TABS: { key: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
  { key: "nav.dex", href: "/dex", Icon: NavDex },
  { key: "nav.items", href: "/items", Icon: NavItems },
  { key: "nav.hunt", href: "/hunt", Icon: NavHunt },
  { key: "nav.calc", href: "/calc", Icon: NavCalc },
  { key: "nav.breed", href: "/breed", Icon: NavBreed },
  { key: "nav.eevee", href: "/eevee", Icon: NavLab },
  // Conta saiu do topo: virou aba do /vip (depende da sessao de jogo, que e VIP).
  // Entra pelo botao VIP.
];

// Botao-icone do header (mesmo grid 40x40 da nav) + tooltip no hover. VIP, Entrar e
// Sair usam o mesmo chrome que os icones de navegacao, so mudando a cor.
const ICON_BTN = "group relative flex h-10 w-10 items-center justify-center rounded transition hover:bg-surface-2";
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-[color:var(--surface-solid)] px-2 py-1 text-[0.55rem] uppercase tracking-wide text-text-dim opacity-0 transition group-hover:opacity-100">
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
    <header className="sticky top-0 z-30 border-b border-border bg-[rgba(7,11,22,0.82)] backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Pokeball size={28} />
          <div className="leading-tight">
            <div className="pixel text-[0.72rem] text-text sm:text-[0.8rem]">PIWdex</div>
            <div className="hidden text-[0.6rem] text-text-dim sm:block">Poke Idle World</div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
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
          <span className="hidden h-5 w-px bg-border sm:block" />

          {/* conta / login-logout (desktop) — so o icone de conta; sem VIP no topo */}
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                <span className="max-w-[8rem] truncate pixel text-[0.58rem] text-text">{user.name ?? "conta"}</span>
                <Link
                  href="/vip#conta"
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
                    <NavLogout size={20} />
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

      {open && (
        <nav className="border-t border-border bg-[rgba(7,11,22,0.97)] sm:hidden">
          <div className="container-page flex flex-col py-1">
            {TABS.map(({ key, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 border-b border-border/40 py-3 pixel text-[0.7rem] last:border-0 hover:text-cyan ${isActive(href) ? "text-cyan" : "text-text-dim"}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                {t(key)}
              </Link>
            ))}

            {/* conta / login-logout (mobile) — sem VIP no topo */}
            {user ? (
              <>
                <Link
                  href="/vip#conta"
                  className="flex items-center gap-3 border-b border-border/40 py-3 pixel text-[0.7rem] text-text-dim hover:text-cyan"
                  onClick={() => setOpen(false)}
                >
                  <NavAccount size={20} />
                  <span className="flex items-center gap-2">{user.name ?? t("nav.account")} <VipChip /></span>
                </Link>
                <form action={logout}>
                  <button type="submit" className="flex w-full items-center gap-3 py-3 pixel text-[0.7rem] text-text-dim hover:text-red" onClick={() => setOpen(false)}>
                    <NavLogout size={20} /> {t("auth.logout")}
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/entrar"
                className="flex items-center gap-3 py-3 pixel text-[0.7rem] text-cyan"
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
