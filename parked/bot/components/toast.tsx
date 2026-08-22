"use client";

// Toast padrao do site (pixel/neon): confirmacao de acao no canto, some sozinho.
// Uso: const toast = useToast(); toast.success("Hunt ligada"); toast.error("Deu ruim");
// Montado uma vez (ToastProvider no shell); a pilha vive no canto inferior direito,
// cada toast entra com flash neon e some em ~3.5s (ou no clique).

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Check, Close, Signal } from "./icons";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; text: string }

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast fora do ToastProvider");
  return v;
}

const ACCENT: Record<Kind, string> = { success: "var(--green)", error: "var(--red)", info: "var(--cyan)" };
// 16: o icone fica ao lado de um texto text-base; a 11px o traco de linha sumia
const ICON: Record<Kind, React.ReactNode> = {
  success: <Check size={16} />,
  error: <Close size={16} />,
  info: <Signal size={16} />,
};
const TTL_MS = 3_500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-3), { id, kind, text }]); // no maximo 4 na pilha
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), TTL_MS);
  }, []);

  const api: ToastApi = {
    success: useCallback((t: string) => push("success", t), [push]),
    error: useCallback((t: string) => push("error", t), [push]),
    info: useCallback((t: string) => push("info", t), [push]),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* pilha fixa: acima de modal (z-60), nao captura clique fora dos cards.
          No celular ela ocupa a largura entre as margens (w-72 fixo passava perto demais
          da borda em 360px); do sm pra cima volta a coluna de 288px na direita. */}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-72">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            // vidro (.glass) no lugar do fundo chapado; a opacidade sobe pra 92% porque o
            // toast pousa em cima de qualquer tela e precisa ser lido de primeira
            className="pointer-events-auto glass glass-over flash-in flex items-center gap-2.5 px-3.5 py-2.5 text-left"
            style={{ borderColor: `color-mix(in srgb, ${ACCENT[t.kind]} 55%, transparent)`, boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px -12px ${ACCENT[t.kind]}`, "--accent": ACCENT[t.kind] } as React.CSSProperties}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ background: `color-mix(in srgb, ${ACCENT[t.kind]} 18%, transparent)`, color: ACCENT[t.kind] }}>
              {ICON[t.kind]}
            </span>
            <span className="min-w-0 flex-1 text-base leading-snug text-text">{t.text}</span>
          </button>
        ))}
      </div>
    </Ctx.Provider>
  );
}
