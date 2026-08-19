// Layout unico de exibicao de stat (icone + label + valor + barra preenchida).
// Fonte de verdade usada pela dex, pelo modal do mercado, pelas hunts e pelas
// comparacoes das calculadoras — nada de reinventar barra de stat por tela.
// Sem "use client": e puro (sem hooks), roda tanto em server quanto em client.

import { StatIcon } from "./stat-icons";

export const MAX_STAT = 200;

/** Larguras dos slots FIXOS da linha de comparacao. Recalibradas pra Chakra Petch
 *  (bem mais larga que a pixel antiga) na base 16px: o pior rotulo e "SP.ATK" em
 *  caixa alta (~55px a 16px) e o pior valor tem 5 digitos. Continuam FIXAS — nao
 *  variam com o dado. As linhas VAZIAS espelhadas em calculator.tsx e eevee-lab.tsx
 *  precisam usar exatamente estas classes pra placeholder e resultado ficarem no
 *  mesmo lugar. */
export const CMP_SLOT = {
  label: "w-20",
  value: "w-12",
  iv: "w-14",
} as const;

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
      {/* w-20: icone 14 + gap + "SP.ATK" em caixa alta a 15px nao cabia mais em w-16 */}
      <div className="flex w-20 shrink-0 items-center gap-1.5 text-sm uppercase tracking-wide text-text-dim">
        <StatIcon index={iconIndex} size={14} />{label}
      </div>
      {/* valor e destaque: peso 600 + tabular, largura fixa pra 5 digitos */}
      <div className={`w-12 shrink-0 text-right text-sm font-bold tabular-nums ${best ? "text-yellow" : ""}`}>{value}</div>
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
    <div className="flex items-center gap-2 text-base">
      <span className={`inline-flex ${CMP_SLOT.label} shrink-0 items-center gap-1 text-text-dim`}>
        <StatIcon index={iconIndex} size={16} />{label}
      </span>
      <div className="statbar flex-1">
        <div className="statbar-fill" style={{ width: `${pct}%`, background: `hsl(${hueFor(pct)} 68% 48%)` }} />
      </div>
      <span className={`${CMP_SLOT.value} shrink-0 text-right font-bold tabular-nums text-text`}>{value}</span>
      {iv != null && <span className={`${CMP_SLOT.iv} shrink-0 text-right tabular-nums ${ivClass}`}>{iv.toFixed(0)}/{ivMax}</span>}
    </div>
  );
}
