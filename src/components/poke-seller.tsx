"use client";

// Vender pokemon (manual, por regra) — 2a capacidade de venda do Robo. As 4 travas
// que o Eduardo pediu, TODAS configuraveis: (1) nunca raro/lendario/epico, (2) nunca
// shiny, (3) so abaixo de X de IV e (4) de qualidade; a simulacao lista o que casaria
// ANTES de confirmar. A config fica salva em localStorage (piw:poke-sell-config) e ja
// e o contrato que o worker/venda vao ler.
//
// TRAVA ATUAL: a lista dos pokemon individuais (com IV/quality/shiny) nao existe na
// REST do jogo (todos os endpoints candidatos deram 404) — so no WebSocket (evento
// `pokes`). Enquanto essa fonte nao entra, as travas salvam mas a simulacao/venda
// ficam desligadas com aviso. O backend (POST /api/vip/shop action sell-pokes) ja
// existe e vende por pokeId; falta so a fonte da lista.

import { useEffect, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { useT } from "./locale-provider";
import { Coin, Star } from "./icons";

export interface PokeSellConfig {
  keepRarity: boolean; // nunca vender raro/lendario/epico
  keepShiny: boolean; // nunca vender shiny
  maxIv: number; // so vende IV total <= maxIv (%)
  maxQuality: number; // so vende quality <= maxQuality
}

const KEY = "piw:poke-sell-config";
const DEFAULTS: PokeSellConfig = { keepRarity: true, keepShiny: true, maxIv: 50, maxQuality: 50 };

function load(): PokeSellConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<PokeSellConfig>;
    return {
      keepRarity: typeof p.keepRarity === "boolean" ? p.keepRarity : DEFAULTS.keepRarity,
      keepShiny: typeof p.keepShiny === "boolean" ? p.keepShiny : DEFAULTS.keepShiny,
      maxIv: typeof p.maxIv === "number" ? p.maxIv : DEFAULTS.maxIv,
      maxQuality: typeof p.maxQuality === "number" ? p.maxQuality : DEFAULTS.maxQuality,
    };
  } catch {
    return DEFAULTS;
  }
}

// linha de config: titulo + descricao + controle (mesmo padrao do RoboPanel)
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title}</div>
        {desc && <div className="mt-0.5 text-[0.68rem] text-text-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 accent-[color:var(--yellow)]"
      />
      <span className="w-9 text-right text-sm font-semibold tabular-nums text-yellow">{value}</span>
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

  const sw = (on: boolean, onClick: () => void) => (
    <ToggleButton active={on} accent="green" onClick={onClick}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: on ? "var(--green)" : "var(--text-dim)" }} />
      {on ? t("robo.on") : t("robo.off")}
    </ToggleButton>
  );

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

        <Row title={t("robo.pokes.keepRarity")} desc={t("robo.pokes.keepRarity.desc")}>
          {sw(cfg.keepRarity, () => patch({ keepRarity: !cfg.keepRarity }))}
        </Row>
        <Row title={t("robo.pokes.keepShiny")} desc={t("robo.pokes.keepShiny.desc")}>
          {sw(cfg.keepShiny, () => patch({ keepShiny: !cfg.keepShiny }))}
        </Row>
        <Row title={t("robo.pokes.maxIv")} desc={t("robo.pokes.maxIv.desc", { n: cfg.maxIv })}>
          <Slider value={cfg.maxIv} onChange={(n) => patch({ maxIv: n })} />
        </Row>
        <Row title={t("robo.pokes.maxQuality")} desc={t("robo.pokes.maxQuality.desc", { n: cfg.maxQuality })}>
          <Slider value={cfg.maxQuality} onChange={(n) => patch({ maxQuality: n })} />
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
