"use client";

// Itens vendidos (read-only). Dois blocos:
//  1) totalizador CUMULATIVO (pra sempre, todas as hunts) — /api/vip/totals.
//  2) os itens que o robo vendeu NA HUNT atual: um card por item selecionado, so a
//     quantidade e o valor crescem (cumulativo na hunt). Reseta ao trocar de hunt.
// A venda de drops e automatica (feita pela Hunt); aqui e so leitura. Poll a cada 4s.

import { useCallback, useEffect, useState } from "react";
import { Sprite } from "./sprite";
import { StatTile } from "./stat-tile";
import { assetIconUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin } from "./icons";

interface SoldItem { itemId: number; name: string; qty: number; gold: number; at: number }
interface HuntPeek { soldItems?: SoldItem[]; autoSellCount?: number }
interface Totals { itemsCount: number; itemsGold: number; pokesCount: number; pokesGold: number }

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function DropSeller({ itemIcons }: { itemIcons: Record<string, string> }) {
  const t = useT();
  const [sold, setSold] = useState<SoldItem[]>([]);
  const [count, setCount] = useState(0);
  const [tot, setTot] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/hunt", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as HuntPeek | null;
      if (j) { setSold(j.soldItems ?? []); setCount(j.autoSellCount ?? 0); }
    } catch {}
  }, []);
  const loadTotals = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/totals", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as Totals | null;
      if (j && "itemsCount" in j) setTot(j);
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]);
  useEffect(() => { loadTotals(); const id = setInterval(loadTotals, 15000); return () => clearInterval(id); }, [loadTotals]);

  const shown = sold.slice(0, 30);
  const huntGold = shown.reduce((s, i) => s + i.gold, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Coin size={14} /> {t("robo.sold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.sold.desc")}</p>
      </div>

      {/* totalizador cumulativo — nunca reseta */}
      <div className="card p-4">
        <h3 className="section-title mb-3 text-cyan">{t("robo.total.title")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.auto.sold")} value={fmt(tot?.itemsCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(tot?.itemsGold ?? 0)} accent="var(--yellow)" icon={<Coin size={11} />} />
        </div>
      </div>

      {/* itens da hunt atual (qty + valor cumulativos) */}
      <div className="card p-4">
        {shown.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{count > 0 ? t("robo.sold.waiting") : t("robo.sold.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[0.72rem]">
              <span className="text-text-dim">{t("robo.sold.count").replace("{n}", String(shown.length))}</span>
              <span className="inline-flex items-center gap-1 text-yellow"><Coin size={11} />{fmt(huntGold)}</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {shown.map((i) => {
                const icon = itemIcons[i.name.toLowerCase()];
                return (
                  <div key={i.itemId} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">{icon ? <Sprite src={assetIconUrl(icon)} alt={i.name} size={26} /> : null}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.75rem]">{i.name}</div>
                      <div className="text-[0.6rem] text-text-dim">×{fmt(i.qty)}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.66rem] text-yellow"><Coin size={9} />{fmt(i.gold)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
