"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Popover } from "./popover";

/**
 * Dica. Abre no hover E no foco (teclado nao tem hover), e o conteudo NUNCA
 * carrega informacao que exista so ali — dica e reforco, nao esconderijo de
 * dado: em toque, hover nao existe.
 */
export function Tooltip({
  content,
  children,
  delay = 120,
}: {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <>
      <span
        ref={anchor}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex cursor-help items-center rounded-pix"
      >
        {children}
      </span>
      <Popover open={open} onClose={hide} anchorRef={anchor} minWidth={0} maxHeight={220}>
        <div id={id} role="tooltip" className="px-2.5 py-1.5 text-[11px] leading-relaxed text-text-dim">
          {content}
        </div>
      </Popover>
    </>
  );
}
