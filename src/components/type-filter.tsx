"use client";

import { useEffect, useRef, useState } from "react";
import type { PokeType } from "@/lib/types";
import { ALL_TYPES, TYPE_COLOR } from "@/lib/typing";
import { TypeIcon } from "./type-icon";
import { Caret } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";

/** Dropdown de tipo totalmente estilizado (sem <select> nativo): icone pixel + cor.
 *  `className` controla a largura (mesmo padrao do SelectMenu): sem ela, cap de 13rem;
 *  passe "" pra preencher a celula do container (ex.: numa grade). */
export function TypeFilter({
  value,
  onChange,
  className,
}: {
  value: PokeType | "";
  onChange: (t: PokeType | "") => void;
  className?: string;
}) {
  const t = useT();
  const typeLabel = useTypeLabel();
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

  const choose = (t: PokeType | "") => {
    onChange(t);
    setOpen(false);
  };

  return (
    // cap de largura recalibrado junto com o SelectMenu: 13rem virou 208px na base 16px
    // e nao segurava "Todos los tipos" + amostra de cor + seta sem truncar
    <div ref={box} className={`relative w-full ${className ?? "sm:max-w-[14rem]"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {value ? (
            <>
              {/* amostra de cor foi de h-4 (16px) pra h-5 (20px): o icone de linha
                  precisa de 14px pra nao virar borrao e 16px de caixa nao o comportava */}
              <span
                className="flex h-5 w-5 items-center justify-center rounded"
                style={{ background: TYPE_COLOR[value], color: "#fff" }}
              >
                <TypeIcon type={value} size={14} />
              </span>
              <span>{typeLabel(value)}</span>
            </>
          ) : (
            <span className="text-text-dim">{t("dex.allTypes")}</span>
          )}
        </span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={16} />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          // mesmo vidro do SelectMenu: superficie do card com a opacidade mais alta so
          // aqui (flutuante precisa de leitura limpa) e teto de altura pra caber no celular
          className="card glass-over fadein absolute z-30 mt-1 max-h-[min(18rem,60vh)] w-full overflow-y-auto p-1"
        >
          <button
            type="button"
            onClick={() => choose("")}
            // min-h-10 = 40px de alvo de toque na base 16px (min-h-9 so dava isso na base 18px)
            className={`flex min-h-10 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-surface-2 ${value === "" ? "bg-surface-2" : ""}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs text-text-dim">•</span>
            {t("dex.allTypes")}
          </button>
          {ALL_TYPES.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => choose(pt)}
              className={`flex min-h-10 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-surface-2 ${value === pt ? "bg-surface-2" : ""}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded" style={{ background: TYPE_COLOR[pt], color: "#fff" }}>
                <TypeIcon type={pt} size={14} />
              </span>
              {typeLabel(pt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
