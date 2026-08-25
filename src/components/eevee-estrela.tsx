"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { spriteUrl } from "@/lib/sprites";
import { TIER_COLOR, type Tier } from "@/lib/meta";
import { EEVEE_ID, type Ramo } from "@/lib/eevee";
import { Sprite } from "@/components/ui";
import { TypeIcon } from "@/components/type-icon";

const TINT = "var(--color-t-eevee)";

/**
 * A ESTRELA: o Eevee no meio e os cinco destinos em volta.
 *
 * Por que radial e nao uma fila de cinco cartões. A linha evolutiva do resto do
 * jogo e uma SETA — Bulbasaur vira Ivysaur vira Venusaur, e a Pokedex desenha
 * isso numa reta porque e uma reta. O Eevee nao e: os cinco destinos sao
 * simultâneos, excludentes e do mesmo custo. Numa fila, o primeiro item parece o
 * padrao e o ultimo parece o resto; em volta de um centro, os cinco tem a mesma
 * distância do Eevee — que e exatamente o que a regra do jogo diz.
 *
 * A geometria e por PORCENTAGEM dentro de uma caixa quadrada, e nao por pixel:
 * assim a estrela e a mesma figura em 320px e em 560px, sem ponto de quebra e
 * sem uma segunda marcação pro celular. Os cinco pontos sao 72 graus de
 * distancia, começando no topo.
 */
const RAIO = 34;

/**
 * O raio nao vai de centro a centro.
 *
 * Ele ia, e o desenho ficava errado de um jeito que so aparece na tela: a linha
 * entrava POR DENTRO do cartão e virava um espeto atravessando o pokemon. Uma
 * ligacao entre duas coisas termina onde a segunda comeca — dai o trecho ser um
 * pedaco do raio, do lado de fora do disco central ate a borda do cartao.
 *
 * Os dois numeros sao fracao do raio, e nao pixel: assim eles continuam certos
 * quando a caixa muda de tamanho, que e a razao de a geometria inteira ser
 * proporcional.
 */
const DE = 0.34;
const ATE = 0.62;

const PONTOS = Array.from({ length: 5 }, (_, i) => {
  const rad = ((-90 + 72 * i) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  return {
    x: 50 + RAIO * cos,
    y: 50 + RAIO * sen,
    x1: 50 + RAIO * DE * cos,
    y1: 50 + RAIO * DE * sen,
    x2: 50 + RAIO * ATE * cos,
    y2: 50 + RAIO * ATE * sen,
  };
});

export function EeveeEstrela({
  ramos,
  tiers,
  escolhido,
  onEscolher,
}: {
  ramos: Ramo[];
  tiers: Map<number, { tier: Tier; score: number }>;
  escolhido: number;
  onEscolher: (i: number) => void;
}) {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[560px]"
      style={{ "--tint": TINT } as CSSProperties}
    >
      {/* Os raios ficam num SVG proprio, atras de tudo. Desenhar a linha com uma
          `div` girada custaria uma transformação por ramo e erraria o ponto de
          chegada assim que o cartão mudasse de tamanho. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {PONTOS.map((p, i) => (
          <line
            key={i}
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={i === escolhido ? TINT : "var(--color-line)"}
            strokeWidth={i === escolhido ? 0.7 : 0.4}
            strokeLinecap="round"
            className="transition-[stroke,stroke-width] duration-200"
          />
        ))}
      </svg>

      {/* o centro */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <div className="grid place-items-center rounded-full border border-line-strong bg-surface-2 p-2">
          <Sprite
            src={spriteUrl(EEVEE_ID)}
            alt="Eevee"
            size={72}
            className="[--sprite:clamp(44px,13vw,72px)]"
          />
        </div>
        <span className="pix text-[10px] tracking-[0.1em] text-text-dim">EEVEE</span>
      </div>

      {ramos.map((r, i) => {
        const p = PONTOS[i];
        const on = i === escolhido;
        const nota = r.mon ? tiers.get(r.mon.pokeId) : undefined;
        return (
          <button
            key={r.troca.pokeId}
            type="button"
            aria-pressed={on}
            onClick={() => onEscolher(i)}
            title={`${r.troca.nome} — 10x ${r.troca.pedra}`}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1",
              "w-[clamp(74px,25%,132px)] rounded-pix border px-1.5 py-2",
              "transition-[border-color,background-color,transform] duration-200",
              "motion-safe:hover:-translate-y-[calc(50%+2px)]",
              on
                ? "border-[var(--tint)] bg-[var(--tint)]/10"
                : "border-line bg-surface hover:border-[var(--tint)]/50 hover:bg-surface-2",
            )}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <Sprite
              src={spriteUrl(r.troca.pokeId)}
              alt={r.troca.nome}
              size={56}
              className="[--sprite:clamp(36px,10vw,56px)]"
            />
            <span className="w-full truncate text-center text-[11px] text-text-dim">
              {r.troca.nome}
            </span>
            <span className="flex items-center gap-1">
              {r.mon ? <TypeIcon type={r.mon.type1} size={16} /> : null}
              {nota ? (
                <span
                  className="pix text-[10px] leading-none"
                  style={{ color: TIER_COLOR[nota.tier] }}
                >
                  {nota.tier}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
