// Pecas de lista/feed da area VIP: a linha padrao (leading + texto + meta a direita)
// e o estado vazio com CTA. Kills, eventos, alertas e filas falam por estas duas.

/** Linha de feed: quadradinho a esquerda (sprite/icone), titulo + subtitulo, meta a
 *  direita. `flash` liga a animacao de entrada (item novo chegando ao vivo). */
export function FeedRow({
  leading,
  title,
  sub,
  right,
  flash = false,
  accent,
  onClick,
  className = "",
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  flash?: boolean;
  /** cor do flash de entrada (var(--cyan), var(--green)...) */
  accent?: string;
  onClick?: () => void;
  className?: string;
}) {
  // min-h fecha a altura da linha mesmo sem leading/sub: feed nao muda de ritmo
  const cls = `flex min-h-[3rem] w-full items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2 text-left ${flash ? "flash-in" : ""} ${onClick ? "transition hover:border-[color:var(--border-strong)] hover:bg-surface-2" : ""} ${className}`;
  const style = accent ? ({ "--accent": accent } as React.CSSProperties) : undefined;
  const body = (
    <>
      {leading && <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base text-text">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-sm text-text-dim">{sub}</span>}
      </span>
      {right && <span className="flex shrink-0 items-center gap-1.5 tabular-nums">{right}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} style={style}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  );
}

/** Estado vazio de um painel: mensagem curta + CTA opcional. `compact` vira uma LINHA
 *  (mensagem a esquerda, acao a direita) — painel vazio nao ocupa um bloco em branco. */
export function EmptyState({ message, action, compact = false, className = "" }: { message: React.ReactNode; action?: React.ReactNode; compact?: boolean; className?: string }) {
  if (compact) {
    // celular: mensagem em cima, acao embaixo — a 360px a linha unica espremia o texto
    // em ~130px (sete linhas de quebra) ao lado do botao. A forma e por BREAKPOINT, nao
    // por estado: os dois elementos estao sempre presentes, a altura nao dança.
    return (
      <div className={`flex flex-col items-start gap-2 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${className}`}>
        <p className="min-w-0 text-base text-text-dim">{message}</p>
        {action}
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 py-5 text-center ${className}`}>
      <p className="text-base text-text-dim">{message}</p>
      {action}
    </div>
  );
}
