import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * O MEDIDOR, e o cartao que o embrulha.
 *
 * Uma peca so porque as duas telas que medem stat pedem o MESMO medidor em
 * arranjos diferentes: a ficha da especie quer linha (rotulo, barra, numero), a
 * calculadora quer cartao (rotulo em cima, numero grande, barra embaixo).
 * Duplicar faria as duas divergirem no primeiro ajuste.
 *
 * ## De blocos pra linha continua
 *
 * Ele era uma fileira de 12 a 24 quadradinhos com 1px de vao. Isso vinha do
 * dialeto de console pixel, e caiu com ele — mas o problema nao era so estetico,
 * e vale registrar qual era:
 *
 * **Bloco QUANTIZA um valor continuo.** Com 12 blocos, cada um vale 8,3% — entao
 * 17,6 e 19,9 de IV acendem o mesmo numero de blocos, e a barra afirma que sao
 * iguais quando nao sao. Numa tela cujo trabalho inteiro e estimar decimal, o
 * medidor estava jogando fora a precisao que o calculo produziu.
 *
 * A linha continua desenha a fracao exata. E a faixa de incerteza — que e o
 * motivo de a calculadora existir — deixa de precisar do "piso de um bloco" pra
 * nao sumir: ela tem largura propria, em porcentagem.
 *
 * **Zero e ESTADO, nao barra vazia**: uma barra em 0 e visualmente identica a
 * "ainda nao carregou". Por isso o numero fica sempre visivel FORA da barra.
 *
 * A escala e fechada no teto do CATALOGO (`max`), nao no maior da tela — senao o
 * mesmo Bulbasaur tem barra curta numa lista e longa noutra, e a comparacao entre
 * telas mente.
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
  className?: string;
  label?: string;
  value?: number;
  max?: number;
  /** medidor mais fino, pra dentro de card e linha de tabela */
  fino?: boolean;
}

export function Segments({
  ratio,
  range,
  tint,
  className,
  label,
  value,
  max,
  fino,
}: SegmentsProps) {
  const color = tint ?? "var(--color-accent)";
  const trava = (n: number) => Math.max(0, Math.min(1, n));
  const cheio = trava(ratio);

  // A faixa tem PISO DE LARGURA, e nao piso de bloco: sem ele, "de 25,0 a 25,1"
  // desenharia uma fatia de meio pixel — que o navegador arredonda pra zero e
  // some. 1,5% e o menor tracinho que ainda se ve.
  const de = range ? trava(range[0]) : 0;
  const ate = range ? Math.max(de + 0.015, trava(range[1])) : 0;

  return (
    <span
      className={cn(
        "relative block min-w-0 overflow-hidden rounded-pill bg-surface-2",
        fino ? "h-1.5" : "h-2",
        className,
      )}
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      {/* O preenchimento. O gradiente vai da cor rebaixada pra cor cheia da
          esquerda pra direita: a ponta e o que o olho procura, e ela ficar mais
          acesa que a base da a leitura de "ate aqui" sem precisar de marcador. */}
      <span
        className="absolute inset-y-0 left-0 rounded-pill transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{
          width: `${cheio * 100}%`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
        }}
      />

      {/* A faixa de incerteza, POR CIMA e mais clara. Ela e um trecho do trilho,
          nao um segundo preenchimento a partir do zero — por isso `left` e
          `width` em vez de outra barra ancorada na esquerda. */}
      {range ? (
        <span
          className="absolute inset-y-0 rounded-pill"
          style={{
            left: `${de * 100}%`,
            width: `${(ate - de) * 100}%`,
            background: `color-mix(in oklab, ${color} 85%, white)`,
            opacity: 0.9,
          }}
        />
      ) : null}
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
}

/** Arranjo em LINHA: rotulo, barra, numero. Pra lista comparavel. */
export function StatBar({ label, icon, value, max, tint, className }: StatBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="pix flex w-24 shrink-0 items-center gap-1.5 text-[11px] text-text-mute">
        {icon}
        {label}
      </span>
      <Segments
        ratio={max > 0 ? value / max : 0}
        tint={tint}
        className="flex-1"
        label={label}
        value={value}
        max={max}
      />
      <span className="num w-9 shrink-0 text-right text-[13px] text-text">{value}</span>
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
      <Segments ratio={ratio} range={range} tint={tint} label={label} />
      {footLeft || footRight ? (
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="pix text-[11px] text-text-mute">{footLeft}</span>
          <span className="text-[13px] tabular">{footRight}</span>
        </div>
      ) : null}
    </div>
  );
}
