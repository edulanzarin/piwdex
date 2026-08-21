import type { ReactNode } from "react";
import { Pokeball } from "./pokeball";

/**
 * Estado vazio. Nunca e so "nada encontrado": diz o que aconteceu E oferece a
 * acao que resolve, senao o usuario fica olhando pra uma tela morta sem saber
 * que basta limpar um filtro.
 */
export function Empty({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Pokeball size={40} className="text-line-strong" />
      <p className="pix text-[12px] text-text-dim">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] leading-relaxed text-text-mute">{hint}</p> : null}
      {action}
    </div>
  );
}
