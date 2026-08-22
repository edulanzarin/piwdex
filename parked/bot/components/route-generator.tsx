"use client";

import { useEffect, useMemo, useState } from "react";
import { spriteUrl } from "@/lib/sprites";
import { Sprite } from "./sprite";
import { LoadingBall } from "./loaders";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges } from "./badges";
import { TypeIcon } from "./type-icon";
import { ToggleButton } from "./toggle-button";
import { Coin, Diamond, Xp, ChevronRight } from "./icons";
import { useT, useTypeLabel } from "./locale-provider";
import { TYPE_COLOR } from "@/lib/typing";
import { STAT_LABELS, estimateIvs, powerOf } from "@/lib/stats";
import { StatIcon } from "./stat-icons";
import { buildRoute, RISK_COLOR, SIM_IV, type Species, type EnemyCombat, type RouteStep, type RouteMode } from "@/lib/combat";

const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
};
const numI = (s: string) => parseInt(s, 10);
const numF = (s: string) => parseFloat(String(s).replace(",", "."));
const area = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const effLabel = (m: number) => (Number.isInteger(m) ? `${m}x` : `${+m.toFixed(2)}x`);
const SIM_IVS = Array<number>(6).fill(SIM_IV);

function StatIn({ label, value, onChange, iconIndex }: { label: string; value: string; onChange: (v: string) => void; iconIndex: number }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {/* min-w-0 + truncate: em 360px a coluna e estreita e "SP.ATK" com o icone de
          14 nao pode esticar a grade (a pagina nunca rola na horizontal) */}
      <span className="field-label inline-flex min-w-0 items-center gap-1">
        <StatIcon index={iconIndex} size={14} /><span className="truncate">{label}</span>
      </span>
      <input className="input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function RouteGenerator({ species, enemies }: { species: Species[]; enemies: EnemyCombat[] }) {
  const t = useT();
  const typeLabel = useTypeLabel();
  const [pick, setPick] = useState<ComboCreature | null>(null);
  const [level, setLevel] = useState("");
  const [target, setTarget] = useState("");
  const [quality, setQuality] = useState("1");
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [vip, setVip] = useState(false);
  const [mode, setMode] = useState<RouteMode>("xp");
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<RouteStep[] | null>(null);

  const byId = useMemo(() => {
    const m = new Map<number, Species>();
    for (const s of species) m.set(s.pokeId, s);
    return m;
  }, [species]);
  const combo: ComboCreature[] = useMemo(
    () => species.map((s) => ({ pokeId: s.pokeId, name: s.name, type1: s.t1, type2: s.t2 })).sort((a, b) => a.name.localeCompare(b.name)),
    [species],
  );

  const picked = pick ? byId.get(pick.pokeId) ?? null : null;
  const lvl = numI(level);
  const tgt = numI(target);
  const qual = Number.isFinite(numF(quality)) && numF(quality) > 0 ? numF(quality) : 1;
  const statVals = stats.map(numF);
  const statsReady = picked != null && Number.isFinite(lvl) && lvl > 0 && statVals.every((v) => Number.isFinite(v) && v > 0);
  // Stats sao obrigatorios: sem eles nao da pra medir a forca real do pokemon.
  const canCalc = statsReady && Number.isFinite(tgt) && tgt > lvl;

  const ivInfo = useMemo(() => {
    if (statsReady && picked) {
      const e = estimateIvs(picked.bases, statVals, lvl, qual);
      return { ivs: e.ivs, total: e.total as number | null, power: powerOf(statVals, qual) as number | null };
    }
    return { ivs: SIM_IVS, total: null as number | null, power: null as number | null };
  }, [statsReady, picked, statVals, lvl, qual]);

  // Muda qualquer entrada -> some o resultado (forca recalcular).
  const statsKey = stats.join(",");
  useEffect(() => { setResult(null); }, [pick, level, target, quality, statsKey, vip, mode]);

  const calc = () => {
    if (!canCalc || !picked) return;
    setComputing(true);
    // pequeno atraso pra mostrar o loader (o calculo em si e instantaneo).
    window.setTimeout(() => {
      // golpes do wild saem do proprio catalogo de especies (o alvo nao os carrega:
      // seriam ~120KB a mais no payload da pagina)
      const movesOf = (pokeId: number) => byId.get(pokeId)?.moves ?? [];
      setResult(buildRoute(picked, lvl, tgt, enemies, movesOf, qual, ivInfo.ivs, mode, vip));
      setComputing(false);
    }, 650);
  };

  const setStat = (i: number, v: string) => setStats((p) => p.map((s, j) => (j === i ? v : s)));
  const fillBase = () => { if (picked) setStats(picked.bases.map(String)); };

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="field-label">{t("hunt.route.pokemon")}</span>
            <PokemonCombobox creatures={combo} value={pick} onSelect={setPick} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("hunt.route.level")}</span>
            <input className="input" inputMode="numeric" placeholder="ex: 54" value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">{t("hunt.route.quality")}</span>
            <input className="input" inputMode="decimal" placeholder="ex: 1,8" value={quality} onChange={(e) => setQuality(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          {/* header de altura fixa: o botao "usar base" tem slot permanente e so
              habilita quando ha pokemon — o bloco de stats nao muda de altura */}
          <div className="mb-2 flex h-9 items-center justify-between gap-2">
            <span className="field-label">{t("hunt.route.statsOpt")}</span>
            <button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" onClick={fillBase} disabled={!picked}>{t("hunt.route.useBase")}</button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {STAT_LABELS.map((lb, i) => (
              <StatIn key={lb} iconIndex={i} label={lb} value={stats[i]} onChange={(v) => setStat(i, v)} />
            ))}
          </div>
          {/* IV/Power: linha SEMPRE renderizada — sem stats completos os slots ficam
              esmaecidos com "—" no mesmo lugar (nada aparece do nada) */}
          <div className="mt-3 flex h-6 items-center gap-x-4 overflow-x-auto sm:gap-x-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-sm uppercase tracking-wide text-text-dim">{t("hunt.route.ivTotal")} <span className={`pixel ml-1 text-base tabular-nums ${ivInfo.total != null ? "text-green" : "slot-empty"}`}>{ivInfo.total != null ? ivInfo.total.toFixed(1) : "—"}</span></span>
            <span className="shrink-0 text-sm uppercase tracking-wide text-text-dim">{t("hunt.route.power")} <span className={`pixel ml-1 text-base tabular-nums ${ivInfo.power != null ? "text-yellow" : "slot-empty"}`}>{ivInfo.power != null ? ivInfo.power.toLocaleString("pt-BR") : "—"}</span></span>
          </div>
        </div>

        {/* Nivel alvo + prioridade + VIP + calcular */}
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <label className="flex flex-col gap-1">
              <span className="field-label text-cyan">{t("hunt.route.target")}</span>
              <input className="input w-28" inputMode="numeric" placeholder="ex: 200" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>

            <div className="flex flex-col gap-1">
              <span className="field-label">{t("hunt.route.priority")}</span>
              <div className="flex gap-1.5">
                <ToggleButton active={mode === "xp"} onClick={() => setMode("xp")} accent="green">
                  <Xp size={16} /> {t("hunt.route.priorityXp")}
                </ToggleButton>
                <ToggleButton active={mode === "gold"} onClick={() => setMode("gold")} accent="yellow">
                  <Coin size={16} /> {t("hunt.route.priorityGold")}
                </ToggleButton>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="field-label">VIP</span>
              <ToggleButton active={vip} onClick={() => setVip((v) => !v)} accent="cyan">
                <Diamond size={16} /> {t("hunt.vip")}
              </ToggleButton>
            </div>
          </div>

          {/* min-w segura a largura quando o rotulo troca pra "calculando" */}
          <button
            type="button"
            onClick={calc}
            disabled={!canCalc || computing}
            className="btn btn-yellow min-w-[11rem] self-start disabled:opacity-40 lg:self-auto"
          >
            {computing ? `${t("hunt.route.calcing")}...` : <>{t("hunt.route.calc")} <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* area de resultado: os estados (calculando/vazio/pronto) dividem a mesma
          altura minima — alternar nao encolhe a pagina de supetao */}
      {computing ? (
        <div className="card flex min-h-[11rem] items-center justify-center"><LoadingBall label={t("hunt.route.calcing")} /></div>
      ) : !result ? (
        <div className="card flex min-h-[11rem] items-center justify-center p-10 text-center text-text-dim">{canCalc ? t("hunt.route.hitCalc") : t("hunt.route.pick")}</div>
      ) : result.length === 0 ? (
        <div className="card flex min-h-[11rem] items-center justify-center p-10 text-center text-text-dim">{t("hunt.route.empty")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {result.map((step) => {
            const e = step.enemy;
            const est = step.est;
            const th = est.threat;
            return (
              <div key={`${step.from}-${e.pokeId}`} className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <span className="pixel text-sm text-cyan lg:w-24 lg:shrink-0">{t("hunt.route.band", { a: step.from, b: step.to })}</span>

                <div className="flex flex-1 items-center gap-3 border-t border-border/50 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <span className="text-sm uppercase tracking-wide text-text-dim">{t("hunt.route.hunt")}</span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--well-bg)]">
                    <Sprite src={spriteUrl(e.pokeId)} alt={e.name} size={34} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-text">{e.name}</span>
                      <span className="text-sm uppercase tracking-wide text-text-dim">{e.areas.map(area).join(", ")} · lvl {e.huntLevel}</span>
                    </span>
                    <TypeBadges t1={e.t1} t2={e.t2} />
                  </span>
                </div>

                {/* Os DOIS lados do combate na mesma coluna: em cima o seu golpe, embaixo
                    o que ELE faz com voce. Ler so a linha de cima e como o motor mandava
                    um Abra de 9 de HP pro Gastly. */}
                <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3 lg:w-44 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div className="flex items-center gap-2" title={t("hunt.effHint")}>
                    <span className="chip inline-flex items-center gap-1" style={{ background: TYPE_COLOR[est.moveName], color: "#fff" }}>
                      <TypeIcon type={est.moveName} size={14} /> {typeLabel(est.moveName)}
                    </span>
                    <span className={`pixel text-base ${est.eff >= 2 ? "text-green" : est.eff > 1 ? "text-cyan" : "text-text-dim"}`}>{effLabel(est.eff)}</span>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    title={th.moveType
                      ? t("hunt.route.riskHint", { name: e.name, type: typeLabel(th.moveType), eff: effLabel(th.eff), dmg: th.hitDmg, n: th.killsPerLife })
                      : t("hunt.route.noThreat", { name: e.name })}
                  >
                    <span className="text-xs uppercase tracking-wide text-text-dim">{t("hunt.route.takes")}</span>
                    {th.moveType ? (
                      <span className="inline-flex items-center gap-1 text-text-dim">
                        <TypeIcon type={th.moveType} size={14} />
                        <span className="tabular-nums text-sm">{effLabel(th.eff)}</span>
                      </span>
                    ) : null}
                    <span className="pixel text-sm" style={{ color: RISK_COLOR[th.risk] }}>{t(`hunt.route.${th.risk}`)}</span>
                  </div>
                </div>

                {/* Tres metricas numa faixa estreita. `truncate` sozinho NAO segura o
                    rotulo: dentro de um `items-end` o span fica com largura de conteudo e
                    vaza pra CELULA VIZINHA — era o "DOLARES/H" montando em cima do
                    "XP/H". Quem corta e o `w-full`, que da ao truncate uma borda contra a
                    qual cortar. A faixa tambem ganhou 64px pra o rotulo mais longo caber
                    inteiro em vez de virar reticencia. */}
                <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-right lg:w-72 lg:shrink-0 lg:gap-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="w-full truncate text-right text-xs uppercase tracking-wide text-text-dim" title={t("hunt.col.kosh")}>{t("hunt.col.kosh")}</span>
                    <span className="tabular-nums text-sm text-cyan">{compact(est.kosH)}</span>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="inline-flex w-full min-w-0 items-center justify-end gap-1 text-xs uppercase tracking-wide text-text-dim" title={t("hunt.col.xph")}>
                      <Xp size={14} /><span className="truncate">{t("hunt.col.xph")}</span>
                    </span>
                    <span className="tabular-nums text-sm text-green">{compact(est.xpH)}</span>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="w-full truncate text-right text-xs uppercase tracking-wide text-text-dim" title={t("hunt.col.goldh")}>{t("hunt.col.goldh")}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-sm text-green"><Coin size={14} />{compact(est.goldH)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="mt-1 text-sm leading-relaxed text-text-dim">{t("hunt.route.estimate")}</p>
        </div>
      )}
    </div>
  );
}
