"use client";

// Panel — o card-com-cabecalho padrao da area VIP. Fecha a FORMA (card, padding,
// cabecalho com icone/titulo/slot a direita) e abre so a variacao: acento, badge ao
// vivo, acao, e o modo EXPANSIVEL (cabecalho recolhe/abre o corpo — tela densa sem
// caixa vazia ocupando espaco). Substitui as copias soltas de `card p-4` + header.
// O `card` e VIDRO (superficie translucida + blur): tudo que mora DENTRO do Panel usa
// fundo chapado (--well-bg) — vidro sobre vidro em varios niveis suja a leitura.

import { useState, type CSSProperties } from "react";
import { LiveBadge } from "./status";
import { Caret } from "../icons";

export function Panel({
  icon,
  title,
  accent,
  live = false,
  right,
  collapsible = false,
  defaultOpen = true,
  className = "",
  bodyClassName = "",
  children,
}: {
  /** icone do cabecalho (cor de apoio; o acento NAO pinta mais o chrome) */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** cor do acento (token/var). Alimenta --accent (glow/flash). NAO pinta titulo nem
   *  icone: cabecalho colorido virava arco-iris. Cor no VIP so onde ela e DADO. */
  accent?: string;
  /** badge "ao vivo" pulsando no cabecalho */
  live?: boolean;
  /** slot a direita do cabecalho (botao, contador, chip) */
  right?: React.ReactNode;
  /** cabecalho clicavel que recolhe/abre o corpo */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const header = (title || icon || right) && (
    <>
      {icon && (
        <span className="inline-flex shrink-0 text-text-dim">{icon}</span>
      )}
      {title && <h3 className="section-title min-w-0 flex-1 truncate text-left">{title}</h3>}
      {live && <LiveBadge />}
      {right}
      {collapsible && (
        <span className="inline-flex shrink-0 text-text-dim" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          {/* 18px: e o chevron do CABECALHO do card — no tamanho antigo (9px) o traco
              lucide sumia. Mesmo degrau do icone de titulo ao lado. */}
          <Caret size={18} />
        </span>
      )}
    </>
  );
  return (
    <section
      className={`card flex flex-col gap-2.5 p-4 ${className}`}
      style={accent ? ({ "--accent": accent } as CSSProperties) : undefined}
    >
      {header && (collapsible ? (
        // div clicavel (nao <button>): o slot `right` pode conter botao proprio e
        // button-dentro-de-button e HTML invalido
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
          className="flex min-w-0 cursor-pointer select-none items-center gap-2"
          aria-expanded={open}
        >
          {header}
        </div>
      ) : (
        <header className="flex min-w-0 items-center gap-2">{header}</header>
      ))}
      {(!collapsible || open) && (
        <div className={`flex min-h-0 flex-1 flex-col gap-2.5 ${bodyClassName}`}>{children}</div>
      )}
    </section>
  );
}
