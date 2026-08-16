"use client";

// Shell de abas da area VIP: Mercado (consultor) · Alertas (sniper) · Robo (em breve).
// A aba mora no hash da URL (compartilhavel/sobrevive ao reload). O contador do sininho
// e puxado no mount e mantido pelo painel de Alertas conforme o usuario le.

import { useEffect, useState } from "react";
import { MarketAdvisor, type MarketDex } from "./market-advisor";
import { AlertsPanel } from "./alerts-panel";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";

type Tab = "mercado" | "alertas" | "robo";
const TABS: Tab[] = ["mercado", "alertas", "robo"];
const isTab = (v: string): v is Tab => (TABS as string[]).includes(v);

export function VipTabs({ creatures, dex }: { creatures: ComboCreature[]; dex: Record<number, MarketDex> }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("mercado");
  const [unread, setUnread] = useState(0);

  // aba inicial do hash + contador do sininho.
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (isTab(h)) setTab(h);
    fetch("/api/vip/alerts?count=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { unread?: number }) => setUnread(j.unread ?? 0))
      .catch(() => {});
  }, []);

  const go = (v: Tab) => {
    setTab(v);
    history.replaceState(null, "", `#${v}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {TABS.map((v) => (
          <button key={v} type="button" onClick={() => go(v)} className={`tab ${tab === v ? "tab-active" : ""}`}>
            {t(`vip.tab.${v}`)}
            {v === "alertas" && unread > 0 && (
              <span className="ml-1.5 rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] text-[#06131a]">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Mantidas montadas nao seria ideal (o mercado busca sozinho ao interagir); troco por aba. */}
      {tab === "mercado" && <MarketAdvisor creatures={creatures} dex={dex} />}
      {tab === "alertas" && <AlertsPanel creatures={creatures} onUnread={setUnread} />}
      {tab === "robo" && (
        <div className="card p-5">
          <h2 className="pixel text-[0.72rem] text-yellow">{t("vip.robot.title")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">{t("vip.robot.soon")}</p>
        </div>
      )}
    </div>
  );
}
