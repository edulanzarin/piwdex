"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { IconChevronDown } from "./icons";
import { Input } from "./input";
import { Popover, PopoverScroll } from "./popover";

/**
 * Menu de multipla escolha — o controle central de um filtro rico.
 *
 * O gatilho conta o estado por EXTENSO ("3 tipos"), nunca so pinta de outra cor:
 * filtro ligado que so muda de tom passa despercebido e o usuario jura que a
 * lista esta errada. Ha ainda o modo E/OU, porque "Fogo e Voador" e uma pergunta
 * diferente de "Fogo ou Voador" e as duas sao legitimas na dex.
 */
export interface MultiOption<T extends string> {
  value: T;
  label: string;
  render?: ReactNode;
  /** cor de dado — pinta a caixa marcada com a cor da propria coisa */
  tint?: string;
  count?: number;
  /**
   * O que a opcao QUER DIZER, numa linha, abaixo do rotulo.
   *
   * Existe pra escada com cor: "Épico" pintado de rosa nao ensina que rosa e
   * caro, e o menu de filtro e o unico lugar onde os seis degraus aparecem
   * juntos — e portanto o unico onde da pra aprender a ordem sem legenda.
   */
  hint?: string;
}

export interface MultiSelectProps<T extends string> {
  label: string;
  value: T[];
  onChange: (v: T[]) => void;
  options: MultiOption<T>[];
  /** ativa a busca dentro do menu (a partir de ~12 opcoes ela deixa de ser luxo) */
  searchable?: boolean;
  /** nome da unidade no resumo: "3 tipos" */
  unit?: string;
  className?: string;
  /** modo de combinacao, quando faz sentido perguntar */
  mode?: "any" | "all";
  onModeChange?: (m: "any" | "all") => void;
}

export function MultiSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  searchable,
  unit,
  className,
  mode,
  onModeChange,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const anchor = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const summary =
    value.length === 0
      ? "todos"
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? "1"
        : `${value.length} ${unit ?? "itens"}`;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        data-open={open || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "field justify-between text-left",
          value.length > 0 && "border-accent/50 bg-accent/5",
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="pix shrink-0 text-[11px] text-text-mute">{label}</span>
          <span className={cn("truncate text-[14px]", value.length ? "text-accent" : "text-text-mute")}>
            {summary}
          </span>
        </span>
        <IconChevronDown size={14} className={cn("shrink-0 text-text-mute transition-transform", open && "rotate-180")} />
      </button>

      <Popover open={open} onClose={close} anchorRef={anchor} minWidth={230}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <span className="pix text-[11px] text-text-mute">{label}</span>
          <div className="flex items-center gap-1">
            {mode && onModeChange ? (
              <div className="mr-1 flex overflow-hidden rounded-[var(--radius-xs)] border border-line">
                {(["any", "all"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModeChange(m)}
                    title={m === "any" ? "Qualquer um dos marcados" : "Todos os marcados ao mesmo tempo"}
                    className={cn(
                      "pix h-5 px-1.5 text-[11px] transition-colors",
                      mode === m ? "bg-accent/25 text-accent" : "text-text-mute hover:text-text-dim",
                    )}
                  >
                    {m === "any" ? "OU" : "E"}
                  </button>
                ))}
              </div>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onChange([])} disabled={!value.length}>
              limpar
            </Button>
          </div>
        </div>

        {searchable ? (
          <div className="border-b border-line p-1.5">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filtrar..." autoFocus />
          </div>
        ) : null}

        <PopoverScroll>
          {shown.length === 0 ? (
            <p className="px-3 py-5 text-center text-[13px] text-text-mute">nada bate com &quot;{q}&quot;</p>
          ) : (
            shown.map((o) => (
              <Checkbox
                key={o.value}
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
                tint={o.tint}
                label={
                  <span className="flex items-center justify-between gap-2">
                    {/* `min-w-0` no lugar de `truncate` seco: a dica e uma
                        segunda linha, e `truncate` no pai a esmagaria junto com
                        o rotulo. Quem trunca agora e a linha do rotulo, so ela. */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.render ?? o.label}</span>
                      {o.hint ? (
                        <span className="block truncate text-[12px] text-text-mute">{o.hint}</span>
                      ) : null}
                    </span>
                    {o.count != null ? (
                      <span className="shrink-0 text-[12px] text-text-mute tabular">{o.count}</span>
                    ) : null}
                  </span>
                }
              />
            ))
          )}
        </PopoverScroll>
      </Popover>
    </>
  );
}
