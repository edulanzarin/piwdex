"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Loading, Panel, Segmented, SearchInput } from "@/components/ui";
import { compact } from "@/lib/labels";
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

/**
 * O ouro que o evento moveu.
 *
 * Ele SEMPRE esteve gravado — `aplicarRecados` grava `{ ouro, quantidade }` em
 * `data` desde o primeiro dia — e a tela nunca leu. O registro dizia "191 itens
 * vendidos" sem dizer por quanto, que e a metade que responde "valeu a pena
 * deixar isso ligado".
 *
 * Zero vira `null` de proposito: recusa grava `ouro: 0`, e um "+0" ao lado de
 * "não comprou" e ruido com cara de dado.
 */
function ouroDe(e: EventoRobo): number | null {
  const v = (e.dado as { ouro?: unknown } | null)?.ouro;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Compra tira, o resto poe. O sinal e do MOVIMENTO, nao do numero gravado. */
const ehSaida = (t: TipoEvento) => t === "compra";

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

  /**
   * O caixa do que esta FILTRADO, e nao do total.
   *
   * A soma acompanha o filtro porque e assim que ela responde pergunta: filtrar
   * por "essence of fire" e ver quanto aquele drop rendeu em quatorze dias e a
   * conta que ninguem tinha como fazer. Um total fixo no topo responderia sempre
   * a mesma coisa.
   */
  const caixa = useMemo(() => {
    let entrou = 0;
    let saiu = 0;
    for (const e of lista) {
      const o = ouroDe(e);
      if (o == null) continue;
      if (ehSaida(e.tipo)) saiu += o;
      else entrou += o;
    }
    return { entrou, saiu };
  }, [lista]);

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

      {/* So aparece quando ha dinheiro no que esta filtrado: uma linha de zeros
          ocuparia espaco pra dizer que nada aconteceu. */}
      {caixa.entrou || caixa.saiu ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border border-line bg-bg-soft px-3 py-2 text-[12px]">
          <span className="pix text-[10px] text-text-mute">
            {busca.trim() || grupo !== "tudo" ? "no filtro" : "em 14 dias"}
          </span>
          {caixa.entrou ? (
            <span style={{ color: TOM.vida }}>
              entrou <b className="tabular">{compact(caixa.entrou)}</b>
            </span>
          ) : null}
          {caixa.saiu ? (
            <span style={{ color: TOM.ouro }}>
              saiu <b className="tabular">{compact(caixa.saiu)}</b>
            </span>
          ) : null}
          {caixa.entrou && caixa.saiu ? (
            <span style={{ color: caixa.entrou - caixa.saiu < 0 ? TOM.perigo : TOM.vida }}>
              saldo{" "}
              <b className="tabular">
                {caixa.entrou - caixa.saiu < 0 ? "−" : "+"}
                {compact(Math.abs(caixa.entrou - caixa.saiu))}
              </b>
            </span>
          ) : null}
          <span className="ml-auto text-text-mute">
            {lista.length} {lista.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      ) : null}

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
              {/* A coluna existe mesmo vazia: com o valor entrando e saindo da
                  linha, a data dançava de posição a cada registro sem dinheiro. */}
              <span className="w-20 shrink-0 text-right text-[13px] tabular">
                {(() => {
                  const o = ouroDe(e);
                  if (o == null) return null;
                  const saida = ehSaida(e.tipo);
                  return (
                    <b style={{ color: saida ? TOM.ouro : TOM.vida }}>
                      {saida ? "−" : "+"}
                      {compact(o)}
                    </b>
                  );
                })()}
              </span>
              <span className="w-24 shrink-0 text-right text-[11px] tabular text-text-mute">
                {quando(e.em)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
