"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import type { PokeType } from "@/lib/types";
import { Sprite } from "./sprite";

export interface ComboCreature {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
}

// Combobox com SPRITE na caixa que expande — o <select> nativo nao mostra imagem.
// Generico: preserva o tipo concreto do item (ex.: CalcCreature com bases).
export function PokemonCombobox<T extends ComboCreature>({
  creatures,
  value,
  onSelect,
  placeholder = "Digite e selecione...",
}: {
  creatures: T[];
  value: T | null;
  onSelect: (c: T | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? creatures.filter((c) => c.name.toLowerCase().includes(q) || String(c.pokeId) === q)
      : creatures;
    return base.slice(0, 60);
  }, [creatures, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (c: T) => {
    onSelect(c);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <div
        className="input flex items-center gap-2 cursor-text"
        onClick={() => setOpen(true)}
      >
        {value && !open && (
          <Sprite src={spriteUrl(value.pokeId)} alt={value.name} size={24} />
        )}
        <input
          className="min-w-0 flex-1 bg-transparent outline-none"
          placeholder={value && !open ? value.name : placeholder}
          value={open ? query : value ? value.name : ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && results[hi]) { e.preventDefault(); choose(results[hi]); }
            else if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && (
          <button
            type="button"
            className="text-text-dim hover:text-red text-sm"
            onClick={(e) => { e.stopPropagation(); onSelect(null); setQuery(""); }}
            aria-label="limpar"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded border border-[color:var(--border-strong)] bg-[#0b1122] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)]">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm text-text-dim">Nenhum pokemon.</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.pokeId}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                  i === hi ? "bg-surface-2" : ""
                }`}
              >
                <Sprite src={spriteUrl(c.pokeId)} alt="" size={32} />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-[0.55rem] text-text-dim">#{String(c.pokeId).padStart(3, "0")}</span>
                <span className="flex gap-1">
                  {[c.type1, c.type2].filter(Boolean).map((t) => (
                    <span key={t} className="chip !text-[0.5rem] !px-1.5" style={{ background: TYPE_COLOR[t as PokeType], color: "#fff" }}>{t}</span>
                  ))}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
