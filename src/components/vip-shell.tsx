"use client";

// Shell da area VIP (cockpit): HUD fixo no topo + navegacao LATERAL com uma secao por
// capacidade — achatou os dois niveis de abas antigos (VipTabs > RoboModule) numa fila so.
// A nav e texto puro, sem icone nem cor por secao. A secao mora no hash da URL (deep-link);
// hashes antigos (#robo, #conta...) continuam funcionando. Os dados vivos vem todos do
// VipLiveProvider (SSE) — os paineis nao fazem mais polling proprio.

import { useEffect, useRef, useState } from "react";
import { VipLiveProvider, useVipLive } from "./vip-live";
import { VipHud } from "./vip-hud";
import { SessionHoldNotice } from "./session-hold-notice";
import { VipOverview } from "./vip-overview";
import { MarketAdvisor, type MarketDex } from "./market-advisor";
import { WishlistPanel } from "./wishlist-panel";
import { RobotActivity } from "./robot-activity";
import { AccountPanel } from "./account-panel";
import { MyPokemons } from "./my-pokemons";
import { ConfigPanel } from "./config-panel";
import { DropSeller } from "./drop-seller";
import { PokeSold } from "./poke-sold";
import { PokeCaught } from "./poke-caught";
import { RoboStats } from "./robo-stats";
import { HuntAnalyzer, type HuntOption, type DropOption } from "./hunt-analyzer";
import { ChatPanel } from "./chat-panel";
import { ToastProvider } from "./toast";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Heart, ChevronRight } from "./icons";

type Section =
  | "painel" | "pokemons" | "hunt" | "chat" | "config" | "capturados" | "estatisticas"
  | "mercado" | "desejos" | "alertas" | "conta";

// So a chave: a nav do VIP e texto puro, sem icone e sem cor por secao (pedido do
// Eduardo). O ativo se distingue por superficie + peso, via .vnav-active.
// Ordem definida pelo Eduardo: o que ele mais abre primeiro (operar a hunt e o que
// ela rende), depois mercado/desejos, e a cauda de ajuste/leitura no fim.
const SECTIONS: { key: Section }[] = [
  { key: "painel" }, { key: "hunt" }, { key: "capturados" }, { key: "mercado" },
  { key: "desejos" }, { key: "chat" }, { key: "pokemons" }, { key: "estatisticas" },
  { key: "config" }, { key: "alertas" }, { key: "conta" },
];
const isSection = (v: string): v is Section => SECTIONS.some((s) => s.key === v);
// hashes antigos -> secao nova (links salvos continuam funcionando)
const LEGACY: Record<string, Section> = { robo: "hunt", automacao: "config" };

export interface VipShellProps {
  creatures: ComboCreature[];
  dex: Record<number, MarketDex>;
  hunts: HuntOption[];
  itemIcons: Record<string, string>;
  lootByPoke: Record<number, DropOption[]>;
  marketItems: { id: number; name: string; icon: string }[]; // catalogo pro desejo de item
}

export function VipShell(props: VipShellProps) {
  return (
    <VipLiveProvider>
      <ToastProvider>
        <VipShellInner {...props} />
      </ToastProvider>
    </VipLiveProvider>
  );
}

function VipShellInner({ creatures, dex, hunts, itemIcons, lootByPoke, marketItems }: VipShellProps) {
  const t = useT();
  const { events, alerts, account } = useVipLive();
  const [sec, setSec] = useState<Section>("painel");
  const autoRouted = useRef(false);

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

  // Sem deep-link (URL sem hash) e conta do JOGO ainda nao conectada => abre em "Conta":
  // conectar e o primeiro passo, o resto da area VIP depende disso. So uma vez, e nunca
  // por cima de quem ja escolheu uma secao (hash presente) ou ja e conectado.
  useEffect(() => {
    if (autoRouted.current || !account) return;
    autoRouted.current = true;
    if (!window.location.hash && !account.connected) {
      setSec("conta");
      history.replaceState(null, "", "#conta");
    }
  }, [account]);

  const go = (v: Section) => {
    setSec(v);
    history.replaceState(null, "", `#${v}`);
  };

  const badgeOf = (key: Section): number =>
    key === "desejos" ? (alerts?.unread ?? 0) : key === "alertas" ? (events?.unread ?? 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <VipHud hunts={hunts} />
      <SessionHoldNotice />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* navegacao lateral (desktop) / trilho horizontal ROLAVEL de altura fixa
            (mobile) — nada de wrap: a fila nunca cresce na vertical, e o rotulo fica
            visivel. O badge de contagem e absoluto: aparecer nao empurra o vizinho. */}
        {/* sem icone, o rotulo mais longo ("Meus Pokemons") cabe em 12rem na Quantico */}
        <aside className="shrink-0 lg:w-48">
          <nav className="vnav max-lg:-mx-1 max-lg:flex-row max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:px-1 max-lg:pb-1.5 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden lg:sticky lg:top-20">
            {SECTIONS.map(({ key }) => {
              const on = key === sec;
              const badge = badgeOf(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(key)}
                  aria-pressed={on}
                  className={`vnav-item relative max-lg:shrink-0 ${on ? "vnav-active" : ""}`}
                >
                  <span className="lg:flex-1">{t(`vip.sec.${key}`)}</span>
                  <span
                    className={`min-w-[1.35rem] rounded-full bg-cyan px-1.5 py-0.5 text-center text-xs font-bold leading-none text-[#06131a] max-lg:absolute max-lg:-top-0.5 max-lg:right-0 lg:ml-auto ${badge > 0 ? "" : "invisible lg:hidden"}`}
                  >
                    {badge > 0 ? badge : 0}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* conteudo da secao — rise-in a cada troca */}
        <div key={sec} className="rise-in min-w-0 flex-1">
          {sec === "painel" && (
            <VipOverview hunts={hunts} creatures={creatures} itemIcons={itemIcons} dex={dex} onGo={(s) => go(s as Section)} />
          )}
          {sec === "pokemons" && <MyPokemons dex={dex} />}
          {sec === "hunt" && (
            <div className="flex flex-col gap-8">
              <HuntAnalyzer hunts={hunts} creatures={creatures} itemIcons={itemIcons} lootByPoke={lootByPoke} />
              <DropSeller itemIcons={itemIcons} />
              <PokeSold />
            </div>
          )}
          {sec === "chat" && <ChatPanel creatures={creatures} dex={dex} />}
          {sec === "config" && <ConfigPanel />}
          {sec === "capturados" && <PokeCaught creatures={creatures} />}
          {sec === "estatisticas" && <RoboStats />}
          {sec === "mercado" && <MarketAdvisor creatures={creatures} dex={dex} />}
          {/* Sem "Central de desejos": ela repetia, na MESMA pagina, os achados que a
              lista de desejos ja mostra expandindo o desejo. */}
          {sec === "desejos" && <WishlistPanel creatures={creatures} items={marketItems} dex={dex} />}
          {sec === "alertas" && (
            <div className="flex flex-col gap-6">
              {(alerts?.unread ?? 0) > 0 && (
                <button type="button" onClick={() => go("desejos")} className="card card-link flex items-center gap-3 p-4 text-left">
                  <span className="inline-flex"><Heart size={18} /></span>
                  <span className="flex-1 text-base text-text">{t("alerts.foundSummary", { n: alerts?.unread ?? 0 })}</span>
                  <ChevronRight size={16} />
                </button>
              )}
              <RobotActivity />
            </div>
          )}
          {sec === "conta" && <AccountPanel creatures={creatures} dex={dex} />}
        </div>
      </div>
    </div>
  );
}
