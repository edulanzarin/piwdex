"use client";

// Shell de abas da area VIP: Conta (visao read-only da conta do jogo + conectar) ·
// Mercado (consultor ao vivo) · Desejos (o que voce quer que o piwdex vigie no mercado) ·
// Alertas (central de notificacoes do que bateu) · Robo. Tudo que depende da sessao de
// jogo mora aqui (sessao unificada). A aba mora no hash da URL; cada aba tem seu icone.

import { useEffect, useState } from "react";
import { MarketAdvisor, type MarketDex } from "./market-advisor";
import { WishlistPanel } from "./wishlist-panel";
import { AlertsInbox } from "./alerts-inbox";
import { RobotActivity } from "./robot-activity";
import { RoboModule } from "./robo-module";
import { AccountPanel } from "./account-panel";
import type { HuntOption, DropOption } from "./hunt-analyzer";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Tabs } from "./tabs";
import { Coin, Heart, Bell, Trainer, Robot, ChevronRight } from "./icons";

type Tab = "conta" | "mercado" | "desejos" | "alertas" | "robo";
// Uma familia so de icone na fila de abas: todos pixel (Trainer/Coin/Heart/Bell/Robot),
// nada de misturar com o set de LINHA da navegacao.
const TABS: { key: Tab; Icon?: (p: { size?: number; className?: string }) => React.ReactNode; iconClass?: string }[] = [
  { key: "conta", Icon: Trainer },
  { key: "mercado", Icon: Coin },
  { key: "desejos", Icon: Heart, iconClass: "text-pink" },
  { key: "alertas", Icon: Bell },
  { key: "robo", Icon: Robot },
];
const isTab = (v: string): v is Tab => TABS.some((tb) => tb.key === v);

export function VipTabs({ creatures, dex, hunts, itemIcons, lootByPoke }: { creatures: ComboCreature[]; dex: Record<number, MarketDex>; hunts: HuntOption[]; itemIcons: Record<string, string>; lootByPoke: Record<number, DropOption[]> }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("conta");
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

  // Abas migradas pro primitivo <Tabs> (acento amarelo VIP). O icone e o badge de
  // nao-lidos viajam junto no item: icon = icone da aba, label = texto + badge.
  const tabItems = TABS.map(({ key, Icon, iconClass }) => ({
    key,
    icon: Icon ? <Icon size={11} className={iconClass} /> : undefined,
    label: (
      <>
        {t(`vip.tab.${key}`)}
        {key === "desejos" && unread > 0 && (
          <span className="rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] text-[#06131a]">{unread}</span>
        )}
      </>
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Tabs tabs={tabItems} active={tab} onChange={(k) => go(k as Tab)} accent="var(--yellow)" />

      {tab === "conta" && <AccountPanel creatures={creatures} />}
      {tab === "mercado" && <MarketAdvisor creatures={creatures} dex={dex} />}
      {/* Desejos = gerenciar desejos + a Central de desejos (os pokemon achados pra cada desejo) */}
      {tab === "desejos" && (
        <div className="flex flex-col gap-6">
          <AlertsInbox onUnread={setUnread} onJumpToWish={jumpToWish} />
          <WishlistPanel creatures={creatures} dex={dex} focusWishId={focusWish} />
        </div>
      )}
      {/* Alertas = feed de atividade do robo (vendas/hunt) + resumo dos achados de desejo */}
      {tab === "alertas" && (
        <div className="flex flex-col gap-6">
          {unread > 0 && (
            <button type="button" onClick={() => go("desejos")} className="card card-link flex items-center gap-3 p-4 text-left">
              <span className="inline-flex text-pink"><Heart size={16} /></span>
              <span className="flex-1 text-sm text-text">{t("alerts.foundSummary", { n: unread })}</span>
              <ChevronRight size={12} />
            </button>
          )}
          <RobotActivity />
        </div>
      )}
      {tab === "robo" && <RoboModule hunts={hunts} creatures={creatures} itemIcons={itemIcons} lootByPoke={lootByPoke} />}
    </div>
  );
}
