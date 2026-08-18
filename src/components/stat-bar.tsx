// Layout unico de exibicao de stat (icone + label + valor + barra preenchida).
// Fonte de verdade usada pela dex, pelo modal do mercado, pelas hunts e pelas
// comparacoes das calculadoras — nada de reinventar barra de stat por tela.
// Sem "use client": e puro (sem hooks), roda tanto em server quanto em client.

import { StatIcon } from "./stat-icons";

export const MAX_STAT = 200;

// Vermelho (baixo) -> verde (alto), proporcional ao preenchimento.
const hueFor = (pct: number) => Math.round((pct / 100) * 130);

/** Barra de um stat: icone + label + valor + barra. `max` normaliza o preenchimento
 *  (default 200, escala de stat base); `best` pinta o valor de amarelo. */
export function StatBar({
  label, value, iconIndex, best = false, max = MAX_STAT,
}: {
  label: string; value: number; iconIndex: number; best?: boolean; max?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-16 shrink-0 items-center gap-1.5 text-[0.78rem] uppercase tracking-wide text-text-dim">
        <StatIcon index={iconIndex} size={12} />{label}
      </div>
      <div className={`w-9 shrink-0 text-right text-sm font-bold tabular-nums ${best ? "text-yellow" : ""}`}>{value}</div>
      <div className="statbar flex-1">
        <div className="statbar-fill" style={{ width: `${pct}%`, background: `hsl(${hueFor(pct)} 68% 48%)` }} />
      </div>
    </div>
  );
}

/** Linha de comparacao "seu vs perfeito": barra (normalizada por `max`, tipicamente
 *  o valor perfeito daquele stat) + valor + IV. O IV e opcional (coluna perfeita nao
 *  precisa colorir). */
export function StatCompareRow({
  label, iconIndex, value, max, iv, ivMax = 32, ivClass = "text-text",
}: {
  label: string; iconIndex: number; value: number; max: number;
  iv?: number; ivMax?: number; ivClass?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[0.92rem]">
      <span className="inline-flex w-14 shrink-0 items-center gap-1 text-text-dim">
        <StatIcon index={iconIndex} size={11} />{label}
      </span>
      <div className="statbar flex-1">
        <div className="statbar-fill" style={{ width: `${pct}%`, background: `hsl(${hueFor(pct)} 68% 48%)` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-text">{value}</span>
      {iv != null && <span className={`w-11 shrink-0 text-right tabular-nums ${ivClass}`}>{iv.toFixed(0)}/{ivMax}</span>}
    </div>
  );
}
