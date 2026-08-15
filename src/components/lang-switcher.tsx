"use client";

import { LOCALES, type Locale } from "@/lib/i18n";
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
  return (
    <div className="flex items-center gap-1">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          title={code}
          className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-[0.55rem] font-bold uppercase transition ${
            locale === code ? "bg-surface-2 text-text ring-1 ring-[color:var(--border)]" : "text-text-dim hover:text-text"
          }`}
        >
          <Flag code={code} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
