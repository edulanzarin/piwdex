"use client";

// Frescor do CATALOGO, na tela. O site le o catalogo do jogo ao vivo e cai numa copia
// local quando a fonte nao responde — e ate agora esse fallback era invisivel: `live` e
// `generatedAt` existiam no dado e nao apareciam em lugar nenhum. Num patch de
// balanceamento a diferenca e enorme (20/08/2026: Ledian de 493 pra 38 de ouro por
// abate), entao a data que a conta usou tem que estar do lado da conta.

import { useEffect, useState } from "react";
import { useT } from "./locale-provider";

type T = ReturnType<typeof useT>;

/**
 * Idade do patch, ja com o "ha" do idioma ("ha 4h", "4h ago", "hace 4h"). Vive aqui
 * porque o painel do Tipo do Dia mostra o MESMO carimbo — e a copia de la tinha "agora"
 * chumbado em portugues, aparecendo em ingles e espanhol tambem.
 */
export function patchAge(iso: string, now: number, t: T): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const m = Math.floor((now - ms) / 60000);
  if (m < 1) return t("catalog.now");
  const curto = m < 60 ? `${m}min` : m < 2880 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  return t("catalog.ago", { t: curto });
}

/** Tooltip: o porque do carimbo + a data EXATA da publicacao. So no cliente — o
 *  `toLocaleString` do servidor sai noutro fuso e quebra a hidratacao. */
export function patchTitle(iso: string, t: T, pronto: boolean): string {
  const base = t("catalog.hint");
  const ms = Date.parse(iso);
  if (!pronto || !Number.isFinite(ms)) return base;
  return `${base} ${t("catalog.exact", { d: new Date(ms).toLocaleString() })}`;
}

export function CatalogStamp({ at, live, error }: { at: string; live: boolean; error: string | null }) {
  const t = useT();
  // a idade so faz sentido no relogio de quem le; no servidor ela nasce errada
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ageText = now != null ? patchAge(at, now, t) : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm ${live ? "text-text-dim" : "text-yellow"}`}
      title={error ?? patchTitle(at, t, now != null)}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: live ? "var(--green)" : "var(--yellow)" }} />
      {live ? t("catalog.live", { t: ageText || "—" }) : t("catalog.stale")}
    </span>
  );
}
