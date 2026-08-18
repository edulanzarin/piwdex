// Panel — o card-com-cabecalho padrao da area VIP. Fecha a FORMA (card, padding,
// cabecalho com icone/titulo/slot a direita) e abre so a variacao: acento, badge ao
// vivo, acao. Substitui as ~12 copias soltas de `card p-4` + linha de header.

import type { CSSProperties } from "react";
import { LiveBadge } from "./status";

export function Panel({
  icon,
  title,
  accent,
  live = false,
  right,
  className = "",
  bodyClassName = "",
  children,
}: {
  /** icone pixel do cabecalho (ja colorido pelo acento) */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** cor do acento (token/var). Pinta o icone e alimenta --accent (glow/flash). */
  accent?: string;
  /** badge "ao vivo" pulsando no cabecalho */
  live?: boolean;
  /** slot a direita do cabecalho (botao, contador, chip) */
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`card flex flex-col gap-2.5 p-4 ${className}`}
      style={accent ? ({ "--accent": accent } as CSSProperties) : undefined}
    >
      {(title || icon || right) && (
        <header className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="inline-flex shrink-0" style={accent ? { color: accent } : undefined}>
              {icon}
            </span>
          )}
          {title && <h3 className="section-title min-w-0 flex-1 truncate">{title}</h3>}
          {live && <LiveBadge />}
          {right}
        </header>
      )}
      <div className={`flex min-h-0 flex-1 flex-col gap-2.5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
