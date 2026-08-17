"use client";

// Estatisticas: DASHBOARD cumulativo (pra sempre, todas as hunts) do robo — o que ele
// caçou, coletou, vendeu e mantem no acervo. Nunca zera (vem de robot_sales + captured_pokes).
// Leitura pura, poll 5s. Graficos em barra CSS (sem lib), na estetica pixel/neon.

import { useCallback, useEffect, useState } from "react";
import { StatTile } from "./stat-tile";
import { useT } from "./locale-provider";
import { Coin, Xp, Skull, Star, Robot } from "./icons";
import { Pokeball } from "./pokeball";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";

interface Acervo { total: number; shiny: number; byRarity: Record<string, number> }
interface Totals {
  itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number;
  hunts: number; kills: number; captures: number; xpGained: number;
  lootItems: number; lootGold: number; supplyGold: number;
  acervo: Acervo;
}
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// uma barra horizontal (label · trilho preenchido pela fracao do maximo · valor)
function Bar({ label, value, max, color, valueText }: { label: React.ReactNode; value: number; max: number; color: string; valueText?: string }) {
  const pctW = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0; // piso de 3% pra barra nao sumir
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-[0.66rem] text-text-dim">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-[var(--well-bg)]">
        <div className="h-full rounded-sm transition-[width] duration-500" style={{ width: `${pctW}%`, background: color }} />
      </div>
      <span className="w-20 shrink-0 pixel text-right text-[0.62rem] tabular-nums" style={{ color }}>{valueText ?? fmt(value)}</span>
    </div>
  );
}

function Card({ title, color, icon, children }: { title: string; color: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <h3 className={`section-title flex items-center gap-2 ${color}`}>{icon}{title}</h3>
      {children}
    </div>
  );
}

export function RoboStats() {
  const t = useT();
  const [tot, setTot] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/totals", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as Totals | null;
      if (j && "itemsCount" in j) setTot(j);
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const d = tot;
  // dolar por fonte (loot coletado vs vendas)
  const goldMax = Math.max(1, d?.lootGold ?? 0, d?.itemsGold ?? 0, d?.pokesGold ?? 0);
  // acervo por raridade (so as que existem, na ordem oficial)
  const rar = RARITY_ORDER.filter((r) => (d?.acervo.byRarity[r] ?? 0) > 0);
  const rarMax = Math.max(1, ...rar.map((r) => d!.acervo.byRarity[r]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan"><Robot size={13} /> {t("robo.stats.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.stats.desc")}</p>
      </div>

      {/* Caçada — o que o robo acumulou cacando (todas as hunts) */}
      <Card title={t("robo.stats.huntTitle")} color="text-cyan" icon={<Skull size={13} className="text-text-dim" />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label={t("robo.stats.hunts")} value={fmt(d?.hunts ?? 0)} icon={<Robot size={11} className="text-cyan" />} />
          <StatTile label={t("robo.stats.kills")} value={fmt(d?.kills ?? 0)} icon={<Skull size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.stats.captures")} value={fmt(d?.captures ?? 0)} icon={<Pokeball size={11} />} />
          <StatTile label={t("robo.stats.lootItems")} value={fmt(d?.lootItems ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.stats.xp")} value={fmt(d?.xpGained ?? 0)} accent="var(--cyan)" icon={<Xp size={11} className="text-cyan" />} />
        </div>
      </Card>

      {/* Dólar — de onde veio (loot coletado vs vendas) e o gasto em supply */}
      <Card title={t("robo.stats.goldTitle")} color="text-green" icon={<Coin size={13} />}>
        <div className="flex flex-col gap-2.5">
          <Bar label={t("robo.stats.src.loot")} value={d?.lootGold ?? 0} max={goldMax} color="var(--green)" />
          <Bar label={t("robo.stats.src.items")} value={d?.itemsGold ?? 0} max={goldMax} color="var(--cyan)" />
          <Bar label={t("robo.stats.src.pokes")} value={d?.pokesGold ?? 0} max={goldMax} color="var(--yellow)" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.stats.lootGold")} value={fmt(d?.lootGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile label={t("robo.stats.supply")} value={`-${fmt(d?.supplyGold ?? 0)}`} icon={<Coin size={11} className="text-text-dim" />} />
        </div>
      </Card>

      {/* Vendas — itens e pokemon vendidos pelo robo (contagem + dolar) */}
      <Card title={t("robo.stats.sellTitle")} color="text-green" icon={<Coin size={13} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={t("robo.stats.itemsSold")} value={fmt(d?.itemsCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.stats.itemsSoldGold")} value={fmt(d?.itemsGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
          <StatTile label={t("robo.stats.pokesSold")} value={fmt(d?.pokesCount ?? 0)} icon={<Pokeball size={11} />} />
          <StatTile label={t("robo.stats.pokesSoldGold")} value={fmt(d?.pokesGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      </Card>

      {/* Acervo — o que o robo MANTEVE (nao vendeu), total + shiny + por raridade */}
      <Card title={t("robo.stats.acervoTitle")} color="text-yellow" icon={<Star size={13} className="text-yellow" />}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.stats.acervoTotal")} value={fmt(d?.acervo.total ?? 0)} accent="var(--yellow)" icon={<Star size={11} className="text-yellow" />} />
          <StatTile label={t("robo.stats.shiny")} value={fmt(d?.acervo.shiny ?? 0)} icon={<Star size={11} className="text-text-dim" />} />
        </div>
        {rar.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {rar.map((r) => <Bar key={r} label={r} value={d!.acervo.byRarity[r]} max={rarMax} color={RARITY_COLOR[r]} />)}
          </div>
        ) : (
          <p className="text-[0.66rem] text-text-dim">{t("robo.stats.acervoEmpty")}</p>
        )}
      </Card>
    </div>
  );
}
