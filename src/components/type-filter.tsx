"use client";

import { useEffect, useRef, useState } from "react";
import type { PokeType } from "@/lib/types";
import { ALL_TYPES, TYPE_COLOR } from "@/lib/typing";
import { TypeIcon } from "./type-icon";

/** Dropdown de tipo totalmente estilizado (sem <select> nativo): icone pixel + cor. */
export function TypeFilter({
  value,
  onChange,
}: {
  value: PokeType | "";
  onChange: (t: PokeType | "") => void;
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

  const choose = (t: PokeType | "") => {
    onChange(t);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative w-full sm:max-w-[13rem]">
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
              <span>{value}</span>
            </>
          ) : (
            <span className="text-text-dim">Todos os tipos</span>
          )}
        </span>
        <span className="text-cyan text-[0.6rem]" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
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
            <span className="flex h-4 w-4 items-center justify-center rounded border border-border text-[0.5rem] text-text-dim">•</span>
            Todos os tipos
          </button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => choose(t)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${value === t ? "bg-surface-2" : ""}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded" style={{ background: TYPE_COLOR[t], color: "#fff" }}>
                <TypeIcon type={t} size={10} />
              </span>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
