"use client";

// Curar o time na enfermeira Joy sem abrir o jogo: POST /api/vip/team {action:"heal"}.
// Com o robo conectado sai pelo socket segurado (single-session, nao derruba a hunt);
// sem sessao, a rota faz o one-shot. A confirmacao NAO e a resposta: e o HP voltando no
// frame `pokes` que o stream empurra — por isso aqui so cuida do "pedindo" e do aviso.

import { useState } from "react";
import { Heart } from "./icons";
import { useToast } from "./toast";
import { useT } from "./locale-provider";

export function HealButton({ className = "btn btn-ghost btn-sm", compact = false }: { className?: string; compact?: boolean }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const heal = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/vip/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heal" }),
      });
      if (!r.ok) { toast.error(t("toast.healFail")); return; }
      toast.success(t("toast.healOk"));
    } catch { toast.error(t("toast.healFail")); } finally { setBusy(false); }
  };

  return (
    <button type="button" onClick={() => void heal()} disabled={busy} className={className} title={t("vip.team.healHint")}>
      <Heart size={14} />
      {!compact && <span className="ms-1.5">{busy ? t("vip.team.healing") : t("vip.team.heal")}</span>}
    </button>
  );
}
