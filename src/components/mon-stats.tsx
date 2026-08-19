"use client";

// Stats REAIS de um pokemon individual (anuncio do mercado, time ou box) — nao os base
// da especie. Com bases+nivel+qualidade em maos, cada barra compara com o stat PERFEITO
// (IV 32) do mesmo nivel/qualidade e mostra o IV estimado por stat; sem bases, a barra
// normaliza pelo maior stat do proprio bicho. Reusa StatCompareRow/StatBar (fonte unica
// de layout de stat) e a formula verificada de stats.ts.

import { STAT_KEYS, STAT_LABELS, projectStat, estimateIv } from "@/lib/stats";
import type { MonStats } from "@/lib/game-account";
import type { MarketDex } from "./market-advisor";
import { TypeBadges, RarityBadge, QualityBadge } from "./badges";
import { StatBar, StatCompareRow } from "./stat-bar";
import { StatTile } from "./stat-tile";
import { Modal } from "./modal";
import { CloseButton } from "./icon-button";
import { Sprite } from "./sprite";
import { spriteUrl } from "@/lib/sprites";
import { Star } from "./icons";
import { useT } from "./locale-provider";

const IV_MAX = 32;

// Mesmas faixas do ivColor do total (150/192 e 100/192), na escala de 1 stat (0..32).
const ivClass = (iv: number) => (iv >= 25 ? "text-green" : iv >= 16.7 ? "text-yellow" : "text-text");

/** Bloco de stats de UM pokemon. Cobre os tres casos que o site tem, pra nenhum
 *  chamador precisar reimplementar o fallback:
 *   - stats do individuo + bases + quality -> barra compara com o perfeito (IV 32) e
 *     mostra o IV estimado de cada stat;
 *   - stats do individuo sem bases/quality -> barra simples entre os proprios stats;
 *   - SEM stats (so o catalogo) -> stats BASE da especie, com o titulo trocado. */
export function MonStatsSection({
  stats, bases, level, quality,
}: {
  stats: MonStats | null;
  bases?: number[] | null; // 6 stats base na ordem STAT_KEYS (do catalogo da especie)
  level: number;
  quality: number | null;
}) {
  const t = useT();
  const speciesOnly = !stats;
  const shown: number[] = stats ? STAT_KEYS.map((k) => stats[k]) : (bases ?? []);
  if (!stats && shown.length !== 6) return null;
  const values = shown;
  const total = values.reduce((a, b) => a + b, 0);
  const canCompare = !!stats && !!bases && bases.length === 6 && quality != null && level > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="section-title">{t(speciesOnly ? "cr.statsBase" : "mon.stats.title")}</div>
      {canCompare
        ? STAT_KEYS.map((k, i) => {
            const perfect = projectStat(bases![i], IV_MAX, level, quality!, i);
            const iv = Math.min(IV_MAX, Math.max(0, estimateIv(bases![i], stats![k], level, quality!, i)));
            return (
              <StatCompareRow key={k} iconIndex={i} label={STAT_LABELS[i]} value={stats![k]}
                max={perfect} iv={iv} ivMax={IV_MAX} ivClass={ivClass(iv)} />
            );
          })
        : STAT_KEYS.map((k, i) => (
            <StatBar key={k} iconIndex={i} label={STAT_LABELS[i]} value={values[i]}
              max={Math.max(...values)} best={values[i] === Math.max(...values)} />
          ))}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-sm uppercase tracking-wide text-text-dim">{t("cr.total")}</span>
        <strong className="tabular-nums text-cyan">{total.toLocaleString("pt-BR")}</strong>
      </div>
      {canCompare && <p className="text-xs leading-relaxed text-text-dim">{t("mon.stats.hint")}</p>}
    </div>
  );
}

// O minimo que o modal precisa de um pokemon PROPRIO (LiveTeamPoke e ActivePoke servem).
export interface OwnedMonView {
  speciesId: number;
  name: string;
  level: number;
  shiny: boolean;
  ivTotal: number;
  quality: number;
  power: number;
  stats: MonStats;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Modal de stats de um pokemon SEU (time ou box): cabecalho + Power/IV/Q + stats reais.
 *  `dex` (catalogo da especie) habilita tipos/raridade e a comparacao vs perfeito. */
export function PokeStatsModal({
  poke, dex, onClose,
}: {
  poke: OwnedMonView;
  dex?: MarketDex | null;
  onClose: () => void;
}) {
  const t = useT();
  const bases = dex ? [dex.baseHp, dex.baseAtk, dex.baseDef, dex.baseSpAtk, dex.baseSpDef, dex.baseSpeed] : null;
  return (
    // p-4 na base: a 360px o modal ja perde 32px pro overlay, e o p-5 deixava a
    // regua de stats com trilho de ~70px
    <Modal onClose={onClose} className="w-full max-w-md gap-5 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
          <Sprite src={spriteUrl(poke.speciesId, poke.shiny)} alt={poke.name} size={72} />
          {poke.shiny && <span className="absolute right-1 top-1 text-yellow"><Star size={16} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate pixel text-base text-text">{poke.name}</h3>
            <span className="text-sm text-text-dim">Lv.{poke.level}</span>
          </div>
          {dex && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <TypeBadges t1={dex.type1} t2={dex.type2} />
              {/* o jogo rotula o INDIVIDUO pela quality; sem ela, sobra a da especie */}
              {poke.quality != null ? <QualityBadge quality={poke.quality} /> : <RarityBadge rarity={dex.rarity} />}
            </div>
          )}
        </div>
        {/* 16px: o X e a acao do cabecalho do modal — no default de 12 o traco sumia */}
        <CloseButton onClick={onClose} size={16} className="shrink-0 self-start" />
      </div>
      {/* 2 colunas no celular: a 360px as tres calhas davam ~67px de conteudo e o
          Power de 7 digitos quebrava em tres linhas dentro do tile */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label={t("account.col.power")} value={<span className="text-yellow">{fmt(poke.power)}</span>} />
        <StatTile label={t("account.col.iv")} value={<><span className={poke.ivTotal >= 150 ? "text-green" : poke.ivTotal >= 100 ? "text-yellow" : "text-text"}>{poke.ivTotal}</span><span className="text-sm text-text-dim">/192</span></>} />
        <StatTile label={t("account.col.quality")} value={<span className="text-cyan">{poke.quality.toFixed(3)}</span>} />
      </div>
      <MonStatsSection stats={poke.stats} bases={bases} level={poke.level} quality={poke.quality} />
    </Modal>
  );
}
