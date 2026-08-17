"use client";

// Primitivas de FILTRO padronizadas — pra todo grid de filtro ter a MESMA cara (mercado,
// capturados, etc.). Field = rotulo (field-label) + controle empilhados. ShinyToggle = o
// toggle de shiny identico em todo lugar (estrela + "Shiny", cor = estado).

import { ToggleButton } from "./toggle-button";
import { Star } from "./icons";
import { useT } from "./locale-provider";

export function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export function ShinyToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <ToggleButton active={active} onClick={() => onChange(!active)} accent="yellow">
      <Star size={12} /> {t("filter.shiny")}
    </ToggleButton>
  );
}
