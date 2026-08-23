"use client";

import { useEffect, useState } from "react";
import { Button, Empty, Loading, Panel } from "@/components/ui";
import type { EventoRobo, TipoEvento } from "@/lib/robo/motor/eventos";

/**
 * O que o robô fez enquanto ninguém estava olhando.
 *
 * O feed "ao vivo" da aba de caçada morre com o processo, e o processo reinicia
 * a cada publicação. Esta aba lê o que ficou gravado no banco: shiny capturado
 * às três da manhã, venda feita, compra que faltou ouro, conta recusada.
 */

const CORES: Record<TipoEvento, string> = {
  shiny: "var(--color-warn)",
  "venda-item": "var(--color-ok)",
  "venda-poke": "var(--color-ok)",
  compra: "var(--color-t-robo)",
  cura: "var(--color-accent)",
  religou: "var(--color-text-mute)",
  meta: "var(--color-t-robo)",
  recusado: "var(--color-danger)",
  falha: "var(--color-danger)",
};

const ROTULOS: Record<TipoEvento, string> = {
  shiny: "shiny",
  "venda-item": "venda",
  "venda-poke": "venda",
  compra: "compra",
  cura: "cura",
  religou: "religou",
  meta: "meta",
  recusado: "recusa",
  falha: "falha",
};

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AbaRegistro() {
  const [eventos, setEventos] = useState<EventoRobo[] | null>(null);

  async function carregar() {
    const j = (await fetch("/api/robo/eventos?n=120")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as { eventos?: EventoRobo[] } | null;
    setEventos(j?.eventos ?? []);
  }

  useEffect(() => {
    void carregar();
  }, []);

  if (!eventos) return <Loading />;

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="pix text-[13px] text-text-dim">Registro</h2>
          <p className="mt-1 text-[12px] text-text-mute">Últimos 14 dias.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()}>
          atualizar
        </Button>
      </div>

      {eventos.length === 0 ? (
        <Empty
          title="Nada registrado ainda"
          hint="Shiny, venda, compra e recusa entram aqui e sobrevivem ao restart."
        />
      ) : (
        /* Teto de altura com rolagem propria: sao ate 120 linhas, e sem isto a
           pagina crescia sem fim e o resto do painel saia da tela. */
        <ul className="mt-3 flex max-h-[560px] flex-col overflow-y-auto">
          {eventos.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-line/60 py-2 last:border-0">
              <span
                className="pix mt-0.5 w-16 shrink-0 text-[10px]"
                style={{ color: CORES[e.tipo] ?? "var(--color-text-mute)" }}
              >
                {ROTULOS[e.tipo] ?? e.tipo}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-text">{e.titulo}</p>
                {e.corpo ? <p className="mt-0.5 text-[12px] text-text-mute">{e.corpo}</p> : null}
              </div>
              <span className="shrink-0 text-[11px] tabular text-text-mute">{quando(e.em)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
