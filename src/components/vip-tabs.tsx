"use client";

// Shell de abas da area VIP: Mercado (consultor ao vivo) · Desejos (o que voce quer
// que o piwdex vigie no mercado) · Alertas (central de notificacoes do que bateu) ·
// Robo (em breve). A aba mora no hash da URL. Cada aba tem seu icone pixel.

import { useEffect, useState } from "react";
import { MarketAdvisor, type MarketDex } from "./market-advisor";
import { WishlistPanel } from "./wishlist-panel";
import { AlertsInbox } from "./alerts-inbox";
import { RoboModule } from "./robo-module";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Coin, Heart, Bell } from "./icons";

type Tab = "mercado" | "desejos" | "alertas" | "robo";
const TABS: { key: Tab; Icon?: (p: { size?: number; className?: string }) => React.ReactNode; iconClass?: string }[] = [
  { key: "mercado", Icon: Coin },
  { key: "desejos", Icon: Heart, iconClass: "text-pink" },
  { key: "alertas", Icon: Bell },
  { key: "robo" },
];
const isTab = (v: string): v is Tab => TABS.some((tb) => tb.key === v);

export function VipTabs({ creatures, dex }: { creatures: ComboCreature[]; dex: Record<number, MarketDex> }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("mercado");
  const [unread, setUnread] = useState(0);
  const [focusWish, setFocusWish] = useState<string | null>(null);

  // aba inicial do hash + contador de alertas nao-lidos (badge da aba).
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

  // Resumo de alerta clicado: vai pra aba Desejos, abre o desejo e rola ate ele.
  const jumpToWish = (watchlistId: string) => {
    setFocusWish(watchlistId);
    go("desejos");
    setTimeout(() => document.getElementById(`wish-${watchlistId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {TABS.map(({ key, Icon, iconClass }) => (
          <button key={key} type="button" onClick={() => go(key)} className={`tab inline-flex items-center gap-1.5 ${tab === key ? "tab-active" : ""}`}>
            {Icon && <Icon size={11} className={iconClass} />}
            {t(`vip.tab.${key}`)}
            {key === "alertas" && unread > 0 && (
              <span className="rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] text-[#06131a]">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "mercado" && <MarketAdvisor creatures={creatures} dex={dex} />}
      {tab === "desejos" && <WishlistPanel creatures={creatures} dex={dex} focusWishId={focusWish} />}
      {tab === "alertas" && <AlertsInbox onUnread={setUnread} onJumpToWish={jumpToWish} />}
      {tab === "robo" && <RoboModule />}
    </div>
  );
}
