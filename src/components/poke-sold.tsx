"use client";

// Pokemon vendidos (read-only) — espelha a aba "Itens vendidos". A configuracao (travas
// + venda automatica 24/7) mora em Configuracoes; aqui fica SO o log do que o robo vendeu
// de fato (venda confirmada, gravada na sessao). Poll do /api/vip/autosell a cada 4s.

import { useCallback, useEffect, useState } from "react";
import { Sprite } from "./sprite";
import { StatTile } from "./stat-tile";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin, Star, Clock } from "./icons";
import { RARITY_COLOR } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

interface SoldPoke { id: string; name: string; speciesId: number; level: number; shiny: boolean; ivTotal: number; quality: number; sellValue: number; rarity: Rarity; at: number }
interface AutoView { status: string; soldTotal?: number; goldTotal?: number; lastSweepAt?: number | null; soldPokes?: SoldPoke[] }

const fmt = (n: number) => n.toLocaleString("pt-BR");
const hhmm = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—");

export function PokeSold() {
  const t = useT();
  const [view, setView] = useState<AutoView | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/autosell", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as AutoView | null;
      if (j && "status" in j) setView(j);
    } catch {}
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]);

  const sold = view?.soldPokes ?? [];
  const on = view?.status === "running" || view?.status === "connecting";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Coin size={14} /> {t("robo.pokesold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokesold.desc")}</p>
      </div>

      {(view && (view.soldTotal ?? 0) > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t("robo.auto.sold")} value={fmt(view.soldTotal ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(view.goldTotal ?? 0)} accent="var(--yellow)" icon={<Coin size={11} />} />
          <StatTile label={t("robo.auto.lastSweep")} value={hhmm(view.lastSweepAt)} icon={<Clock size={11} className="text-text-dim" />} />
        </div>
      )}

      <div className="card p-4">
        {sold.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{on ? t("robo.pokesold.waiting") : t("robo.pokesold.empty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[0.72rem]">
              <span className="text-text-dim">{t("robo.pokesold.count").replace("{n}", String(sold.length))}</span>
            </div>
            <div className="grid max-h-[32rem] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {sold.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={34} />
                    {p.shiny && <span className="absolute right-0 top-0 text-yellow"><Star size={9} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm">{p.name}</span>
                      <span className="shrink-0 text-[0.6rem] text-text-dim">Lv{p.level}</span>
                      <span className="shrink-0 rounded px-1 text-[0.5rem] font-bold uppercase" style={{ background: RARITY_COLOR[p.rarity], color: "#06111a" }}>{p.rarity}</span>
                    </div>
                    <div className="text-[0.6rem] text-text-dim">IV {p.ivTotal} · Q {p.quality.toFixed(2)}{p.at ? ` · ${hhmm(p.at)}` : ""}</div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[0.66rem] text-yellow"><Coin size={9} />{fmt(p.sellValue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
