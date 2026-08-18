"use client";

// Itens vendidos NA HUNT ATUAL (read-only): um card por item selecionado; a quantidade e o
// valor crescem (cumulativo na hunt) e resetam ao trocar de hunt. O total acumulado de todas
// as hunts fica na aba Estatisticas. Dados direto do stream ao vivo (useVipLive). Vive na aba Hunt.

import { Sprite } from "./sprite";
import { assetIconUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin, Loot } from "./icons";
import { useVipLive } from "./vip-live";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function DropSeller({ itemIcons }: { itemIcons: Record<string, string> }) {
  const t = useT();
  const { hunt } = useVipLive();
  const sold = hunt?.soldItems ?? [];
  const count = hunt?.autoSellCount ?? 0;

  const shown = sold.slice(0, 30);
  const huntGold = shown.reduce((s, i) => s + i.gold, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-green"><Loot size={14} /> {t("robo.sold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.sold.desc")}</p>
      </div>

      <div className="card p-4">
        {shown.length === 0 ? (
          <p className="text-[0.92rem] text-text-dim">{count > 0 ? t("robo.sold.waiting") : t("robo.sold.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[0.92rem]">
              <span className="text-text-dim">{t("robo.sold.count").replace("{n}", String(shown.length))}</span>
              <span className="inline-flex items-center gap-1 text-green"><Coin size={11} />{fmt(huntGold)}</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {shown.map((i, idx) => {
                const icon = itemIcons[i.name.toLowerCase()];
                return (
                  <div key={i.itemId} className={`flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2 ${idx === 0 ? "flash-in" : ""}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">{icon ? <Sprite src={assetIconUrl(icon)} alt={i.name} size={26} /> : null}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.95rem]">{i.name}</div>
                      <div className="text-[0.8rem] text-text-dim">×{fmt(i.qty)}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[0.86rem] text-green"><Coin size={9} />{fmt(i.gold)}</span>
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
