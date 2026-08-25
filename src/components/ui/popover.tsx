"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Camada flutuante — a base de select, menu de filtro, combobox e tooltip.
 *
 * Tres decisoes que todo flutuante do site herda daqui:
 *
 * 1. **Vai pro `body` via portal.** Ancorado no fluxo, qualquer pai com
 *    `overflow:hidden` (e o trilho de filtro rola) corta o menu pela metade.
 * 2. **Reposiciona no scroll e no resize, e VIRA pra cima quando nao cabe.**
 *    Menu que abre pra baixo no ultimo filtro da coluna abre fora da tela.
 * 3. **Fica ACIMA do modal, e nao abaixo.** A escada de camadas do site nasceu
 *    balao(30) < nav(40) < popover(50) < modal(100), e ela supunha que flutuante
 *    e modal nunca dividissem a tela. Quando o cadastro de carta do Stadium pos
 *    um combobox DENTRO de um modal, os dois viraram portais irmaos no `body` e
 *    o menu passou a abrir atras do veu: a lista simplesmente nao aparecia, sem
 *    erro nenhum.
 *
 *    A ordem certa e esta, e vale sempre: flutuante e sempre filho do controle
 *    que a pessoa esta tocando AGORA, entao ele pertence acima da camada onde
 *    esse controle mora. Nao existe caso em que o menu deva ficar sob o modal —
 *    se o modal abriu, flutuante de tras dele ja fechou.
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

/**
 * Quantos flutuantes estao abertos agora.
 *
 * Existe por causa do ESCAPE, e o defeito que ele conserta e caro: com um
 * combobox aberto dentro de um modal, apertar Esc pra fechar SO a lista fechava
 * o modal inteiro e jogava fora o formulario todo.
 *
 * A causa nao e de prioridade e sim de ORDEM DE REGISTRO. Os dois escutam
 * `keydown` na fase de captura do `document`, e nessa fase o navegador chama os
 * ouvintes na ordem em que foram registrados. O modal abriu primeiro, entao ele
 * registrou primeiro, entao ele responde primeiro — e o `stopPropagation` do
 * flutuante nunca chega a rodar.
 *
 * Um contador resolve sem inverter nada: quem esta por baixo pergunta se ha
 * camada acima antes de agir. E contador e nao booleano porque flutuante empilha
 * (o combobox de um popover de filtro), e "tem algum aberto" precisa continuar
 * verdadeiro ate o ultimo fechar.
 */
let abertos = 0;

/** Ha algum flutuante aberto? Quem responde a Escape por baixo consulta isto. */
export const temFlutuanteAberto = (): boolean => abertos > 0;

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
    abertos++;
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
      abertos = Math.max(0, abertos - 1);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={cn("pop anim-pop z-110 flex flex-col overflow-hidden", className)}
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
