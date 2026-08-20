"use client";

// Frescor do CATALOGO, na tela. O site le o catalogo do jogo ao vivo e cai numa copia
// local quando a fonte nao responde — e ate agora esse fallback era invisivel: `live` e
// `generatedAt` existiam no dado e nao apareciam em lugar nenhum. Num patch de
// balanceamento a diferenca e enorme (20/08/2026: Ledian de 493 pra 38 de ouro por
// abate), entao a data que a conta usou tem que estar do lado da conta.

import { useEffect, useState } from "react";
import { useT } from "./locale-provider";

export function CatalogStamp({ at, live, error }: { at: string; live: boolean; error: string | null }) {
  const t = useT();
  // a idade so faz sentido no relogio de quem le; no servidor ela nasce errada
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ms = Date.parse(at);
  let ageText = "";
  if (now != null && Number.isFinite(ms)) {
    const m = Math.floor((now - ms) / 60000);
    ageText = m < 1 ? t("catalog.now") : m < 60 ? `${m}min` : m < 2880 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm ${live ? "text-text-dim" : "text-yellow"}`}
      title={error ?? t("catalog.hint")}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: live ? "var(--green)" : "var(--yellow)" }} />
      {live ? t("catalog.live", { t: ageText || "—" }) : t("catalog.stale")}
    </span>
  );
}
