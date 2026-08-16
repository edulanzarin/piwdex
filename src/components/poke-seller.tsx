"use client";

// Vender pokemon (manual, por regra) — 2a capacidade de venda do Robo. As travas que
// o Eduardo pediu, TODAS configuraveis e granulares:
//   (1) um box por raridade (COMMON..MYTHIC) — marca so o que topa vender;
//   (2) nunca shiny;
//   (3) IV maximo ABSOLUTO (0..192, nao %) — so vende ate esse IV total;
//   (4) qualidade maxima (decimal) — so vende ate essa qualidade.
// A config fica salva em localStorage (piw:poke-sell-config:v2) e ja e o contrato que
// o worker/venda vao ler. A simulacao lista o que casaria ANTES de confirmar.
//
// TRAVA ATUAL: a lista dos pokemon individuais (com IV/quality/shiny) nao existe na
// REST do jogo (endpoints candidatos deram 404) — so no WebSocket (evento `pokes`).
// Enquanto essa fonte nao entra, as travas salvam mas a simulacao/venda ficam
// desligadas com aviso. O backend (POST /api/vip/shop action sell-pokes) ja vende por
// pokeId; falta so a fonte da lista.

import { useEffect, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { useT } from "./locale-provider";
import { Coin, Star } from "./icons";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import type { Rarity } from "@/lib/types";

export interface PokeSellConfig {
  sellRarities: Rarity[]; // raridades que PODEM ser vendidas (o resto nunca vende)
  keepShiny: boolean; // nunca vender shiny
  maxIv: number; // 0..192, so vende IV total <= maxIv
  maxQuality: number; // decimal, so vende quality <= maxQuality
}

// escala absoluta do jogo (nao %): IV total = soma dos 6 IVs (0..32 cada).
const IV_MAX = 192;
const QUALITY_MAX = 3; // teto do slider; qualidade real e decimal (~1.0..2.x) — ajustavel quando o WS trouxer os valores
const QUALITY_STEP = 0.05;

const KEY = "piw:poke-sell-config:v2";
const DEFAULTS: PokeSellConfig = { sellRarities: ["COMMON", "UNCOMMON"], keepShiny: true, maxIv: 100, maxQuality: 1.8 };

function load(): PokeSellConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<PokeSellConfig>;
    const rar = Array.isArray(p.sellRarities) ? p.sellRarities.filter((r): r is Rarity => RARITY_ORDER.includes(r as Rarity)) : null;
    const clamp = (n: unknown, max: number, d: number) => (typeof n === "number" && n >= 0 && n <= max ? n : d);
    return {
      sellRarities: rar ?? DEFAULTS.sellRarities,
      keepShiny: typeof p.keepShiny === "boolean" ? p.keepShiny : DEFAULTS.keepShiny,
      maxIv: clamp(p.maxIv, IV_MAX, DEFAULTS.maxIv),
      maxQuality: clamp(p.maxQuality, QUALITY_MAX, DEFAULTS.maxQuality),
    };
  } catch {
    return DEFAULTS;
  }
}

// linha de config: titulo + descricao + controle (mesmo padrao do RoboPanel)
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="mt-0.5 text-[0.68rem] text-text-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step, fmt, onChange }: { value: number; min: number; max: number; step: number; fmt: (n: number) => string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 accent-[color:var(--yellow)]"
      />
      <span className="w-12 text-right text-sm font-semibold tabular-nums text-yellow">{fmt(value)}</span>
    </div>
  );
}

// um box por raridade, na cor oficial — marcado = vende essa raridade
function RarityBoxes({ selected, onToggle }: { selected: Rarity[]; onToggle: (r: Rarity) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {RARITY_ORDER.map((r) => {
        const on = selected.includes(r);
        const color = RARITY_COLOR[r];
        return (
          <button
            key={r}
            type="button"
            onClick={() => onToggle(r)}
            aria-pressed={on}
            className="chip inline-flex items-center gap-1.5 border transition"
            style={{ background: on ? color : "transparent", borderColor: color, color: on ? "#06111a" : color, opacity: on ? 1 : 0.5 }}
          >
            <span className="w-2 text-center text-[0.6rem]">{on ? "✓" : "·"}</span>
            {r}
          </button>
        );
      })}
    </div>
  );
}

export function PokeSeller() {
  const t = useT();
  const [cfg, setCfg] = useState<PokeSellConfig>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // hidrata do localStorage so no cliente (evita mismatch de SSR)
  useEffect(() => setCfg(load()), []);

  const patch = (p: Partial<PokeSellConfig>) => {
    setCfg((c) => {
      const next = { ...c, ...p };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const toggleRarity = (r: Rarity) =>
    patch({ sellRarities: cfg.sellRarities.includes(r) ? cfg.sellRarities.filter((x) => x !== r) : [...cfg.sellRarities, r] });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="pixel flex items-center gap-2 text-[0.8rem] text-yellow"><Coin size={14} /> {t("robo.pokes.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.pokes.desc")}</p>
      </div>

      {/* travas configuraveis — sempre editaveis, salvam na hora */}
      <div className="card flex flex-col p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="pixel text-[0.6rem] text-cyan">{t("robo.pokes.filters")}</h3>
          {saved && <span className="text-[0.66rem] font-semibold text-green">{t("robo.pokes.saved")}</span>}
        </div>

        {/* raridade: bloco de largura cheia (6 boxes nao cabem alinhados a direita) */}
        <div className="py-3">
          <div className="text-sm font-semibold text-text">{t("robo.pokes.sellRarities")}</div>
          <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.pokes.sellRarities.desc")}</div>
          <RarityBoxes selected={cfg.sellRarities} onToggle={toggleRarity} />
        </div>

        <Row title={t("robo.pokes.keepShiny")} desc={t("robo.pokes.keepShiny.desc")}>
          <ToggleButton active={cfg.keepShiny} accent="green" onClick={() => patch({ keepShiny: !cfg.keepShiny })}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cfg.keepShiny ? "var(--green)" : "var(--text-dim)" }} />
            {cfg.keepShiny ? t("robo.on") : t("robo.off")}
          </ToggleButton>
        </Row>
        <Row title={t("robo.pokes.maxIv")} desc={t("robo.pokes.maxIv.desc", { n: cfg.maxIv })}>
          <Slider value={cfg.maxIv} min={0} max={IV_MAX} step={1} fmt={(n) => String(n)} onChange={(n) => patch({ maxIv: n })} />
        </Row>
        <Row title={t("robo.pokes.maxQuality")} desc={t("robo.pokes.maxQuality.desc", { n: cfg.maxQuality.toFixed(2) })}>
          <Slider value={cfg.maxQuality} min={0} max={QUALITY_MAX} step={QUALITY_STEP} fmt={(n) => n.toFixed(2)} onChange={(n) => patch({ maxQuality: n })} />
        </Row>
      </div>

      {/* simulacao + venda: travada ate a fonte da lista (WS) existir */}
      <div className="card relative overflow-hidden p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-cyan"><Star size={13} /></span>
          <div className="min-w-0">
            <h3 className="pixel text-[0.6rem] text-cyan">{t("robo.pokes.locked.title")}</h3>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-text-dim">{t("robo.pokes.locked.desc")}</p>
            <button type="button" disabled className="btn btn-cyan mt-3 cursor-not-allowed opacity-40" title={t("robo.pokes.locked.title")}>
              {t("robo.pokes.simulate")} ›
            </button>
            <p className="mt-2 text-[0.62rem] text-text-dim">{t("robo.pokes.simulate.desc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
