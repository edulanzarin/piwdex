"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Popover } from "./popover";

/**
 * Dica. Abre no hover, no foco E no TOQUE.
 *
 * A regra de conteudo continua valendo: o que esta aqui e reforco, nunca dado
 * que exista so aqui. Mas "em toque hover nao existe" era uma constatacao, nao
 * uma solucao — na ficha de especie a dica de chance de drop ficava literalmente
 * inalcancavel no celular, e o gatilho tinha 22px de altura, abaixo ate do piso
 * duro de 24 da WCAG.
 *
 * O toque so ENTRA onde o hover nao chega: `pointer: coarse`. No mouse, clique
 * que fecha uma dica que o proprio ponteiro esta mantendo aberta seria briga
 * entre dois gestos pela mesma acao.
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
  /** Dedo: nao ha hover, entao o toque alterna. Consultado na hora e nao guardado
   *  em estado porque o servidor nao sabe qual e o apontador — decidir isso na
   *  renderizacao daria HTML diferente do que o cliente monta. */
  const noDedo = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
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
        onPointerEnter={() => { if (!noDedo()) show(); }}
        onPointerLeave={() => { if (!noDedo()) hide(); }}
        onClick={() => { if (noDedo()) (open ? hide() : setOpen(true)); }}
        onFocus={() => { if (!noDedo()) show(); }}
        onBlur={hide}
        className="tap inline-flex cursor-help items-center rounded-pix"
      >
        {children}
      </span>
      <Popover open={open} onClose={hide} anchorRef={anchor} minWidth={0} maxHeight={220}>
        <div id={id} role="tooltip" className="px-2.5 py-1.5 text-[13px] leading-relaxed text-text-dim">
          {content}
        </div>
      </Popover>
    </>
  );
}
