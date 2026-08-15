"use client";

import type { Acquisition } from "@/lib/types";
import { useT } from "./locale-provider";

// Cor por origem: caca = verde (o comum), evolucao = ciano, especial = roxo
// (cara de "premium/cassino"). So texto — sem emoji.
const STYLE: Record<Acquisition, { bg: string; fg: string }> = {
  hunt: { bg: "rgba(53,224,142,0.14)", fg: "var(--green)" },
  evo: { bg: "rgba(55,211,230,0.14)", fg: "var(--cyan)" },
  special: { bg: "rgba(185,140,255,0.18)", fg: "var(--purple)" },
};

export function AcqBadge({ kind, className = "" }: { kind: Acquisition; className?: string }) {
  const t = useT();
  const s = STYLE[kind];
  return (
    <span
      className={`chip ${className}`}
      style={{ background: s.bg, color: s.fg }}
      title={t(`dex.acq.${kind}Hint`)}
    >
      {t(`dex.acq.${kind}`)}
    </span>
  );
}
