// Barra de progresso pixel (gauge retro): trilho + preenchimento na cor do acento,
// com rotulos opcionais embaixo. Uma forma so pra XP, plano de leveling e afins.

export function ProgressBar({
  pct,
  color = "var(--cyan)",
  leftLabel,
  rightLabel,
  className = "",
}: {
  /** 0..100 (clampa sozinho) */
  pct: number;
  /** cor do preenchimento (token/var) */
  color?: string;
  leftLabel?: React.ReactNode;
  rightLabel?: React.ReactNode;
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="hud-track">
        <span className="hud-fill block" style={{ width: `${width}%`, background: color }} />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[0.58rem] tabular-nums text-text-dim">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
