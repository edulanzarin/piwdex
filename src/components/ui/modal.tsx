"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { IconClose } from "./icons";

/**
 * Modal.
 *
 * A regra que salva a tela: **conteudo que cresce tem TETO e a parte que cresce
 * ROLA**. Sem isso o painel de um pokemon com 40 golpes cresce alem da janela e
 * o botao de fechar sai da tela. Aqui o painel e um flex-col com `max-h`, o
 * corpo e `min-h-0 overflow-auto` e cabecalho/rodape ficam presos.
 *
 * Alem disso: trava o scroll do fundo, devolve o foco pra quem abriu, prende o
 * Tab dentro do painel e fecha no Escape.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** rotulo pixel pequeno acima do titulo */
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  bodyClassName?: string;
}

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);

    // foco entra no painel — senao o Tab continua percorrendo a pagina de tras
    queueMicrotask(() => panel.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-100 flex items-end justify-center bg-overlay/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "pop anim-rise flex max-h-[92dvh] w-full flex-col outline-none sm:max-h-[85dvh]",
          SIZE[size],
          className,
        )}
      >
        {(title || eyebrow) && (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              {eyebrow ? <p className="pix text-[10px] text-accent">{eyebrow}</p> : null}
              {title ? <h2 className="truncate text-[16px] font-semibold text-text">{title}</h2> : null}
            </div>
            <IconButton label="Fechar" size="sm" variant="ghost" onClick={onClose}>
              <IconClose size={10} />
            </IconButton>
          </header>
        )}

        {/* min-h-0 e o que permite o flex filho encolher e ganhar rolagem propria */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
