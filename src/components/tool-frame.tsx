import type { CSSProperties } from "react";

/**
 * Envolve o conteudo de uma pagina de ferramenta num "aparelho" neon tematizavel
 * (casca colorida com lente, leds, label e telinha com scanlines). Mesma linguagem
 * do aparelho Pokedex, mas a cor vem do acento de cada ferramenta (--dev).
 */
export function ToolFrame({
  accent,
  label,
  icon,
  children,
}: {
  accent: string;
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="device" style={{ "--dev": accent } as CSSProperties}>
      <div className="device-body">
        <div className="device-topbar">
          <span className="device-lens" />
          <span className="device-led" style={{ background: "#ff5555" }} />
          <span className="device-led" style={{ background: "#f4d24a" }} />
          <span className="device-led" style={{ background: "#35e08e" }} />
          <span className="device-label pixel text-[0.58rem] sm:text-[0.62rem]">
            {icon}
            {label}
          </span>
        </div>
        <div className="device-screen">
          <span className="pkdx-scan" aria-hidden />
          <div className="relative z-[1]">{children}</div>
        </div>
      </div>
    </div>
  );
}
