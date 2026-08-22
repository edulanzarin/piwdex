"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
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
          // `self-stretch`: ver o comentario do combobox — no `.field` alto do toque o
          // input ficava com 22px e o campo inteiro nao era area de foco.
          "min-w-0 flex-1 self-stretch bg-transparent text-[14px] text-text outline-none",
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
          <IconClose size={14} />
        </button>
      ) : null}
    </div>
  );
});

/** Busca — o input com a lupa e o limpar ja ligados. */
export function SearchInput(props: Omit<InputProps, "iconLeft">) {
  return <Input iconLeft={<IconSearch size={16} />} placeholder="Buscar..." {...props} />;
}

/**
 * Campo de numero com limite — o limite so aperta quando o campo PERDE O FOCO.
 *
 * Campo controlado que normaliza a cada tecla e um moedor de digitacao. Com
 * `min={1}` e `onChange={v => setLevel(Math.max(1, v))}`, apagar o conteudo pra
 * trocar 100 por 500 devolve `1` na hora, e os tres digitos entram DEPOIS dele:
 * o usuario digita 500 e ve 1500. O mesmo vale pra decimal — comecar a digitar
 * "0.5" reescreve o zero inicial antes do ponto chegar.
 *
 * A saida e separar o que se DIGITA do que vale: enquanto o campo esta em uso,
 * manda o texto cru; ao sair, ai sim converte, aplica minimo e maximo e volta a
 * espelhar o valor canonico. O intermediario invalido existe por alguns
 * segundos, e tudo bem — quem le o valor ja lida com numero fora de faixa.
 */
export interface NumberFieldProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** valor assumido quando o campo fica vazio e perde o foco */
  fallback?: number;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  fallback,
  ...props
}: NumberFieldProps) {
  // null = espelhando o valor de fora; string = o usuario esta digitando
  const [rascunho, setRascunho] = useState<string | null>(null);

  // Interface em portugues, entao "1,8" tem de valer tanto quanto "1.8" — o
  // separador decimal daqui e a virgula, e o teclado do celular manda a virgula.
  const ler = (t: string): number => Number(t.replace(",", "."));

  const fechar = () => {
    const n = ler(rascunho ?? "");
    const vazio = rascunho == null || rascunho.trim() === "" || !Number.isFinite(n);
    let final = vazio ? (fallback ?? min ?? 0) : n;
    if (min != null) final = Math.max(min, final);
    if (max != null) final = Math.min(max, final);
    setRascunho(null);
    if (final !== value) onChange(final);
  };

  return (
    <Input
      type="number"
      inputMode={step != null && step < 1 ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step}
      value={rascunho ?? String(value)}
      onChange={(e) => {
        setRascunho(e.target.value);
        const n = ler(e.target.value);
        // propaga so o que ja e numero — sem apertar limite, que e o trabalho do blur
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={fechar}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      {...props}
    />
  );
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
      <span className="shrink-0 text-[13px] text-text-mute">—</span>
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
