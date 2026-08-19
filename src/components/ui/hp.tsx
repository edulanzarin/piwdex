"use client";

// VIDA de um pokemon — uma forma so no site inteiro (cockpit, Conta, Meus Pokemons).
// Pokemon em 0 de vida NAO entra em campo: a hunt fica ligada sem matar nada. Por isso
// o desmaio nao e "um numero baixo", e um ESTADO — barra vermelha pulsando e chip; a
// barra sozinha (o que existia) some quando chega a zero, que e justo a hora de gritar.

import { useT } from "../locale-provider";

export const isFainted = (p: { hp: number; maxHp: number }) => p.maxHp > 0 && p.hp <= 0;

const pctOf = (hp: number, maxHp: number) => (maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0);
const colorOf = (pct: number) => (pct > 50 ? "var(--green)" : pct > 20 ? "var(--yellow)" : "var(--red)");

/** Barra fina de vida. Desmaiado = trilho vermelho pulsando (barra vazia nao comunica). */
export function HpBar({ hp, maxHp, className = "" }: { hp: number; maxHp: number; className?: string }) {
  const pct = pctOf(hp, maxHp);
  const down = isFainted({ hp, maxHp });
  return (
    <span
      className={`hud-track block w-full ${down ? "pulse-soft" : ""} ${className}`}
      style={down ? { borderColor: "var(--red)", background: "rgba(255, 90, 106, 0.16)" } : undefined}
    >
      <span className="hud-fill block" style={{ width: `${pct}%`, background: colorOf(pct) }} />
    </span>
  );
}

/** Numero da vida (24/24), na cor da faixa. Sem maxHp lido ainda, mostra o placeholder. */
export function HpText({ hp, maxHp, className = "" }: { hp: number; maxHp: number; className?: string }) {
  const t = useT();
  if (maxHp <= 0) return <span className={`slot-empty tabular-nums ${className}`}>—</span>;
  const down = isFainted({ hp, maxHp });
  const pct = pctOf(hp, maxHp);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums ${className}`}
      style={{ color: colorOf(pct) }}
      title={down ? t("vip.team.faintedHint") : t("vip.team.hp")}
    >
      {Math.max(0, Math.round(hp)).toLocaleString("pt-BR")}/{Math.round(maxHp).toLocaleString("pt-BR")}
    </span>
  );
}

/** Chip de desmaiado — so aparece quando esta em 0 (quem le tem que agir: curar). */
export function FaintedChip({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <span className={`chip shrink-0 ${className}`} style={{ background: "var(--red)", color: "#1a0409" }}>
      {t("vip.team.fainted")}
    </span>
  );
}

/** Barra + numero: o par que a maioria dos cards quer. */
export function HpMeter({ hp, maxHp, className = "" }: { hp: number; maxHp: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <HpBar hp={hp} maxHp={maxHp} className="min-w-0 flex-1" />
      <HpText hp={hp} maxHp={maxHp} className="text-sm" />
    </span>
  );
}
