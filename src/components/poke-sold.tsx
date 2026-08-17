"use client";

// Pokemon vendidos (read-only). Dois blocos:
//  1) totalizador CUMULATIVO (pra sempre, todas as hunts) — /api/vip/totals.
//  2) um card fixo POR RARIDADE escolhida pra vender (status individual nao importa): so
//     quantidade + valor cumulativo daquela raridade NA HUNT atual — /api/vip/autosell.
// Reseta (o bloco 2) ao trocar de hunt; o totalizador nunca reseta.

import { useCallback, useEffect, useState } from "react";
import { StatTile } from "./stat-tile";
import { useT } from "./locale-provider";
import { Coin } from "./icons";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

interface AutoView { status: string; sellRarities?: Rarity[]; soldByRarity?: Partial<Record<Rarity, { count: number; gold: number }>> }
interface Totals { itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number }

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function PokeSold() {
  const t = useT();
  const [view, setView] = useState<AutoView | null>(null);
  const [tot, setTot] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/autosell", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as AutoView | null;
      if (j && "status" in j) setView(j);
    } catch {}
  }, []);
  const loadTotals = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/totals", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as Totals | null;
      if (j && "pokesCount" in j) setTot(j);
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  useEffect(() => { loadTotals(); const id = setInterval(loadTotals, 15000); return () => clearInterval(id); }, [loadTotals]);

  const rarities = (view?.sellRarities ?? []).slice().sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
  const byR = view?.soldByRarity ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Coin size={14} /> {t("robo.pokesold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokesold.desc")}</p>
      </div>

      {/* totalizador cumulativo — nunca reseta */}
      <div className="card p-4">
        <h3 className="section-title mb-3 text-cyan">{t("robo.total.title")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.auto.sold")} value={fmt(tot?.pokesCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(tot?.pokesGold ?? 0)} accent="var(--yellow)" icon={<Coin size={11} />} />
        </div>
      </div>

      {/* cards por raridade escolhida (da hunt atual) */}
      <div className="card p-4">
        {rarities.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{t("robo.pokesold.empty")}</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {rarities.map((r) => {
              const cell = byR[r] ?? { count: 0, gold: 0 };
              const color = RARITY_COLOR[r];
              return (
                <div key={r} className="flex items-center gap-2.5 rounded border p-2.5" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase" style={{ background: color, color: "#06111a" }}>{r}</span>
                  <div className="min-w-0 flex-1">
                    <div className="pixel text-sm tabular-nums">×{fmt(cell.count)}</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] text-yellow tabular-nums"><Coin size={10} />{fmt(cell.gold)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
