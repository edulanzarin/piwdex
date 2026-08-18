"use client";

// Auto-compra de consumiveis (seção de Configuracoes): o robo repoe sozinho as pokebolas,
// a pocao e o revive que a automacao usa quando ficam baixos — ele calcula a quantidade.
// PERSISTENTE: fica como o usuario deixar (robot_sessions.autobuy/supply_cfg religa no boot).
// Gasta dolares do jogo de verdade — por isso e opt-in. Qual pocao/revive repor: o jogo
// escolhe a melhor sozinho, entao a escolha aqui so controla o que COMPRAMOS.

import { useCallback, useEffect, useState } from "react";
import { ToggleButton } from "./toggle-button";
import { Pokeball } from "./pokeball";
import { useT } from "./locale-provider";

interface Opt { id: number; name: string }
interface State { on: boolean; potionId: number | null; reviveId: number | null; potions: Opt[]; revives: Opt[] }

export function ConsumablesBuyer() {
  const t = useT();
  const [st, setSt] = useState<State>({ on: false, potionId: null, reviveId: null, potions: [], revives: [] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/vip/autobuy", { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as Partial<State> | null;
      if (j && "on" in j) {
        setSt({
          on: !!j.on,
          potionId: j.potionId ?? null,
          reviveId: j.reviveId ?? null,
          potions: j.potions ?? [],
          revives: j.revives ?? [],
        });
      }
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/vip/autobuy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: st.on ? "stop" : "start" }) });
      const j = (await r.json().catch(() => null)) as { on?: boolean } | null;
      if (j && "on" in j) setSt((s) => ({ ...s, on: !!j.on }));
    } finally { setBusy(false); }
  };

  // grava a escolha de pocao/revive (otimista: reflete na hora, o servidor confirma).
  const setSupply = async (patch: { potionId?: number | null; reviveId?: number | null }) => {
    const next = { potionId: patch.potionId ?? st.potionId, reviveId: patch.reviveId ?? st.reviveId };
    setSt((s) => ({ ...s, ...patch }));
    try {
      await fetch("/api/vip/autobuy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supply: next }) });
    } catch {}
  };

  const Picker = ({ label, value, opts, onChange }: { label: string; value: number | null; opts: Opt[]; onChange: (id: number | null) => void }) => (
    <label className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-text">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="min-w-[11rem] rounded border border-border bg-[color:var(--surface-solid)] px-2 py-1.5 text-[0.72rem] text-text outline-none focus:border-[color:var(--border-strong)]"
      >
        <option value="">{t("robo.autobuy.best")}</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="section-title flex items-center gap-2 text-yellow"><Pokeball size={13} /> {t("robo.autobuy.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.autobuy.desc")}</p>
      </div>
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{t("robo.autobuy.toggle")}</div>
            <div className="mt-0.5 text-[0.68rem] text-text-dim">{t("robo.autobuy.toggleDesc")}</div>
          </div>
          <ToggleButton active={st.on} accent="green" onClick={toggle}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.on ? "pulse-soft" : ""}`} style={{ background: st.on ? "var(--green)" : "var(--text-dim)" }} />
            {busy ? "…" : st.on ? t("robo.on") : t("robo.off")}
          </ToggleButton>
        </div>

        {st.on && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
            <Picker label={t("robo.autobuy.potion")} value={st.potionId} opts={st.potions} onChange={(id) => setSupply({ potionId: id })} />
            <Picker label={t("robo.autobuy.revive")} value={st.reviveId} opts={st.revives} onChange={(id) => setSupply({ reviveId: id })} />
            <p className="text-[0.62rem] leading-relaxed text-text-dim">{t("robo.autobuy.supplyNote")}</p>
          </div>
        )}

        <p className="rounded border border-[color:var(--yellow)]/40 bg-[rgba(240,200,60,0.06)] px-3 py-2 text-[0.62rem] leading-relaxed text-yellow">{t("robo.autobuy.warn")}</p>
      </div>
    </div>
  );
}
