"use client";

import Link from "next/link";
import { useState } from "react";
import { Pokeball } from "./pokeball";
import { T } from "./locale-provider";
import { LangSwitcher } from "./lang-switcher";

const TABS: [string, string][] = [
  ["nav.dex", "/dex"],
  ["nav.items", "/items"],
  ["nav.hunt", "/hunt"],
  ["nav.calc", "/calc"],
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[rgba(7,11,22,0.82)] backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Pokeball size={28} />
          <div className="leading-tight">
            <div className="pixel text-[0.72rem] text-text sm:text-[0.8rem]">piwdex</div>
            <div className="hidden text-[0.6rem] text-text-dim sm:block">Poke Idle World</div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden items-center gap-1 sm:flex">
            {TABS.map(([key, href]) => (
              <Link key={href} href={href} className="tab"><T k={key} /></Link>
            ))}
          </nav>
          <span className="hidden h-5 w-px bg-border sm:block" />
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
            {TABS.map(([key, href]) => (
              <Link
                key={href}
                href={href}
                className="border-b border-border/40 py-3 pixel text-[0.7rem] text-text-dim last:border-0 hover:text-cyan"
                onClick={() => setOpen(false)}
              >
                <T k={key} />
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
