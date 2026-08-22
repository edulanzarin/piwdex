import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Medidor em blocos pixel, e o cartao que o embrulha.
 *
 * Uma peca so porque as duas telas que medem stat pedem a MESMA barra em
 * arranjos diferentes: a ficha da especie quer linha (rotulo, barra, numero),
 * a calculadora quer cartao (rotulo em cima, numero grande, barra embaixo).
 * Duplicar a barra faria as duas divergirem no primeiro ajuste.
 *
 * **Zero e ESTADO, nao barra vazia**: uma barra em 0 e visualmente identica a
 * "ainda nao carregou". Por isso o numero fica sempre visivel FORA da barra.
 *
 * A escala e fechada no teto do CATALOGO (`max`), nao no maior da tela — senao
 * o mesmo Bulbasaur tem barra curta numa lista e longa noutra, e a comparacao
 * entre telas mente.
 */

export interface SegmentsProps {
  /** 0..1 do preenchimento certo */
  ratio: number;
  /**
   * Faixa de incerteza `[0..1, 0..1]`, desenhada ACESA por cima do
   * preenchimento. Existe porque valor estimado a partir de numero arredondado
   * e intervalo, nao ponto — e o medidor tem de mostrar a largura dele.
   */
  range?: [number, number];
  tint?: string;
  segments?: number;
  className?: string;
  label?: string;
  value?: number;
  max?: number;
}

export function Segments({
  ratio,
  range,
  tint,
  segments = 14,
  className,
  label,
  value,
  max,
}: SegmentsProps) {
  const color = tint ?? "var(--color-accent)";
  const trava = (n: number) => Math.max(0, Math.min(1, n));

  const cheio = Math.round(trava(ratio) * segments);
  // Piso de UM bloco na faixa: intervalo estreito nao pode desaparecer, senao
  // "de 25 a 26" e "exatamente 25" desenham igual.
  const de = range ? Math.floor(trava(range[0]) * segments) : cheio;
  const ate = range ? Math.max(de + 1, Math.ceil(trava(range[1]) * segments)) : cheio;

  return (
    <span
      className={cn("flex min-w-0 gap-px", className)}
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      {Array.from({ length: segments }, (_, i) => {
        const naFaixa = range ? i >= de && i < ate : false;
        const aceso = i < cheio || naFaixa;
        return (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-[1px] transition-colors"
            style={{
              backgroundColor: aceso ? color : "var(--color-surface-2)",
              // dentro da faixa o bloco brilha; abaixo dela ele apaga de leve
              // conforme se afasta, que e o que da o degrade de console
              opacity: aceso ? (naFaixa ? 1 : 0.55 - (i / segments) * 0.15) : 1,
            }}
          />
        );
      })}
    </span>
  );
}

export interface StatBarProps {
  label: string;
  /** marcador da grandeza — o icone diz "defesa especial" sem gastar largura */
  icon?: ReactNode;
  value: number;
  max: number;
  /** cor de dado (tipo/faixa); default = acento da interface */
  tint?: string;
  className?: string;
  segments?: number;
}

/** Arranjo em LINHA: rotulo, barra, numero. Pra lista comparavel. */
export function StatBar({ label, icon, value, max, tint, className, segments = 12 }: StatBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="pix flex w-24 shrink-0 items-center gap-1.5 text-[11px] text-text-mute">
        {icon}
        {label}
      </span>
      <Segments
        ratio={max > 0 ? value / max : 0}
        tint={tint}
        segments={segments}
        className="flex-1"
        label={label}
        value={value}
        max={max}
      />
      <span className="w-8 shrink-0 text-right text-[13px] text-text tabular">{value}</span>
    </div>
  );
}

export interface StatTileProps {
  label: string;
  icon?: ReactNode;
  /** valor principal, ja formatado — pode ser "25–32" e nao so um numero */
  value: ReactNode;
  /** colado no valor, menor: "/32" */
  suffix?: ReactNode;
  ratio: number;
  range?: [number, number];
  tint?: string;
  segments?: number;
  footLeft?: ReactNode;
  footRight?: ReactNode;
  className?: string;
}

/** Arranjo em CARTAO: rotulo em cima, numero grande, barra embaixo, rodape.
 *  Pra grade onde a pergunta e "onde este esta longe do teto". */
export function StatTile({
  label,
  icon,
  value,
  suffix,
  ratio,
  range,
  tint,
  segments = 14,
  footLeft,
  footRight,
  className,
}: StatTileProps) {
  return (
    <div className={cn("border border-line bg-bg-soft p-2.5", className)}>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="pix flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-text-mute">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className="text-[18px] leading-none font-bold text-text tabular">{value}</span>
        {suffix ? <span className="pix text-[11px] text-text-mute">{suffix}</span> : null}
      </div>
      <Segments ratio={ratio} range={range} tint={tint} segments={segments} label={label} />
      {footLeft || footRight ? (
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="pix text-[11px] text-text-mute">{footLeft}</span>
          <span className="text-[13px] tabular">{footRight}</span>
        </div>
      ) : null}
    </div>
  );
}
