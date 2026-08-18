import type { CSSProperties } from "react";

/**
 * Container padrao das paginas de ferramenta: moldura neon tematizavel (--dev) com uma
 * faixa fina de rotulo e o corpo com scanlines sutis. A casca de "aparelho" (lente,
 * leds, corpo colorido) ficou EXCLUSIVA da Pokedex (/dex, classes pkdx-*) — pedido do
 * Eduardo: o resto tem container, mas nao o aparelho.
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
    <section className="tool-shell" style={{ "--dev": accent } as CSSProperties}>
      <header className="tool-head">
        <span className="tool-head-label pixel">
          {icon}
          {label}
        </span>
      </header>
      <div className="tool-body">
        <span className="pkdx-scan" aria-hidden />
        <div className="relative z-[1]">{children}</div>
      </div>
    </section>
  );
}
