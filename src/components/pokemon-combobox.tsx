"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";
import { Close } from "./icons";
import { useT } from "./locale-provider";

export interface ComboCreature {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
}

// Combobox com SPRITE na caixa que expande — o <select> nativo nao mostra imagem.
// O dropdown vai num PORTAL (fixed) pra nao ficar atras dos cards seguintes (os
// cards criam stacking context e prendiam o menu com z-index absoluto).
export function PokemonCombobox<T extends ComboCreature>({
  creatures,
  value,
  onSelect,
  placeholder,
}: {
  creatures: T[];
  value: T | null;
  onSelect: (c: T | null) => void;
  placeholder?: string;
}) {
  const tr = useT();
  const ph = placeholder ?? tr("calc.pick");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? creatures.filter((c) => c.name.toLowerCase().includes(q) || String(c.pokeId) === q)
      : creatures;
    return base.slice(0, 60);
  }, [creatures, query]);

  // Posiciona o menu ancorado na caixa; reposiciona em scroll/resize enquanto aberto.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (c: T) => {
    onSelect(c);
    setQuery("");
    setOpen(false);
  };

  const menu =
    open && rect && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] max-h-72 overflow-y-auto rounded border border-[color:var(--border-strong)] bg-[#0b1122] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-dim">{tr("dex.empty")}</div>
            ) : (
              // linha de ALTURA FIXA (h-11 >= 40px de toque): nome trunca, o resto nao encolhe
              results.map((c, i) => (
                <button
                  key={c.pokeId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                  onMouseEnter={() => setHi(i)}
                  className={`flex h-11 w-full items-center gap-3 px-3 text-left ${i === hi ? "bg-surface-2" : ""}`}
                >
                  <Sprite src={spriteUrl(c.pokeId)} alt="" size={32} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="shrink-0 text-xs text-text-dim">#{String(c.pokeId).padStart(3, "0")}</span>
                  <span className="flex shrink-0 gap-1">
                    {[c.type1, c.type2].filter(Boolean).map((t) => (
                      <span key={t} className="chip" style={{ background: TYPE_COLOR[t as PokeType], color: "#fff" }}>{t}</span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={boxRef}>
      <div className="input flex items-center gap-2 cursor-text" onClick={() => setOpen(true)}>
        {value && !open && <Sprite src={spriteUrl(value.pokeId)} alt={value.name} size={24} />}
        <input
          className="min-w-0 flex-1 bg-transparent outline-none"
          placeholder={value && !open ? value.name : ph}
          value={open ? query : value ? value.name : ""}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && results[hi]) { e.preventDefault(); choose(results[hi]); }
            else if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && (
          // alvo de toque de 40px sem engordar o input (margem negativa compensa)
          <button
            type="button"
            className="icon-btn -my-2 -me-2 h-9 w-9 shrink-0 hover:text-red"
            onClick={(e) => { e.stopPropagation(); onSelect(null); setQuery(""); }}
            aria-label="limpar"
          >
            <Close size={12} />
          </button>
        )}
      </div>
      {menu}
    </div>
  );
}
