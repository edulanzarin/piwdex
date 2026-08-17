"use client";

// Auto-compra de consumiveis (seção de Configuracoes): o robo repoe sozinho as pokebolas
// que a automacao usa quando ficam baixas — ele calcula a quantidade. Comeca DESLIGADO
// (gasta dolares do jogo de verdade). O estado vive na sessao (/api/vip/autobuy).

import { useCallback, useEffect, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { Pokeball } from "./pokeball";
import { useT } from "./locale-provider";

export function ConsumablesBuyer() {
  const t = useT();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/autobuy", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as { on?: boolean } | null;
      if (j && "on" in j) setOn(!!j.on);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/vip/autobuy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: on ? "stop" : "start" }) });
      const j = (await r.json().catch(() => null)) as { on?: boolean } | null;
      if (j && "on" in j) setOn(!!j.on);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Pokeball size={13} /> {t("robo.autobuy.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.autobuy.desc")}</p>
      </div>
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{t("robo.autobuy.toggle")}</div>
            <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.autobuy.toggleDesc")}</div>
          </div>
          <ToggleButton active={on} accent="green" onClick={toggle}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "pulse-soft" : ""}`} style={{ background: on ? "var(--green)" : "var(--text-dim)" }} />
            {busy ? "…" : on ? t("robo.on") : t("robo.off")}
          </ToggleButton>
        </div>
        <p className="rounded border border-[color:var(--yellow)]/40 bg-[rgba(240,200,60,0.06)] px-3 py-2 text-[0.62rem] leading-relaxed text-yellow">{t("robo.autobuy.warn")}</p>
      </div>
    </div>
  );
}
