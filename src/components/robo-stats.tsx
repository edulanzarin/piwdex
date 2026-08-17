"use client";

// Estatisticas: o totalizador CUMULATIVO (pra sempre, todas as hunts) do que o robo vendeu
// atraves do piwdex — itens e pokemon, contagem e valor. Nunca reseta (vem de robot_sales).
// Leitura pura, poll 8s.

import { useCallback, useEffect, useState } from "react";
import { StatTile } from "./stat-tile";
import { useT } from "./locale-provider";
import { Coin } from "./icons";

interface Totals { itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number }
const fmt = (n: number) => n.toLocaleString("pt-BR");

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
  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="section-title flex items-center gap-2 text-cyan">{t("robo.stats.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.stats.desc")}</p>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h3 className="section-title text-green flex items-center gap-2"><Coin size={13} /> {t("robo.stats.itemsTitle")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.stats.count")} value={fmt(tot?.itemsCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(tot?.itemsGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <h3 className="section-title text-green flex items-center gap-2"><Coin size={13} /> {t("robo.stats.pokesTitle")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.stats.count")} value={fmt(tot?.pokesCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(tot?.pokesGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      </div>
    </div>
  );
}
