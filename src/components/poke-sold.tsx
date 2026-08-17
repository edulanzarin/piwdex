"use client";

// Pokemon vendidos NA HUNT ATUAL (read-only): um card por especie (icone+nome+raridade + qtd
// + valor). Mesmo vendendo o mesmo bicho varias vezes, so soma; reseta ao trocar de hunt. O
// total acumulado de todas as hunts fica na aba Estatisticas. Vive na aba Hunt. Poll 5s.

import { useCallback, useEffect, useState } from "react";
import { Sprite } from "./sprite";
import { RarityBadge } from "./badges";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin } from "./icons";
import type { Rarity } from "@/lib/types";

interface SpeciesSold { speciesId: number; name: string; rarity: Rarity; count: number; gold: number }
interface AutoView { status: string; soldBySpecies?: SpeciesSold[] }

const fmt = (n: number) => n.toLocaleString("pt-BR");

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
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);

  const sold = (view?.soldBySpecies ?? []).slice().sort((a, b) => b.count - a.count);
  const on = view?.status === "running" || view?.status === "connecting";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-green"><Coin size={14} /> {t("robo.pokesold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokesold.desc")}</p>
      </div>

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
