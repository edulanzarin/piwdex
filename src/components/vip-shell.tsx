"use client";

// Shell da area VIP (cockpit): HUD fixo no topo + navegacao LATERAL com uma secao por
// capacidade — achatou os dois niveis de abas antigos (VipTabs > RoboModule) numa fila so.
// Cada secao tem icone pixel e acento proprio. A secao mora no hash da URL (deep-link);
// hashes antigos (#robo, #conta...) continuam funcionando. Os dados vivos vem todos do
// VipLiveProvider (SSE) — os paineis nao fazem mais polling proprio.

import { useEffect, useState } from "react";
import { VipLiveProvider, useVipLive } from "./vip-live";
import { VipHud } from "./vip-hud";
import { VipOverview } from "./vip-overview";
import { MarketAdvisor, type MarketDex } from "./market-advisor";
import { WishlistPanel } from "./wishlist-panel";
import { AlertsInbox } from "./alerts-inbox";
import { RobotActivity } from "./robot-activity";
import { AccountPanel } from "./account-panel";
import { RoboPanel } from "./robo-panel";
import { PokeSeller } from "./poke-seller";
import { ConsumablesBuyer } from "./consumables-buyer";
import { DropSeller } from "./drop-seller";
import { PokeSold } from "./poke-sold";
import { PokeCaught } from "./poke-caught";
import { RoboStats } from "./robo-stats";
import { HuntAnalyzer, type HuntOption, type DropOption } from "./hunt-analyzer";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Star, Coin, Heart, Bell, Trainer, Robot, Target, Chart, Backpack, ChevronRight } from "./icons";

type Section =
  | "painel" | "hunt" | "automacao" | "capturados" | "estatisticas"
  | "mercado" | "desejos" | "alertas" | "conta";

const SECTIONS: { key: Section; accent: string; Icon: (p: { size?: number; className?: string }) => React.ReactNode }[] = [
  { key: "painel", accent: "var(--yellow)", Icon: Star },
  { key: "hunt", accent: "var(--cyan)", Icon: Target },
  { key: "automacao", accent: "var(--green)", Icon: Robot },
  { key: "capturados", accent: "var(--blue)", Icon: Backpack },
  { key: "estatisticas", accent: "var(--purple)", Icon: Chart },
  { key: "mercado", accent: "var(--green)", Icon: Coin },
  { key: "desejos", accent: "var(--pink)", Icon: Heart },
  { key: "alertas", accent: "var(--yellow)", Icon: Bell },
  { key: "conta", accent: "var(--cyan)", Icon: Trainer },
];
const isSection = (v: string): v is Section => SECTIONS.some((s) => s.key === v);
// hashes antigos -> secao nova (links salvos continuam funcionando)
const LEGACY: Record<string, Section> = { robo: "hunt", mercado: "mercado", desejos: "desejos", alertas: "alertas", conta: "conta" };

export interface VipShellProps {
  creatures: ComboCreature[];
  dex: Record<number, MarketDex>;
  hunts: HuntOption[];
  itemIcons: Record<string, string>;
  lootByPoke: Record<number, DropOption[]>;
}

export function VipShell(props: VipShellProps) {
  return (
    <VipLiveProvider>
      <VipShellInner {...props} />
    </VipLiveProvider>
  );
}

function VipShellInner({ creatures, dex, hunts, itemIcons, lootByPoke }: VipShellProps) {
  const t = useT();
  const { events, alerts } = useVipLive();
  const [sec, setSec] = useState<Section>("painel");
  const [focusWish, setFocusWish] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (isSection(h)) setSec(h);
      else if (LEGACY[h]) setSec(LEGACY[h]);
    };
    apply();
    // links tipo <a href="#conta"> (ex.: aviso de vinculo expirado no HUD) trocam a secao
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const go = (v: Section) => {
    setSec(v);
    history.replaceState(null, "", `#${v}`);
  };

  // Resumo de alerta clicado: vai pra secao Desejos, abre o desejo e rola ate ele.
  const jumpToWish = (watchlistId: string) => {
    setFocusWish(watchlistId);
    go("desejos");
    setTimeout(() => document.getElementById(`wish-${watchlistId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const badgeOf = (key: Section): number =>
    key === "desejos" ? (alerts?.unread ?? 0) : key === "alertas" ? (events?.unread ?? 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <VipHud hunts={hunts} />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* navegacao lateral (desktop) / fila horizontal (mobile) */}
        <aside className="shrink-0 lg:w-48">
          <nav className="vnav max-lg:flex-row max-lg:flex-wrap lg:sticky lg:top-20">
            {SECTIONS.map(({ key, accent, Icon }) => {
              const on = key === sec;
              const badge = badgeOf(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  aria-pressed={on}
                  className={`vnav-item ${on ? "vnav-active" : ""}`}
                  style={{ "--vn": accent } as React.CSSProperties}
                >
                  <Icon size={12} />
                  <span className="max-lg:hidden lg:flex-1">{t(`vip.sec.${key}`)}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-cyan px-1.5 py-0.5 text-[0.5rem] font-bold text-[#06131a]">{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* conteudo da secao — rise-in a cada troca */}
        <div key={sec} className="rise-in min-w-0 flex-1">
          {sec === "painel" && (
            <VipOverview hunts={hunts} creatures={creatures} itemIcons={itemIcons} onGo={(s) => go(s as Section)} />
          )}
          {sec === "hunt" && (
            <div className="flex flex-col gap-8">
              <HuntAnalyzer hunts={hunts} creatures={creatures} itemIcons={itemIcons} lootByPoke={lootByPoke} />
              <DropSeller itemIcons={itemIcons} />
              <PokeSold />
            </div>
          )}
          {sec === "automacao" && (
            <div className="flex flex-col gap-8">
              <RoboPanel />
              <PokeSeller />
              <ConsumablesBuyer />
            </div>
          )}
          {sec === "capturados" && <PokeCaught creatures={creatures} />}
          {sec === "estatisticas" && <RoboStats />}
          {sec === "mercado" && <MarketAdvisor creatures={creatures} dex={dex} />}
          {sec === "desejos" && (
            <div className="flex flex-col gap-6">
              <AlertsInbox onJumpToWish={jumpToWish} />
              <WishlistPanel creatures={creatures} dex={dex} focusWishId={focusWish} />
            </div>
          )}
          {sec === "alertas" && (
            <div className="flex flex-col gap-6">
              {(alerts?.unread ?? 0) > 0 && (
                <button type="button" onClick={() => go("desejos")} className="card card-link flex items-center gap-3 p-4 text-left">
                  <span className="inline-flex text-pink"><Heart size={16} /></span>
                  <span className="flex-1 text-sm text-text">{t("alerts.foundSummary", { n: alerts?.unread ?? 0 })}</span>
                  <ChevronRight size={12} />
                </button>
              )}
              <RobotActivity />
            </div>
          )}
          {sec === "conta" && <AccountPanel creatures={creatures} />}
        </div>
      </div>
    </div>
  );
}
