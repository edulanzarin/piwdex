"use client";

// Casca de modal reusavel: overlay escurecido, fecha por clique fora e por Esc, e
// trava o scroll do body enquanto aberto. O conteudo (e o botao de fechar) vem do
// chamador. Usada pelo modal de anuncio do mercado e pelo peek das hunts.
//
// Renderiza num PORTAL no <body>: `position: fixed` dentro de ancestral com transform/
// filter vira relativo ao ancestral (containing block), e o modal ficava preso dentro
// do card, por baixo do resto da pagina. No body, e overlay de verdade, sempre por cima.

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  onClose,
  children,
  className = "",
  labelledBy,
}: {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`card relative flex max-h-[88vh] flex-col overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
