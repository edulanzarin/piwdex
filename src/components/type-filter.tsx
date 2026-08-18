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
    <div ref={box} className={`relative w-full ${className ?? "sm:max-w-[13rem]"}`}>
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
              <span
                className="flex h-4 w-4 items-center justify-center rounded"
                style={{ background: TYPE_COLOR[value], color: "#fff" }}
              >
                <TypeIcon type={value} size={10} />
              </span>
              <span>{typeLabel(value)}</span>
            </>
          ) : (
            <span className="text-text-dim">{t("dex.allTypes")}</span>
          )}
        </span>
        <span className="inline-flex text-cyan" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={9} />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="card fadein absolute z-30 mt-1 max-h-72 w-full overflow-auto p-1"
          style={{ background: "var(--surface-solid)" }}
        >
          <button
            type="button"
            onClick={() => choose("")}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${value === "" ? "bg-surface-2" : ""}`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border text-xs text-text-dim">•</span>
            {t("dex.allTypes")}
          </button>
          {ALL_TYPES.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => choose(pt)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${value === pt ? "bg-surface-2" : ""}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: TYPE_COLOR[pt], color: "#fff" }}>
                <TypeIcon type={pt} size={10} />
              </span>
              {typeLabel(pt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
