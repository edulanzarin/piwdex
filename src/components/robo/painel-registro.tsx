"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Loading, Panel, Segmented, SearchInput } from "@/components/ui";
import { IconRegistro } from "@/components/ui/icons";
import { TOM } from "@/components/robo/pecas";
import type { EventoRobo, TipoEvento } from "@/lib/robo/motor/eventos";

/**
 * O que o robô fez enquanto ninguém estava olhando.
 *
 * O feed "ao vivo" da aba de caçada morre com o processo, e o processo reinicia
 * a cada publicação. Esta aba lê o que ficou gravado: shiny capturado às três da
 * manhã, venda feita, compra que faltou dinheiro, conta recusada — e o shiny que
 * OUTRO jogador pegou, que passa uma vez pelo socket e não volta.
 */

const CORES: Record<TipoEvento, string> = {
  shiny: TOM.ouro,
  "shiny-mundo": "var(--color-accent)",
  "venda-item": TOM.vida,
  "venda-poke": TOM.vida,
  compra: "var(--color-t-robo)",
  cura: "var(--color-accent)",
  religou: TOM.fraco,
  meta: "var(--color-t-robo)",
  recusado: TOM.perigo,
  falha: TOM.perigo,
};

const ROTULOS: Record<TipoEvento, string> = {
  shiny: "shiny",
  "shiny-mundo": "mundo",
  "venda-item": "venda",
  "venda-poke": "venda",
  compra: "compra",
  cura: "cura",
  religou: "religou",
  meta: "meta",
  recusado: "recusa",
  falha: "falha",
};

/** Os filtros agrupam por ASSUNTO, e não por tipo: quem procura "o que o robô
 *  fez com meu dinheiro" não pensa em `venda-item` e `compra` como duas coisas. */
type Grupo = "tudo" | "shiny" | "dinheiro" | "problema";

const GRUPO: Record<Grupo, (t: TipoEvento) => boolean> = {
  tudo: () => true,
  shiny: (t) => t === "shiny" || t === "shiny-mundo",
  dinheiro: (t) => t === "venda-item" || t === "venda-poke" || t === "compra",
  problema: (t) => t === "falha" || t === "recusado",
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

export function AbaRegistro({ onLido }: { onLido?: () => void }) {
  const [eventos, setEventos] = useState<EventoRobo[] | null>(null);
  const [grupo, setGrupo] = useState<Grupo>("tudo");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    const j = (await fetch("/api/robo/eventos?n=300")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as { eventos?: EventoRobo[] } | null;
    setEventos(j?.eventos ?? []);
  }, []);

  useEffect(() => {
    void carregar();
    // Abrir o registro é ter lido. Marca no servidor para a contagem sobreviver
    // ao F5 — um "não lido" que volta a cada recarga é ruído, não aviso.
    void fetch("/api/robo/eventos", { method: "POST" })
      .then(() => onLido?.())
      .catch(() => {});
  }, [carregar, onLido]);

  const lista = useMemo(() => {
    if (!eventos) return [];
    const t = busca.trim().toLowerCase();
    return eventos
      .filter((e) => GRUPO[grupo](e.tipo))
      .filter((e) => !t || `${e.titulo} ${e.corpo ?? ""}`.toLowerCase().includes(t));
  }, [eventos, grupo, busca]);

  const contaPorGrupo = useMemo(() => {
    const c: Record<Grupo, number> = { tudo: 0, shiny: 0, dinheiro: 0, problema: 0 };
    for (const e of eventos ?? []) {
      for (const g of Object.keys(GRUPO) as Grupo[]) if (GRUPO[g](e.tipo)) c[g]++;
    }
    return c;
  }, [eventos]);

  if (!eventos) return <Loading />;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <IconRegistro size={14} />
          Registro
          <span className="text-[11px] text-text-mute">últimos 14 dias</span>
        </span>
      }
      actions={
        <span className="flex items-center gap-2">
          <Segmented
            value={grupo}
            onChange={setGrupo}
            size="sm"
            options={(Object.keys(GRUPO) as Grupo[]).map((g) => ({
              value: g,
              label: `${g}${contaPorGrupo[g] ? ` ${contaPorGrupo[g]}` : ""}`,
            }))}
          />
          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            atualizar
          </Button>
        </span>
      }
    >
      <div>
        <SearchInput
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          placeholder="filtrar por texto…"
        />
      </div>

      {lista.length === 0 ? (
        <Empty
          title={eventos.length ? "Nada com esse filtro" : "Nada registrado ainda"}
          hint={
            eventos.length
              ? undefined
              : "Shiny, venda, compra e recusa entram aqui e sobrevivem ao restart."
          }
        />
      ) : (
        <ul className="mt-3 flex max-h-[560px] flex-col overflow-y-auto">
          {lista.map((e) => (
            <li
              key={e.id}
              className="flex h-12 shrink-0 items-center gap-3 border-b border-line/60 last:border-0"
            >
              <span
                className="pix w-16 shrink-0 text-[10px]"
                style={{ color: CORES[e.tipo] ?? TOM.fraco }}
              >
                {ROTULOS[e.tipo] ?? e.tipo}
              </span>
              {!e.lido ? (
                <span
                  className="h-1.5 w-1.5 shrink-0"
                  style={{ backgroundColor: "var(--color-t-robo)" }}
                  title="ainda não visto"
                />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-text">{e.titulo}</p>
                {e.corpo ? <p className="truncate text-[12px] text-text-mute">{e.corpo}</p> : null}
              </div>
              <span className="shrink-0 text-[11px] tabular text-text-mute">{quando(e.em)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
