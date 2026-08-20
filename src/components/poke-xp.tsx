"use client";

// XP do POKEMON (nao do treinador). O jogo publica a curva fechada e cada abate paga
// os dois lados — mas a tela do bot so mostrava o nivel, entao dava pra ver "Lv19" e
// nao ter ideia se faltava um minuto ou uma hora pro 20.
//
// Dois estados, e os dois valem: com o XP acumulado do individuo (quando a fonte manda)
// a barra e exata; sem ele, ainda dizemos o TAMANHO do nivel — que com o XP/h da hunt
// ja responde a pergunta real, que e "quanto falta".

import { hoursToLevel, xpProgress } from "@/lib/xp";
import { useT } from "./locale-provider";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

/** "19 min", "2h 10min" — tempo curto e o que interessa aqui. */
export function fmtEta(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const min = Math.round(hours * 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** Linha compacta: usada nos slots pequenos do time. */
export function PokeXpLine({
  level, xp, xpPerHour, className = "",
}: {
  level: number; xp?: number | null; xpPerHour?: number; className?: string;
}) {
  const t = useT();
  const p = xpProgress(level, xp);
  const eta = xpPerHour ? hoursToLevel(p, xpPerHour) : null;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`} title={t("xp.hint")}>
      {p.left != null ? (
        <>{fmt(p.left)} XP → Lv{level + 1}</>
      ) : (
        <>Lv{level + 1}: {fmt(p.need)} XP</>
      )}
      {eta != null && <span className="text-cyan">· {fmtEta(eta)}</span>}
    </span>
  );
}

/** Barra + números: usada onde há espaço (líder do time, modal de stats, conta). */
export function PokeXpBar({
  level, xp, xpPerHour, label,
}: {
  level: number; xp?: number | null; xpPerHour?: number; label?: boolean;
}) {
  const t = useT();
  const p = xpProgress(level, xp);
  const eta = xpPerHour ? hoursToLevel(p, xpPerHour) : null;
  // Sem o XP acumulado a barra ficaria em zero — e barra vazia é igualzinha a "não
  // carregou". Então nesse caso não desenhamos trilho nenhum, só o número do nível.
  const known = p.pct != null;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="field-label">{t("xp.toNext", { n: level + 1 })}</span>
        </div>
      )}
      {/* Mesma régua do medidor de vida logo acima: barra + par de números à direita.
          Sem o par, a barra de XP era a única da tela sem como conferir onde está. */}
      {known && (
        <span className="flex items-center gap-2">
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-[color:var(--cyan)]" style={{ width: `${(p.pct ?? 0) * 100}%` }} />
          </span>
          <span className="shrink-0 text-sm tabular-nums text-cyan">{fmt(p.done!)}/{fmt(p.need)}</span>
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2 text-xs text-text-dim">
        <span className="tabular-nums">
          {p.left != null
            ? `${t("xp.left", { n: fmt(p.left) })} → Lv${level + 1}`
            : `Lv${level + 1}: ${t("xp.levelCost", { n: fmt(p.need) })}`}
        </span>
        {eta != null && <span className="shrink-0 tabular-nums text-cyan">{fmtEta(eta)}</span>}
      </div>
    </div>
  );
}
