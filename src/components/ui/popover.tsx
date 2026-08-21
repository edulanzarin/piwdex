"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Camada flutuante — a base de select, menu de filtro, combobox e tooltip.
 *
 * Duas decisoes que todo flutuante do site herda daqui:
 *
 * 1. **Vai pro `body` via portal.** Ancorado no fluxo, qualquer pai com
 *    `overflow:hidden` (e o trilho de filtro rola) corta o menu pela metade.
 * 2. **Reposiciona no scroll e no resize, e VIRA pra cima quando nao cabe.**
 *    Menu que abre pra baixo no ultimo filtro da coluna abre fora da tela.
 */

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** o elemento que ancora o flutuante */
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  /** casa a largura do flutuante com a do ancora (select) */
  matchWidth?: boolean;
  /** largura minima quando nao casa (menu de filtro) */
  minWidth?: number;
  align?: "start" | "end";
  className?: string;
  /** teto de altura; o conteudo rola dentro */
  maxHeight?: number;
}

const GAP = 4;
const MARGIN = 8;

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  matchWidth,
  minWidth = 200,
  align = "start",
  className,
  maxHeight = 320,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const below = vh - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    // Vira pra cima so se lá couber MAIS do que embaixo — senao fica embaixo e rola.
    const flip = below < 160 && above > below;
    const room = Math.max(120, Math.min(maxHeight, flip ? above : below));

    const width = matchWidth ? r.width : Math.max(minWidth, r.width);
    let left = align === "end" ? r.right - width : r.left;
    left = Math.min(Math.max(MARGIN, left), vw - width - MARGIN);

    setStyle({
      position: "fixed",
      left,
      top: flip ? undefined : r.bottom + GAP,
      bottom: flip ? vh - r.top + GAP : undefined,
      width,
      maxHeight: room,
      visibility: "visible",
    });
  }, [anchorRef, align, matchWidth, minWidth, maxHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={cn("pop anim-pop z-50 flex flex-col overflow-hidden", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Corpo rolavel do flutuante — o teto de altura fica no Popover, a rolagem aqui. */
export function PopoverScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-1", className)}>{children}</div>;
}
