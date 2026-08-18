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
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-wide" style={{ color }}>
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
    <div
      className="flash-in flex flex-wrap items-center gap-3 rounded border px-4 py-3"
      style={{
        "--accent": color,
        borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      } as CSSProperties}
    >
      <Led color={color} pulse />
      <span className="pixel text-[0.7rem]" style={{ color }}>{title}</span>
      {detail && <span className="text-[0.62rem] text-text-dim">{detail}</span>}
      <span className="ms-auto" />
      {action}
    </div>
  );
}
