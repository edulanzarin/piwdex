import { cn } from "@/lib/cn";

/**
 * Medidor de stat, em blocos pixel.
 *
 * **Zero e ESTADO, nao barra vazia**: uma barra em 0 e visualmente identica a
 * "ainda nao carregou". Por isso o numero fica sempre visivel ao lado, e nunca
 * dentro da barra.
 *
 * A escala e fechada no teto do CATALOGO (`max`), nao no maior da tela — senao
 * o mesmo Bulbasaur tem barra curta numa lista e longa noutra, e a comparacao
 * entre telas mente.
 */
export interface StatBarProps {
  label: string;
  value: number;
  max: number;
  /** cor de dado (tipo/faixa); default = acento da interface */
  tint?: string;
  className?: string;
  /** blocos em vez de barra continua — o visual de console */
  segments?: number;
}

export function StatBar({ label, value, max, tint, className, segments = 12 }: StatBarProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const lit = Math.round(ratio * segments);
  const color = tint ?? "var(--color-accent)";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="pix w-13 shrink-0 text-[8px] text-text-mute">{label}</span>
      <span
        className="flex min-w-0 flex-1 gap-px"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-[1px] transition-colors"
            style={{
              backgroundColor: i < lit ? color : "var(--color-surface-2)",
              opacity: i < lit ? 1 - (i / segments) * 0.35 : 1,
            }}
          />
        ))}
      </span>
      <span className="w-8 shrink-0 text-right text-[11px] text-text tabular">{value}</span>
    </div>
  );
}
