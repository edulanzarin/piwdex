"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconCheck, IconChevronDown } from "./icons";
import { Popover, PopoverScroll } from "./popover";

/**
 * Select de escolha unica — desenhado, nao nativo.
 *
 * O nativo foi trocado por tres motivos concretos, nao por gosto: (1) o menu do
 * SO ignora o tema e abre branco no meio do escuro; (2) nao aceita sprite nem
 * cor de tipo na opcao; (3) nao da pra agrupar com rotulo pixel. O preco e ter
 * de reimplementar teclado — feito aqui: setas, Home/End, Enter, Escape.
 */
export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** conteudo rico da linha (sprite, cor de tipo) — cai no label quando ausente */
  render?: ReactNode;
  hint?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** rotulo curto colado antes do valor: "ordenar: Poder" */
  prefix?: string;
  "aria-label"?: string;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  className,
  disabled,
  prefix,
  ...props
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const anchor = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) setCursor(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const step = (dir: 1 | -1) => {
    setCursor((c) => {
      let n = c;
      for (let i = 0; i < options.length; i++) {
        n = (n + dir + options.length) % options.length;
        if (!options[n].disabled) break;
      }
      return n;
    });
  };

  /**
   * O menu aberto NAO recebe o foco, e isso e deliberado.
   *
   * O padrao ARIA de combobox manda o foco FICAR no gatilho e apontar pra opcao
   * corrente com `aria-activedescendant` — mover o foco pra lista quebraria a
   * navegacao por seta que ja funciona aqui. O que faltava nao era foco: era a
   * ligacao. Sem `aria-activedescendant` e sem `id` nas opcoes, o cursor visual
   * (`i === cursor` pinta o fundo) nao tinha contrapartida nenhuma pra quem ouve
   * a tela — a pessoa navegava as opcoes sem o leitor anunciar qual estava sob o
   * cursor.
   */
  const listaId = useId();
  const opcaoId = (i: number) => `${listaId}-o${i}`;

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
    else if (e.key === "End") { e.preventDefault(); setCursor(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[cursor];
      if (o && !o.disabled) { onChange(o.value); close(); }
    }
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        disabled={disabled}
        data-open={open || undefined}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listaId : undefined}
        aria-activedescendant={open && options[cursor] ? opcaoId(cursor) : undefined}
        aria-label={props["aria-label"]}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn("field justify-between text-left", className)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {prefix ? <span className="pix shrink-0 text-[11px] text-text-mute">{prefix}</span> : null}
          <span className={cn("truncate", !selected && "text-text-mute")}>
            {selected ? selected.render ?? selected.label : placeholder}
          </span>
        </span>
        <IconChevronDown size={14} className={cn("shrink-0 text-text-mute transition-transform", open && "rotate-180")} />
      </button>

      <Popover open={open} onClose={close} anchorRef={anchor} matchWidth>
        <PopoverScroll>
          <ul id={listaId} role="listbox" aria-label={props["aria-label"]}>
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    id={opcaoId(i)}
                    type="button"
                    role="option"
                    aria-selected={on}
                    /* Fora da ordem de tabulacao: quem navega e o gatilho, via
                       `aria-activedescendant`. O painel vai pro fim do <body> por
                       portal, entao opcao tabulavel poe a lista inteira DEPOIS de
                       todo o documento — Tab a partir do gatilho ia parar no
                       proximo elemento da pagina, nunca nas opcoes. */
                    tabIndex={-1}
                    disabled={o.disabled}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => { onChange(o.value); close(); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-pix px-2 py-1.5 text-left text-[14px] transition-colors",
                      "disabled:pointer-events-none disabled:opacity-40",
                      i === cursor ? "bg-surface-2 text-text" : "text-text-dim",
                      on && "text-accent",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.render ?? o.label}</span>
                    {o.hint ? <span className="shrink-0 text-[12px] text-text-mute">{o.hint}</span> : null}
                    {on ? <IconCheck size={14} className="shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverScroll>
      </Popover>
    </>
  );
}
