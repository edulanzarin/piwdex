"use client";

/**
 * Envolve o conteudo num "aparelho" Pokedex (frame vermelho com lente, leds e
 * telinha). Sem animacao de abertura — so o enquadramento.
 */
export function PokedexShell({ children }: { children: React.ReactNode; animate?: boolean }) {
  return (
    <div className="pkdx">
      <div className="pkdx-body">
        <div className="pkdx-topbar">
          <span className="pkdx-lens" />
          <span className="pkdx-led" style={{ background: "#ff5555" }} />
          <span className="pkdx-led" style={{ background: "#f4d24a" }} />
          <span className="pkdx-led" style={{ background: "#35e08e" }} />
          <span className="pixel ml-auto text-[0.8rem] text-white/70">POKEDEX</span>
        </div>
        <div className="pkdx-screen">
          <span className="pkdx-scan" aria-hidden />
          <div className="relative z-[1]">{children}</div>
        </div>
      </div>
    </div>
  );
}
