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
import { PokeCaught } from "./poke-caught";
import { ConsumablesBuyer } from "./consumables-buyer";
import type { ComboCreature } from "./pokemon-combobox";
import { useT } from "./locale-provider";
import { Tabs } from "./tabs";

type Section = "automacao" | "hunt" | "vender-drops" | "vender-pokes" | "capturados";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "automacao", label: "robo.nav.automacao" },
  { key: "hunt", label: "robo.nav.hunt" },
  { key: "vender-drops", label: "robo.nav.venderDrops" },
  { key: "vender-pokes", label: "robo.nav.venderPokes" },
  { key: "capturados", label: "robo.nav.capturados" },
];
const KEY = "piw:robo-section";
const isSection = (v: string): v is Section => SECTIONS.some((s) => s.key === v);

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
          <ConsumablesBuyer />
        </div>
      )}
      {sec === "hunt" && <HuntAnalyzer hunts={hunts} creatures={creatures} itemIcons={itemIcons} lootByPoke={lootByPoke} />}
      {sec === "vender-drops" && <DropSeller itemIcons={itemIcons} />}
      {sec === "vender-pokes" && <PokeSold />}
      {sec === "capturados" && <PokeCaught creatures={creatures} />}
    </div>
  );
}
