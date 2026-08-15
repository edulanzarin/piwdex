"use client";

import { useEffect, useState } from "react";
import { Pokeball } from "./pokeball";
import { useT } from "./locale-provider";

/**
 * Envolve o conteudo da dex num "aparelho" Pokedex e toca uma animacao de
 * abertura (portas vermelhas se separam + boot com scanline) ocupando a tela
 * toda antes de revelar o grid — como se voce abrisse a Pokedex de verdade.
 * Respeita prefers-reduced-motion (pula direto pro aberto).
 */
export function PokedexShell({ children, animate = true }: { children: React.ReactNode; animate?: boolean }) {
  const t = useT();
  const [booting, setBooting] = useState(animate);

  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBooting(false);
      return;
    }
    const to = setTimeout(() => setBooting(false), 2300);
    return () => clearTimeout(to);
  }, [animate]);

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
          <div className="pkdx-stage">
            {/* tampa de cima: gira abrindo pra tras no eixo X (3d) */}
            <div className="pkdx-lid pkdx-lid-top">
              <span className="pkdx-cover-chrome">
                <span className="pkdx-lens-xl" />
                <span className="pkdx-cover-led" style={{ background: "#f4d24a" }} />
                <span className="pkdx-cover-led" style={{ background: "#35e08e" }} />
              </span>
              <span className="pkdx-lid-shade" />
            </div>
            {/* tampa de baixo */}
            <div className="pkdx-lid pkdx-lid-bottom">
              <span className="pkdx-lid-grille" />
              <span className="pkdx-lid-shade" />
            </div>
            <div className="pkdx-boot">
              <Pokeball size={52} className="wiggle" />
              <span className="pixel mt-4 text-[0.8rem] text-white">{t("dex.opening")}</span>
              <span className="pkdx-dots pixel text-[0.8rem] text-cyan" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
