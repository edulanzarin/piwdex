// Sinais de estado: LED, badge "ao vivo" e banner de alerta. Forma fechada, cor aberta —
// todo status da area VIP fala por estes tres em vez de recriar spans soltos.

import type { CSSProperties } from "react";

/** LED redondo com glow. `pulse` liga a respiracao (estado vivo/tentando). */
export function Led({ color, pulse = false, className = "" }: { color: string; pulse?: boolean; className?: string }) {
  return (
    <span
      className={`hud-led shrink-0 ${pulse ? "pulse-soft" : ""} ${className}`}
      style={{ "--led": color } as CSSProperties}
    />
  );
}

/** Badge "AO VIVO" (ou rotulo custom): led verde pulsando + texto uppercase. */
export function LiveBadge({ label = "ao vivo", color = "var(--green)" }: { label?: string; color?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm uppercase tracking-wide" style={{ color }}>
      <Led color={color} pulse />
      {label}
    </span>
  );
}

/** Banner de alerta do topo (vinculo expirado, conexao caida, sessao contestada):
 *  led + titulo pixel + detalhe + acao a direita, com flash de entrada. */
export function AlertBanner({
  color,
  title,
  detail,
  action,
}: {
  /** cor do acento (var(--red), var(--yellow)...) — pinta led, borda e titulo */
  color: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    // vidro tingido pelo acento: a faixa usa o MESMO material do card (glass = blur +
    // fio de luz) com a cor por cima, em vez de uma cor chapada solta sobre o fundo.
    // px menor no celular: a 360px cada 8px de padding sai do texto do alerta.
    <div
      className="glass flash-in flex min-h-[3.9rem] flex-wrap items-center gap-x-3 gap-y-2 rounded border px-3 py-2 sm:px-4"
      style={{
        "--accent": color,
        borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
        background: `color-mix(in srgb, ${color} 14%, var(--surface))`,
      } as CSSProperties}
    >
      <Led color={color} pulse />
      <span className="pixel min-w-0 text-base" style={{ color }}>{title}</span>
      {detail && <span className="min-w-0 text-sm text-text-dim">{detail}</span>}
      <span className="ms-auto" />
      {action}
    </div>
  );
}
