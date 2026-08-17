"use client";

// Modulo Robo — antes era um scroll unico com automacao + venda socados juntos. Agora
// e um modulo com sub-navegacao: cada capacidade tem sua secao focada, troca sem
// recarregar. A secao ativa fica em localStorage (preferencia pessoal). Cada secao e
// um componente autonomo (com seu proprio header e estados).

import { useEffect, useState } from "react";
import { RoboPanel } from "./robo-panel";
import { DropSeller } from "./drop-seller";
import { PokeSeller } from "./poke-seller";
import { PokeSold } from "./poke-sold";
import { HuntAnalyzer, type HuntOption, type DropOption } from "./hunt-analyzer";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Tabs } from "./tabs";
import { Star } from "./icons";

type Section = "automacao" | "hunt" | "vender-drops" | "vender-pokes" | "auto-compra";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "automacao", label: "robo.nav.automacao" },
  { key: "hunt", label: "robo.nav.hunt" },
  { key: "vender-drops", label: "robo.nav.venderDrops" },
  { key: "vender-pokes", label: "robo.nav.venderPokes" },
  { key: "auto-compra", label: "robo.nav.autoCompra" },
];
const KEY = "piw:robo-section";
const isSection = (v: string): v is Section => SECTIONS.some((s) => s.key === v);

function AutoBuySoon() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Star size={13} /> {t("robo.buy.title")}</h2>
      </div>
      <div className="card p-5">
        <p className="text-[0.72rem] leading-relaxed text-text-dim">{t("robo.buy.desc")}</p>
      </div>
    </div>
  );
}

export function RoboModule({ hunts, creatures, itemIcons, lootByPoke }: { hunts: HuntOption[]; creatures: ComboCreature[]; itemIcons: Record<string, string>; lootByPoke: Record<number, DropOption[]> }) {
  const t = useT();
  const [sec, setSec] = useState<Section>("automacao");

  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY);
      if (s && isSection(s)) setSec(s);
    } catch {}
  }, []);

  const go = (s: Section) => {
    setSec(s);
    try {
      window.localStorage.setItem(KEY, s);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        tabs={SECTIONS.map(({ key, label }) => ({ key, label: t(label) }))}
        active={sec}
        onChange={(k) => go(k as Section)}
        accent="var(--cyan)"
      />

      {/* Configuracoes: automacao nativa (auto-helper) + travas/venda 24/7 de pokemon, juntas */}
      {sec === "automacao" && (
        <div className="flex flex-col gap-8">
          <RoboPanel />
          <PokeSeller />
        </div>
      )}
      {sec === "hunt" && <HuntAnalyzer hunts={hunts} creatures={creatures} itemIcons={itemIcons} lootByPoke={lootByPoke} />}
      {sec === "vender-drops" && <DropSeller itemIcons={itemIcons} />}
      {sec === "vender-pokes" && <PokeSold />}
      {sec === "auto-compra" && <AutoBuySoon />}
    </div>
  );
}
