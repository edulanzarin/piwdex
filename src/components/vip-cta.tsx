"use client";

// Chamariz de VIP pra quem NAO e VIP (deslogado ou logado sem assinatura). Dois modos:
//   - RODAPE estatico no fim da pagina (nao fecha) — sempre o ultimo bloco.
//   - BARRA fixa no rodape da viewport (fecha no X) enquanto voce rola; some assim que o
//     rodape estatico entra em cena (ai ele "estaciona" no fim).
// Some na propria area VIP e nas telas de login/conexao. Path pelo cliente (usePathname).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "./locale-provider";
import { Star } from "./icons";

const HIDDEN = ["/vip", "/entrar", "/criar-conta", "/conectar"];

export function VipCta({ vip }: { vip: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const footerRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFooterVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (vip) return null;
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;

  return (
    <>
      {/* rodape estatico — nao fecha */}
      <div ref={footerRef} className="container-page pb-8 pt-4">
        <div
          className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)", background: "rgba(240,200,60,0.05)" }}
        >
          <div className="min-w-0">
            <div className="pixel flex items-center gap-2 text-[0.72rem] text-yellow">
              <Star size={13} /> {t("vipcta.title")}
            </div>
            <p className="mt-2 max-w-2xl text-[0.72rem] leading-relaxed text-text-dim">{t("vipcta.desc")}</p>
          </div>
          <Link href="/vip" className="btn shrink-0" style={{ background: "var(--yellow)", color: "#3a2c00" }}>
            {t("vipcta.btn")} ›
          </Link>
        </div>
      </div>

      {/* barra fixa na viewport — fecha no X; some quando o rodape aparece */}
      {!dismissed && !footerVisible && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--yellow)]/40 bg-[color:var(--surface-solid)] shadow-[0_-4px_20px_rgba(0,0,0,0.45)]">
          <div className="container-page flex items-center gap-3 py-3">
            <Star size={14} className="shrink-0 text-yellow" />
            <div className="min-w-0 flex-1">
              <div className="pixel text-[0.62rem] text-yellow">{t("vipcta.title")}</div>
              <p className="mt-0.5 hidden truncate text-[0.62rem] text-text-dim sm:block">{t("vipcta.desc")}</p>
            </div>
            <Link href="/vip" className="btn shrink-0" style={{ background: "var(--yellow)", color: "#3a2c00" }}>
              {t("vipcta.btn")} ›
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t("robo.hunt.close")}
              className="shrink-0 rounded p-1.5 text-text-dim transition hover:bg-surface-2 hover:text-text"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
