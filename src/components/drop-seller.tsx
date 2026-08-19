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
        <h2 className="section-title flex items-center gap-2"><Loot size={18} /> {t("robo.sold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.sold.desc")}</p>
      </div>

      {/* estrutura fixa: linha de resumo com slots permanentes + area de lista de
          ALTURA FIXA (rola por dentro) — vender item novo nao empurra a pagina */}
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex h-7 items-center justify-between text-base">
          <span className={shown.length > 0 ? "text-text-dim" : "slot-empty"}>{t("robo.sold.count").replace("{n}", String(shown.length))}</span>
          <span className={`inline-flex items-center gap-1 tabular-nums ${shown.length > 0 ? "text-green" : "slot-empty"}`}><Coin size={14} />{shown.length > 0 ? fmt(huntGold) : "—"}</span>
        </div>
        <div className="h-64 overflow-y-auto pr-1">
          {shown.length === 0 ? (
            <p className="flex h-full items-center justify-center text-center text-base text-text-dim">{count > 0 ? t("robo.sold.waiting") : t("robo.sold.empty")}</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {shown.map((i, idx) => {
                const icon = itemIcons[i.name.toLowerCase()];
                return (
                  <div key={i.itemId} className={`well flex min-w-0 items-center gap-2.5 p-2 ${idx === 0 ? "flash-in" : ""}`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">{icon ? <Sprite src={assetIconUrl(icon)} alt={i.name} size={26} /> : null}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base">{i.name}</div>
                      <div className="text-sm text-text-dim">×{fmt(i.qty)}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-base text-green"><Coin size={14} />{fmt(i.gold)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
