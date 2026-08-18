"use client";

// Pokemon vendidos NA HUNT ATUAL (read-only): um card por especie (icone+nome+raridade + qtd
// + valor). Mesmo vendendo o mesmo bicho varias vezes, so soma; reseta ao trocar de hunt. O
// total acumulado de todas as hunts fica na aba Estatisticas. Vive na aba Hunt.
// Dados direto do stream ao vivo (useVipLive), sem fetch.

import { Sprite } from "./sprite";
import { RarityBadge } from "./badges";
import { spriteUrl } from "@/lib/sprites";
import { useT } from "./locale-provider";
import { Coin } from "./icons";
import { useVipLive } from "./vip-live";
import type { Rarity } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function PokeSold() {
  const t = useT();
  const { autosell } = useVipLive();

  const sold = (autosell?.soldBySpecies ?? []).slice().sort((a, b) => b.count - a.count);
  const on = autosell?.status === "running" || autosell?.status === "connecting";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-green"><Coin size={14} /> {t("robo.pokesold.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokesold.desc")}</p>
      </div>

      <div className="card p-4">
        {sold.length === 0 ? (
          <p className="text-base text-text-dim">{on ? t("robo.pokesold.waiting") : t("robo.pokesold.empty")}</p>
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
                    <RarityBadge rarity={p.rarity as Rarity} />
                  </div>
                  <div className="text-sm text-text-dim">×{fmt(p.count)}</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-base text-green tabular-nums"><Coin size={10} />{fmt(p.gold)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
