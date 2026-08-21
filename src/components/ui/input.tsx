"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconClose, IconSearch } from "./icons";

/**
 * Campo de texto. Toda entrada do site usa a MESMA casca (`.field`), entao
 * input, select e trigger de menu tem altura, borda e foco identicos — o que
 * faz uma barra de filtro parecer uma peca so, e nao tres controles avulsos.
 */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  iconLeft?: ReactNode;
  /** botao de limpar; so aparece com valor */
  onClear?: () => void;
  invalid?: boolean;
  wrapClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { iconLeft, onClear, invalid, className, wrapClassName, ...props },
  ref,
) {
  const filled = String(props.value ?? "").length > 0;
  return (
    <div
      className={cn(
        "field",
        invalid && "border-danger/60 focus-within:border-danger focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-danger)_18%,transparent)]",
        wrapClassName,
      )}
      aria-disabled={props.disabled || undefined}
    >
      {iconLeft ? <span className="shrink-0 text-text-mute">{iconLeft}</span> : null}
      <input
        ref={ref}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none",
          "placeholder:text-text-mute disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
      {onClear && filled ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar"
          className="shrink-0 rounded-pix p-0.5 text-text-mute transition-colors hover:text-danger"
        >
          <IconClose size={8} />
        </button>
      ) : null}
    </div>
  );
});

/** Busca — o input com a lupa e o limpar ja ligados. */
export function SearchInput(props: Omit<InputProps, "iconLeft">) {
  return <Input iconLeft={<IconSearch size={12} />} placeholder="Buscar..." {...props} />;
}

/** Par de numeros "de / ate". Um controle so, porque MIN e MAX sao uma
 *  pergunta so — dois inputs soltos convidam a inverter os extremos. */
export interface NumberRangeProps {
  min?: number;
  max?: number;
  value: [number | null, number | null];
  onChange: (v: [number | null, number | null]) => void;
  placeholder?: [string, string];
  disabled?: boolean;
}

export function NumberRange({
  min,
  max,
  value,
  onChange,
  placeholder = ["min", "max"],
  disabled,
}: NumberRangeProps) {
  const parse = (s: string): number | null => (s.trim() === "" ? null : Number(s));
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        disabled={disabled}
        value={value[0] ?? ""}
        placeholder={placeholder[0]}
        onChange={(e) => onChange([parse(e.target.value), value[1]])}
        className="text-center"
      />
      <span className="shrink-0 text-[12px] text-text-mute">—</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        disabled={disabled}
        value={value[1] ?? ""}
        placeholder={placeholder[1]}
        onChange={(e) => onChange([value[0], parse(e.target.value)])}
        className="text-center"
      />
    </div>
  );
}
