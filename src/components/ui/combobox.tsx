"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconChevronDown, IconSearch } from "./icons";
import { Popover, PopoverScroll } from "./popover";

/**
 * Combobox: escolha unica com BUSCA por digitacao.
 *
 * Existe pra a lista que nao cabe num Select — 434 especies. A diferenca pro
 * Select nao e visual, e de tarefa: no Select a pessoa RECONHECE a opcao numa
 * lista curta; aqui ela ja SABE o nome e quer chegar nele digitando.
 */
export interface ComboOption<T extends string | number> {
  value: T;
  label: string;
  /** linha rica: sprite, tipo, numero da dex */
  render?: ReactNode;
  keywords?: string;
}

export interface ComboboxProps<T extends string | number> {
  value: T | null;
  onChange: (v: T | null) => void;
  options: ComboOption<T>[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** teto de linhas montadas de uma vez — 434 sprites de uma vez trava o menu */
  limit?: number;
  emptyText?: string;
}

export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Digite para buscar...",
  className,
  disabled,
  limit = 60,
  emptyText = "nada encontrado",
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => { setOpen(false); setQ(""); }, []);

  const selected = options.find((o) => o.value === value) ?? null;

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options.slice(0, limit);
    // Prefixo antes de infixo: quem digita "cha" quer Charmander no topo, nao
    // "Ninetales de Alola" so porque tem "cha" no meio de outra palavra.
    const pre: ComboOption<T>[] = [];
    const mid: ComboOption<T>[] = [];
    for (const o of options) {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      const at = hay.indexOf(needle);
      if (at === 0) pre.push(o);
      else if (at > 0) mid.push(o);
      if (pre.length >= limit) break;
    }
    return [...pre, ...mid].slice(0, limit);
  }, [options, q, limit]);

  useEffect(() => setCursor(0), [q]);

  const commit = (o: ComboOption<T>) => { onChange(o.value); close(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[cursor]) commit(hits[cursor]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  return (
    <>
      <div
        ref={anchor}
        data-open={open || undefined}
        aria-disabled={disabled || undefined}
        onClick={() => { if (!disabled) { setOpen(true); input.current?.focus(); } }}
        className={cn("field cursor-text", className)}
      >
        <IconSearch size={16} className="shrink-0 text-text-mute" />
        {/* Fechado mostra a ESCOLHA (com sprite); aberto vira campo de texto. */}
        {open ? (
          <input
            ref={input}
            autoFocus
            value={q}
            disabled={disabled}
            placeholder={selected?.label ?? placeholder}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            /* `self-stretch`: dentro do `.field` (2,75rem no toque) o input media so 22px de
               altura, porque `align-items: center` centraliza sem esticar. Tocar a
               folga do campo nao foca um input — so um <label> faria isso —, entao o
               alvo real era 22px, abaixo do piso duro de 24 da WCAG 2.2 AA. */
            className="min-w-0 flex-1 self-stretch bg-transparent text-[14px] text-text outline-none placeholder:text-text-mute"
          />
        ) : (
          <span className={cn("min-w-0 flex-1 truncate text-[14px]", !selected && "text-text-mute")}>
            {selected ? selected.render ?? selected.label : placeholder}
          </span>
        )}
        <IconChevronDown size={14} className={cn("shrink-0 text-text-mute transition-transform", open && "rotate-180")} />
      </div>

      <Popover open={open} onClose={close} anchorRef={anchor} matchWidth maxHeight={340}>
        <PopoverScroll>
          {hits.length === 0 ? (
            <p className="px-2 py-3 text-center text-[13px] text-text-mute">{emptyText}</p>
          ) : (
            hits.map((o, i) => (
              <button
                key={String(o.value)}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(o)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-pix px-1.5 py-1 text-left text-[14px] transition-colors",
                  i === cursor ? "bg-surface-2 text-text" : "text-text-dim",
                  o.value === value && "text-accent",
                )}
              >
                {o.render ?? o.label}
              </button>
            ))
          )}
        </PopoverScroll>
        {q.trim() && hits.length >= limit ? (
          <p className="border-t border-line px-2 py-1 text-[12px] text-text-mute">
            mostrando {limit} — refine a busca
          </p>
        ) : null}
      </Popover>
    </>
  );
}
