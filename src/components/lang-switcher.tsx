"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, type Locale } from "@/lib/i18n";
import { Caret } from "./icons";
import { useLocale } from "./locale-provider";

function Flag({ code }: { code: Locale }) {
  const common = { width: 20, height: 14, viewBox: "0 0 18 12", shapeRendering: "crispEdges" as const, style: { imageRendering: "pixelated" as const, borderRadius: 2 } };
  if (code === "pt") {
    return (
      <svg {...common} aria-hidden>
        <rect width="18" height="12" fill="#009c3b" />
        <polygon points="9,1 16.5,6 9,11 1.5,6" fill="#ffdf00" />
        <circle cx="9" cy="6" r="2.4" fill="#002776" />
      </svg>
    );
  }
  if (code === "en") {
    return (
      <svg {...common} aria-hidden>
        <rect width="18" height="12" fill="#fff" />
        {[0, 4, 8].map((y) => <rect key={y} y={y} width="18" height="2" fill="#b22234" />)}
        <rect y="2" width="18" height="2" fill="#fff" />
        <rect y="6" width="18" height="2" fill="#fff" />
        <rect y="10" width="18" height="2" fill="#b22234" />
        <rect width="8" height="6" fill="#3c3b6e" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <rect width="18" height="12" fill="#c60b1e" />
      <rect y="3" width="18" height="6" fill="#ffc400" />
    </svg>
  );
}

export function LangSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 text-[0.6rem] font-bold uppercase text-text hover:bg-surface-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Flag code={current.code} />
        <span>{current.label}</span>
        <span className="inline-flex text-text-dim" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <Caret size={8} />
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded border border-[color:var(--border-strong)] bg-[#0b1122] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]">
          {LOCALES.map(({ code, name }) => (
            <button
              key={code}
              type="button"
              onClick={() => { setLocale(code); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.72rem] ${
                locale === code ? "bg-surface-2 text-text" : "text-text-dim hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Flag code={code} />
              <span className="uppercase tracking-wide">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
