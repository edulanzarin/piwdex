"use client";

import { useEffect, useState } from "react";
import { Pokeball } from "./pokeball";

/**
 * Envolve o conteudo da dex num "aparelho" Pokedex e toca uma animacao de
 * abertura (portas vermelhas se separam + boot com scanline) ocupando a tela
 * toda antes de revelar o grid — como se voce abrisse a Pokedex de verdade.
 * Respeita prefers-reduced-motion (pula direto pro aberto).
 */
export function PokedexShell({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBooting(false);
      return;
    }
    const t = setTimeout(() => setBooting(false), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pkdx">
      <div className={`pkdx-body ${booting ? "pkdx-body-in" : ""}`}>
        {/* chrome do aparelho: lente + leds + rotulo */}
        <div className="pkdx-topbar">
          <span className="pkdx-lens" />
          <span className="pkdx-led" style={{ background: "#ff5555" }} />
          <span className="pkdx-led" style={{ background: "#f4d24a" }} />
          <span className="pkdx-led" style={{ background: "#35e08e" }} />
          <span className="pixel ml-auto text-[0.6rem] text-white/70">POKEDEX</span>
        </div>
        <div className="pkdx-screen">
          <span className="pkdx-scan" aria-hidden />
          {booting && <span className="pkdx-flash" aria-hidden />}
          <div className="relative z-[1]">{children}</div>
        </div>
      </div>

      {booting && (
        <div className="pkdx-cover" aria-hidden>
          <div className="pkdx-door pkdx-door-top">
            <span className="pkdx-cover-chrome">
              <span className="pkdx-lens-xl" />
              <span className="pkdx-cover-led" style={{ background: "#f4d24a" }} />
              <span className="pkdx-cover-led" style={{ background: "#35e08e" }} />
            </span>
          </div>
          <div className="pkdx-door pkdx-door-bottom" />
          <div className="pkdx-boot">
            <Pokeball size={52} className="wiggle" />
            <span className="pixel mt-4 text-[0.8rem] text-white">ABRINDO POKEDEX</span>
            <span className="pkdx-dots pixel text-[0.8rem] text-cyan" />
          </div>
        </div>
      )}
    </div>
  );
}
