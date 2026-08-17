"use client";

// Pokemon vendidos (read-only). Dois blocos:
//  1) totalizador CUMULATIVO (pra sempre, todas as hunts) — /api/vip/totals.
//  2) um card POR ESPECIE vendida NA HUNT atual (icone+nome+raridade + qtd + valor). Mesmo
//     vendendo o mesmo bicho varias vezes, so soma. Reseta ao trocar de hunt — /api/vip/autosell.

import { useCallback, useEffect, useState } from "react";
import { Sprite } from "./sprite";
import { StatTile } from "./stat-tile";
import { RarityBadge } from "./badges";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin } from "./icons";
import type { Rarity } from "@/lib/types";

interface SpeciesSold { speciesId: number; name: string; rarity: Rarity; count: number; gold: number }
interface AutoView { status: string; soldBySpecies?: SpeciesSold[] }
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

  const sold = (view?.soldBySpecies ?? []).slice().sort((a, b) => b.count - a.count);
  const on = view?.status === "running" || view?.status === "connecting";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-green"><Coin size={14} /> {t("robo.pokesold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokesold.desc")}</p>
      </div>

      {/* totalizador cumulativo — nunca reseta */}
      <div className="card p-4">
        <h3 className="section-title mb-3 text-cyan">{t("robo.total.title")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t("robo.auto.sold")} value={fmt(tot?.pokesCount ?? 0)} icon={<Coin size={11} className="text-text-dim" />} />
          <StatTile label={t("robo.auto.gold")} value={fmt(tot?.pokesGold ?? 0)} accent="var(--green)" icon={<Coin size={11} />} />
        </div>
      </div>

      {/* cards por especie vendida (da hunt atual) */}
      <div className="card p-4">
        {sold.length === 0 ? (
          <p className="text-[0.72rem] text-text-dim">{on ? t("robo.pokesold.waiting") : t("robo.pokesold.empty")}</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {sold.map((p) => (
              <div key={p.speciesId} className="flex items-center gap-2.5 rounded border border-border bg-[var(--well-bg)] p-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                  <Sprite src={spriteUrl(p.speciesId)} alt={p.name} size={34} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm">{p.name}</span>
                    <RarityBadge rarity={p.rarity} />
                  </div>
                  <div className="text-[0.62rem] text-text-dim">×{fmt(p.count)}</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] text-green tabular-nums"><Coin size={10} />{fmt(p.gold)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
