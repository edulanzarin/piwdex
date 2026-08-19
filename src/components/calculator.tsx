"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import { estimateIvs, powerOf, projectAll, STAT_LABELS } from "@/lib/stats";
import { Sprite } from "./sprite";
import { TypeBadges } from "./badges";
import { StatIcon } from "./stat-icons";
import { StatCompareRow, CMP_SLOT } from "./stat-bar";
import { Coin, Xp, ChevronRight } from "./icons";
import { Tabs } from "./tabs";
import { StatTile } from "./stat-tile";
import { PokemonCombobox } from "./pokemon-combobox";
import { useT } from "./locale-provider";

const EEVEE_ID = 133;

export interface CalcCreature {
  pokeId: number;
  name: string;
  type1: PokeType;
  type2: PokeType | null;
  bases: number[]; // hp, atk, def, spAtk, spDef, speed
  rarity: string;
  xp: number; // XP por kill
  goldEV: number; // ouro esperado por kill
}

const num = (s: string): number => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

const IV_MAX_TOTAL = 192; // 32 por stat x 6
const IV_MAX = 32; // por stat
// Abaixo deste nivel os stats do jogo sao pequenos e muito arredondados: inverter a
// formula pra achar o IV fica impreciso (um mesmo stat cabe varios IVs). ~20 estabiliza.
const LOW_LEVEL = 20;

// Cor do IV por stat (0..32): verde ja bom, amarelo mediano, vermelho ruim.
const ivColor = (v: number) => (v >= 26 ? "text-green" : v >= 14 ? "text-yellow" : "text-red");

// Perfil a partir dos stats base (chaves de traducao).
function analyze(bases: number[]) {
  const [hp, atk, def, spa, spd, spe] = bases;
  const roles: string[] = [];
  if (atk >= spa + 12) roles.push("calc.role.phys");
  else if (spa >= atk + 12) roles.push("calc.role.spec");
  else roles.push("calc.role.mixed");
  const bulk = hp + def + spd;
  if (bulk >= 300) roles.push("calc.role.tank");
  else if (bulk <= 210) roles.push("calc.role.frail");
  if (spe >= 105) roles.push("calc.role.fast");
  else if (spe <= 50) roles.push("calc.role.slow");
  const maxI = bases.indexOf(Math.max(...bases));
  const minI = bases.indexOf(Math.min(...bases));
  return { roles, maxI, minI, bst: bases.reduce((a, b) => a + b, 0) };
}

function Field({
  label, value, onChange, placeholder, iconIndex,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; iconIndex?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="field-label inline-flex items-center gap-1">
        {iconIndex != null && <StatIcon index={iconIndex} size={14} />}{label}
      </span>
      <input className="input" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// Linha de comparacao vazia: MESMAS larguras/altura da StatCompareRow, valores em
// placeholder — o resultado preenche sem mudar nada de lugar.
function CompareRowEmpty({ label, iconIndex }: { label: string; iconIndex: number }) {
  return (
    <div className="flex items-center gap-2 text-base">
      <span className={`inline-flex ${CMP_SLOT.label} shrink-0 items-center gap-1 text-text-dim`}>
        <StatIcon index={iconIndex} size={16} />{label}
      </span>
      <div className="statbar flex-1" />
      <span className={`slot-empty ${CMP_SLOT.value} shrink-0 text-right tabular-nums`}>—</span>
      <span className={`slot-empty ${CMP_SLOT.iv} shrink-0 text-right tabular-nums`}>—</span>
    </div>
  );
}

export function Calculator({ creatures }: { creatures: CalcCreature[] }) {
  const t = useT();
  const [creature, setCreature] = useState<CalcCreature | null>(null);
  const [level, setLevel] = useState("");
  const [quality, setQuality] = useState("");
  const [stats, setStats] = useState<string[]>(["", "", "", "", "", ""]);
  const [target, setTarget] = useState("");

  const lvl = num(level);
  const qual = num(quality);
  const statVals = stats.map(num);
  const statsReady = statVals.every((v) => Number.isFinite(v) && v > 0);
  const baseReady = creature && Number.isFinite(lvl) && lvl > 0 && Number.isFinite(qual) && qual > 0;

  const canCalc = Boolean(baseReady) && statsReady;

  // Resultado (IVs + poder) so aparece ao clicar Calcular.
  const [computing, setComputing] = useState(false);
  const [res, setRes] = useState<{ ivs: number[]; total: number; power: number } | null>(null);
  const statsKey = stats.join(",");
  useEffect(() => { setRes(null); }, [statsKey, level, quality, creature?.pokeId]);

  const calc = () => {
    if (!canCalc || !creature) return;
    setComputing(true);
    window.setTimeout(() => {
      const e = estimateIvs(creature.bases, statVals, lvl, qual);
      setRes({ ivs: e.ivs, total: e.total, power: powerOf(statVals, qual) });
      setComputing(false);
    }, 400);
  };

  const iv = res ? { ivs: res.ivs, total: res.total } : null;
  const currentPower = res?.power ?? null;

  // Projecao pro nivel alvo, reativa a partir dos IVs ja calculados.
  const tgt = num(target);
  const projection = useMemo(() => {
    if (!res || !creature || !Number.isFinite(tgt) || tgt <= 0) return null;
    return projectAll(creature.bases, res.ivs, tgt, qual);
  }, [res, creature, tgt, qual]);

  // "Perfeito" projetado no MESMO nivel alvo (IV 32 em tudo) — pro card dividido.
  const perfectProjection = useMemo(() => {
    if (!res || !creature || !Number.isFinite(tgt) || tgt <= 0) return null;
    return projectAll(creature.bases, Array<number>(6).fill(32), tgt, qual);
  }, [res, creature, tgt, qual]);

  // "Perfeito": mesmo pokemon com IV maximo (32 em tudo) no mesmo nivel/qualidade.
  const perfect = useMemo(() => {
    if (!res || !creature) return null;
    return projectAll(creature.bases, Array<number>(6).fill(32), lvl, qual);
  }, [res, creature, lvl, qual]);

  const isEevee = creature?.pokeId === EEVEE_ID;
  const profile = creature ? analyze(creature.bases) : null;
  const [tab, setTab] = useState<"analise" | "projetar">("analise");

  const setStat = (i: number, v: string) =>
    setStats((prev) => prev.map((s, j) => (j === i ? v : s)));

  // comparacao completa so quando tudo calculado
  const cmpReady = Boolean(res && iv && perfect && creature);

  return (
    <div className="flex flex-col gap-5">
      {/* Selecao + nivel + qualidade */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="well flex h-24 w-24 items-center justify-center p-0">
              <Sprite src={creature ? spriteUrl(creature.pokeId) : null} alt={creature?.name ?? ""} size={80} />
            </div>
            {/* slot dos tipos: reservado mesmo sem pokemon escolhido */}
            <div className="flex min-h-[1.35rem] items-center justify-center">
              {creature ? <TypeBadges t1={creature.type1} t2={creature.type2} /> : <span className="slot-empty text-sm">—</span>}
            </div>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">{t("calc.pokemon")}</span>
              <PokemonCombobox creatures={creatures} value={creature} onSelect={setCreature} />
            </label>
            <Field label={t("calc.level")} value={level} onChange={setLevel} placeholder="ex: 58" />
            <Field label={t("calc.quality")} value={quality} onChange={setQuality} placeholder="ex: 1,8" />
          </div>
        </div>
      </div>

      {Number.isFinite(lvl) && lvl > 0 && lvl < LOW_LEVEL && (
        <div className="rounded border-l-2 border-yellow bg-[color:var(--yellow)]/10 px-4 py-3 text-base leading-relaxed text-text-dim">
          <span className="pixel mr-1 text-sm text-yellow">!</span>{t("calc.lowLevel")}
        </div>
      )}

      {isEevee ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <p className="max-w-sm text-sm text-text-dim">{t("calc.eeveeHint")}</p>
          <Link href="/eevee" className="btn btn-cyan">
            {t("eevee.open")} <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
      <>{/* resto da ferramenta so quando nao for Eevee */}

      {/* Stats atuais (acima das abas — o Calcular gera analise E projecao) */}
      <div className="card p-5">
        <h2 className="section-title mb-3 text-cyan">{t("calc.currentStats")}</h2>
        <p className="mb-4 text-sm text-text-dim">{t("calc.currentHint")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_LABELS.map((label, i) => (
            <Field key={label} iconIndex={i} label={label} value={stats[i]} onChange={(v) => setStat(i, v)} />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-sm leading-relaxed text-text-dim">{t("calc.ivExplain")}</p>
          <button
            type="button"
            onClick={calc}
            disabled={!canCalc || computing}
            className="btn btn-cyan shrink-0 self-start disabled:opacity-40 sm:self-auto"
          >
            {computing ? `${t("calc.calcing")}...` : <>{t("calc.calcBtn")} <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>

      {/* Abas */}
      <Tabs
        accent="var(--purple)"
        active={tab}
        onChange={(k) => setTab(k as "analise" | "projetar")}
        tabs={[
          { key: "analise", label: t("calc.tab.analise"), icon: <StatIcon index={0} size={16} /> },
          { key: "projetar", label: t("calc.tab.projetar"), icon: <Xp size={16} /> },
        ]}
      />

      {tab === "analise" ? (
      <>
      {/* Perfil / analise a partir do base: card SEMPRE presente, slots vazios antes
          de escolher o pokemon — mesmas dimensoes com e sem dado */}
      <div className="card p-5">
        <h2 className="section-title mb-3 text-yellow">{t("calc.profile")}</h2>
        {/* trilho rolavel: a fila de papeis NUNCA quebra linha — a altura da faixa e a
            mesma com um, tres ou nenhum papel */}
        <div className="flex min-h-[1.85rem] flex-nowrap items-center gap-2 overflow-x-auto">
          {profile ? (
            profile.roles.map((r) => (
              <span key={r} className="chip shrink-0" style={{ background: "var(--surface-2)", color: "var(--text)" }}>{t(r)}</span>
            ))
          ) : (
            <span className="slot-empty text-sm">—</span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t("calc.strongStat")} icon={profile ? <StatIcon index={profile.maxI} size={14} /> : undefined} accent="var(--green)" value={profile ? STAT_LABELS[profile.maxI] : <span className="slot-empty">—</span>} />
          <StatTile label={t("calc.weakStat")} icon={profile ? <StatIcon index={profile.minI} size={14} /> : undefined} accent="var(--red)" value={profile ? STAT_LABELS[profile.minI] : <span className="slot-empty">—</span>} />
          <StatTile label={t("calc.xpKill")} icon={<Xp size={14} className="text-cyan" />} accent="var(--cyan)" value={creature ? creature.xp.toLocaleString("pt-BR") : <span className="slot-empty">—</span>} />
          <StatTile label={t("calc.goldKill")} icon={<Coin />} accent="var(--green)" value={creature ? creature.goldEV.toLocaleString("pt-BR") : <span className="slot-empty">—</span>} />
        </div>
        <p className="mt-3 text-sm text-text-dim">{t("calc.bst")} <span className={`pixel ml-1 text-base ${profile ? "text-cyan" : "slot-empty"}`}>{profile ? profile.bst : "—"}</span></p>
      </div>

      {/* Resultado: IVs estimados — grade SEMPRE presente, placeholder ate calcular */}
      <div className="card p-5">
        <h2 className="section-title text-green">{t("calc.ivEstimated")}</h2>
        {/* linha de status: um estado por vez no mesmo slot */}
        <p className="mt-3 min-h-[1.35rem] text-sm text-text-dim">
          {computing ? `${t("calc.calcing")}...` : iv ? "" : canCalc ? t("calc.hitCalc") : t("calc.fillStats")}
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STAT_LABELS.map((label, i) => (
              <div key={label} className="well">
                <div className="field-label inline-flex items-center gap-1"><StatIcon index={i} size={14} />{label}</div>
                <div className={`tabular-nums text-lg ${iv ? (iv.ivs[i] > IV_MAX ? "text-red" : "text-text") : "slot-empty"}`}>{iv ? iv.ivs[i].toFixed(1) : "—"}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            {/* tres slots em GRADE: numero grande (poder de 6 digitos) nao reflui a
                linha nem muda a altura do card, como fazia o flex-wrap */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="field-label">{t("calc.ivTotal")}</div>
                <div className={`pixel text-base ${iv ? "text-green" : "slot-empty"}`}>{iv ? <>{iv.total.toFixed(0)}<span className="text-text-dim">/{IV_MAX_TOTAL}</span></> : `—/${IV_MAX_TOTAL}`}</div>
              </div>
              <div>
                <div className="field-label">{t("calc.ivUsage")}</div>
                <div className={`pixel text-base ${iv ? "text-cyan" : "slot-empty"}`}>{iv ? `${Math.round((iv.total / IV_MAX_TOTAL) * 100)}%` : "—"}</div>
              </div>
              <div>
                <div className="field-label">{t("calc.power")}</div>
                <div className={`pixel text-base ${currentPower != null ? "text-yellow" : "slot-empty"}`}>{currentPower != null ? currentPower.toLocaleString("pt-BR") : "—"}</div>
              </div>
            </div>
            {/* barra de aproveitamento */}
            <div className="statbar">
              <div className="statbar-fill" style={{ width: `${iv ? Math.min(100, (iv.total / IV_MAX_TOTAL) * 100) : 0}%`, background: "var(--green)" }} />
            </div>
            {iv && iv.ivs.some((v) => v > IV_MAX) && (
              <p className="text-sm text-red">{t("calc.ivOver")}</p>
            )}
            <p className="text-sm text-text-dim">{t("calc.ivMaxNote")}</p>
          </div>
        </div>
      </div>

      {/* Seu vs perfeito — estrutura fixa, linhas em placeholder ate o calculo */}
      <div className="card p-5">
        <h2 className="section-title mb-1 text-yellow">{t("calc.compare")}</h2>
        <p className="mb-4 text-sm leading-relaxed text-text-dim">{t("calc.compareHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Seu */}
          <div className="well p-3 sm:p-4" style={{ borderColor: "var(--cyan)" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="pixel min-w-0 truncate text-sm text-cyan" title={creature?.name ?? undefined}>{t("calc.compareYou", { name: creature?.name ?? "—" })}</span>
              <span className={`shrink-0 text-sm tabular-nums ${iv ? "text-text-dim" : "slot-empty"}`}>{iv ? `${iv.total.toFixed(0)}/${IV_MAX_TOTAL} · ${Math.round((iv.total / IV_MAX_TOTAL) * 100)}%` : `—/${IV_MAX_TOTAL}`}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {STAT_LABELS.map((lb, i) => (
                cmpReady && res && perfect
                  ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={statVals[i]} max={perfect.stats[i]} iv={res.ivs[i]} ivClass={ivColor(res.ivs[i])} />
                  : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.power")} <span className={`pixel ml-1 text-base ${currentPower != null ? "text-yellow" : "slot-empty"}`}>{currentPower != null ? currentPower.toLocaleString("pt-BR") : "—"}</span></div>
          </div>
          {/* Perfeito */}
          <div className="well p-3 sm:p-4" style={{ borderColor: "var(--green)" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="pixel min-w-0 truncate text-sm text-green">{t("calc.comparePerfect")}</span>
              <span className="shrink-0 text-sm tabular-nums text-text-dim">{IV_MAX_TOTAL}/{IV_MAX_TOTAL} · 100%</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {STAT_LABELS.map((lb, i) => (
                cmpReady && perfect
                  ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={perfect.stats[i]} max={perfect.stats[i]} iv={IV_MAX} ivClass="text-green" />
                  : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.power")} <span className={`pixel ml-1 text-base ${cmpReady && perfect ? "text-yellow" : "slot-empty"}`}>{cmpReady && perfect ? perfect.power.toLocaleString("pt-BR") : "—"}</span></div>
          </div>
        </div>
      </div>

      </>
      ) : (
      /* Aba: Projetar nivel */
      <div className="card p-5">
        <h2 className="section-title mb-2 inline-flex items-center gap-2 text-cyan"><Xp size={18} />{t("calc.project")}</h2>
        <p className="mb-4 mt-1 text-sm text-text-dim">{t("calc.projectHint")}</p>
        <div className="max-w-[10rem]">
          <Field label={t("calc.targetLevel")} value={target} onChange={setTarget} placeholder="ex: 100" />
        </div>
        {/* status da projecao: um estado por vez no mesmo slot */}
        <p className="mt-4 min-h-[1.35rem] text-sm leading-relaxed text-text-dim">
          {!res ? t("calc.projNeedCalc") : !projection ? t("breed.egg.statsNeedLevel") : t("calc.projCompareHint", { n: tgt })}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Seu, projetado no nivel alvo — placeholder ate ter projecao */}
          <div className="well p-3 sm:p-4" style={{ borderColor: "var(--cyan)" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="pixel min-w-0 truncate text-sm text-cyan" title={creature?.name ?? undefined}>{t("calc.compareYou", { name: creature?.name ?? "—" })}</span>
              <span className={`shrink-0 text-sm tabular-nums ${iv ? "text-text-dim" : "slot-empty"}`}>{iv ? `${iv.total.toFixed(0)}/${IV_MAX_TOTAL} · ${Math.round((iv.total / IV_MAX_TOTAL) * 100)}%` : `—/${IV_MAX_TOTAL}`}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {STAT_LABELS.map((lb, i) => (
                projection && perfectProjection && res
                  ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={projection.stats[i]} max={perfectProjection.stats[i]} iv={res.ivs[i]} ivClass={ivColor(res.ivs[i])} />
                  : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.powerAt", { n: projection ? tgt : "—" })} <span className={`pixel ml-1 text-base ${projection ? "text-yellow" : "slot-empty"}`}>{projection ? projection.power.toLocaleString("pt-BR") : "—"}</span></div>
          </div>
          {/* Perfeito, projetado no nivel alvo */}
          <div className="well p-3 sm:p-4" style={{ borderColor: "var(--green)" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="pixel min-w-0 truncate text-sm text-green">{t("calc.comparePerfect")}</span>
              <span className="shrink-0 text-sm tabular-nums text-text-dim">{IV_MAX_TOTAL}/{IV_MAX_TOTAL} · 100%</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {STAT_LABELS.map((lb, i) => (
                perfectProjection
                  ? <StatCompareRow key={lb} label={lb} iconIndex={i} value={perfectProjection.stats[i]} max={perfectProjection.stats[i]} iv={IV_MAX} ivClass="text-green" />
                  : <CompareRowEmpty key={lb} label={lb} iconIndex={i} />
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2 field-label">{t("calc.powerAt", { n: perfectProjection ? tgt : "—" })} <span className={`pixel ml-1 text-base ${perfectProjection ? "text-yellow" : "slot-empty"}`}>{perfectProjection ? perfectProjection.power.toLocaleString("pt-BR") : "—"}</span></div>
          </div>
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}
