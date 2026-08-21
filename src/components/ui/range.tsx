"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Faixa de dois polegares (min..max).
 *
 * Nao ha `<input type=range>` duplo: dois nativos sobrepostos brigam por
 * ponteiro e o de cima rouba o clique do de baixo. Aqui o trilho e um div e
 * cada polegar e um botao com `role=slider` — o que da teclado de graca
 * (setas, Home/End, PageUp/Down) e ARIA correta.
 *
 * Os extremos nao se cruzam: arrastar o minimo alem do maximo PARA nele, nao
 * inverte — faixa invertida devolve lista vazia e parece bug.
 */
export interface RangeProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  /** formata o numero mostrado nas pontas */
  format?: (n: number) => string;
  label?: string;
  className?: string;
}

export function Range({
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (n) => String(n),
  label,
  className,
}: RangeProps) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const span = Math.max(1, max - min);
  const pct = (n: number) => ((n - min) / span) * 100;

  const clampTo = useCallback(
    (which: 0 | 1, raw: number): [number, number] => {
      const snapped = Math.round(raw / step) * step;
      const n = Math.min(max, Math.max(min, snapped));
      return which === 0
        ? [Math.min(n, value[1]), value[1]]
        : [value[0], Math.max(n, value[0])];
    },
    [max, min, step, value],
  );

  const fromClientX = useCallback(
    (clientX: number) => {
      const r = track.current?.getBoundingClientRect();
      if (!r || r.width === 0) return null;
      return min + ((clientX - r.left) / r.width) * span;
    },
    [min, span],
  );

  useEffect(() => {
    if (drag === null) return;
    const move = (e: PointerEvent) => {
      const raw = fromClientX(e.clientX);
      if (raw != null) onChange(clampTo(drag, raw));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, clampTo, fromClientX, onChange]);

  const onKey = (which: 0 | 1) => (e: React.KeyboardEvent) => {
    const big = Math.max(step, Math.round(span / 10));
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? step
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step
      : e.key === "PageUp" ? big
      : e.key === "PageDown" ? -big
      : e.key === "Home" ? -span
      : e.key === "End" ? span
      : 0;
    if (!delta) return;
    e.preventDefault();
    onChange(clampTo(which, value[which] + delta));
  };

  // Clicar no trilho move o polegar MAIS PROXIMO — o gesto que a pessoa espera.
  const onTrackDown = (e: React.PointerEvent) => {
    const raw = fromClientX(e.clientX);
    if (raw == null) return;
    const which: 0 | 1 = Math.abs(raw - value[0]) <= Math.abs(raw - value[1]) ? 0 : 1;
    onChange(clampTo(which, raw));
    setDrag(which);
  };

  const thumb = (which: 0 | 1) => (
    <button
      key={which}
      type="button"
      role="slider"
      aria-label={`${label ?? "Faixa"} — ${which === 0 ? "minimo" : "maximo"}`}
      aria-valuemin={which === 0 ? min : value[0]}
      aria-valuemax={which === 0 ? value[1] : max}
      aria-valuenow={value[which]}
      aria-valuetext={format(value[which])}
      onPointerDown={(e) => { e.stopPropagation(); setDrag(which); }}
      onKeyDown={onKey(which)}
      style={{ left: `${pct(value[which])}%` }}
      className={cn(
        "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-pix border",
        "border-accent bg-surface-3 transition-colors hover:bg-accent/40",
        drag === which && "bg-accent/60 shadow-[0_0_12px_-2px_var(--color-accent)]",
      )}
    />
  );

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-1.5 flex items-center justify-between text-[13px] text-text-dim tabular">
        <span>{format(value[0])}</span>
        <span>{format(value[1])}</span>
      </div>
      <div
        ref={track}
        onPointerDown={onTrackDown}
        className="relative h-5 cursor-pointer touch-none"
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-pix bg-bg-soft ring-1 ring-line" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-pix bg-accent/70"
          style={{ left: `${pct(value[0])}%`, width: `${pct(value[1]) - pct(value[0])}%` }}
        />
        {thumb(0)}
        {thumb(1)}
      </div>
    </div>
  );
}
