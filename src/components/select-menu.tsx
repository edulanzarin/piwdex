"use client";

import { useEffect, useRef, useState } from "react";
import { Caret } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
}

/** Dropdown estilizado igual ao TypeFilter (sem <select> nativo), so que sem icone.
 *  Mantem area/ordenar com a mesma cara do filtro de tipo. */
export function SelectMenu({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    // cap de largura recalibrado: 13rem valia 234px na base 18px e virou 208px, apertado
    // pra rotulo longo ("Cualquier origen") na Quantico, mais larga que a fonte antiga.
    // w-full sem cap ate o sm: no celular o filtro ocupa a linha inteira e nada estoura
    <div ref={box} className={`relative w-full ${className ?? "sm:max-w-[14rem]"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={16} />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          // VIDRO tambem no flutuante: material do card (blur + fio de luz) em vez do
          // fundo chapado. So a OPACIDADE da superficie sobe aqui — por cima de uma grade
          // de cards o vidro padrao deixava texto brigando com texto.
          // Teto de altura em vh: no celular o menu cabe na tela e a lista rola por dentro.
          className="card glass-over fadein absolute z-30 mt-1 max-h-[min(18rem,60vh)] w-full overflow-y-auto p-1"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              // min-h-10: na base 16px o antigo min-h-9 virou 36px e perdeu o alvo de
              // toque de 40px (na base 18px ele dava 40.5px)
              className={`flex min-h-10 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-surface-2 ${value === o.value ? "bg-surface-2" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
