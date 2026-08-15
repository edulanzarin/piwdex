"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Revela o conteudo quando entra na viewport (sobe + fade). Da a sensacao de
 * "carregando por partes" ao rolar. Respeita prefers-reduced-motion.
 */
export function Reveal({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "section";
  return (
    <Comp ref={ref as React.Ref<HTMLElement>} className={`reveal ${shown ? "reveal-in" : ""} ${className}`}>
      {children}
    </Comp>
  );
}
