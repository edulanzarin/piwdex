"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { spriteUrl } from "@/lib/sprites";
import { compact, num, pct } from "@/lib/labels";
import { abatesPara, pedrasPorAbate, PEDRAS_DA_TROCA, type FonteDaPedra } from "@/lib/eevee";
import { Empty, Note, Panel, Sprite } from "@/components/ui";

const TINT = "var(--color-t-eevee)";
const MOSTRA = 8;

/**
 * ONDE A PEDRA CAI — o painel que decide a escolha.
 *
 * As cinco trocas cobram $65.000 e dez pedras, sem excecao. Como o preco nao
 * separa nada, a pergunta "qual eeveelution?" vira, na pratica, "qual pedra eu
 * consigo juntar dez?" — e essa e uma pergunta de catalogo, que o piwdex ja
 * respondia pra qualquer item antes desta tela existir.
 *
 * A coluna que importa e a ULTIMA, e ela nao e a chance. Chance por abate mede o
 * drop; abates ate dez mede o CAMINHO, que e o que a pessoa vai percorrer. E os
 * dois numeros discordam com frequencia — Mightyena solta a Darkness Stone a 2%
 * como o Absol, mas solta de 1 a 5 de cada vez, entao rende o triplo por abate.
 * Ordenar por chance poria os dois lado a lado como se fossem a mesma caçada.
 */
export function EeveePedra({
  pedra,
  icone,
  fontes,
  nivel,
}: {
  pedra: string;
  icone: string;
  fontes: FonteDaPedra[];
  nivel: number;
}) {
  const cabem = nivel > 0 ? fontes.filter((f) => f.nivel <= nivel) : fontes;
  const ordenadas = [...cabem].sort((a, b) => pedrasPorAbate(b) - pedrasPorAbate(a));
  const lista = ordenadas.slice(0, MOSTRA);
  // Quantas ficaram de fora POR NIVEL, e nao por corte de tela: e a unica das duas
  // podas que a pessoa pode desfazer subindo de nivel, entao e a unica que vale
  // dizer em voz alta.
  const acimaDoNivel = fontes.length - cabem.length;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {icone ? (
            <Sprite src={icone} alt="" size={18} fallback={null} className="[--sprite:18px]" />
          ) : null}
          <span className="pix">Onde cai {pedra}</span>
        </span>
      }
      actions={
        <span className="num text-[13px] text-text-mute">
          {cabem.length} de {fontes.length} fontes
        </span>
      }
      bodyClassName="flex flex-col gap-3"
      style={{ "--tint": TINT } as CSSProperties}
    >
      {lista.length === 0 ? (
        <Empty
          title="Nenhuma fonte no seu nível"
          hint={
            acimaDoNivel > 0
              ? `As ${acimaDoNivel} criaturas que soltam ${pedra} caçam acima do nível que você informou.`
              : `Nada no catálogo solta ${pedra} num ponto de caça.`
          }
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lista.map((f, i) => {
            const abates = abatesPara(f);
            return (
              <li key={f.pokeId}>
                <Link
                  href={`/dex/${f.pokeId}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pix border px-2.5 py-2",
                    "transition-[border-color,background-color] duration-200",
                    i === 0
                      ? "border-[var(--tint)]/55 bg-[var(--tint)]/8"
                      : "border-line hover:border-[var(--tint)]/40 hover:bg-surface-2",
                  )}
                >
                  <Sprite
                    src={spriteUrl(f.pokeId)}
                    alt={f.nome}
                    size={40}
                    className="[--sprite:40px] shrink-0"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] text-text">{f.nome}</span>
                    <span className="truncate text-[11px] text-text-mute">
                      nv {f.nivel} · {f.areas.join(", ")}
                    </span>
                  </span>

                  <span className="num shrink-0 text-right text-[12px] text-text-dim">
                    {pct(f.chancePct, 2)}
                    {f.max > 1 ? (
                      <span className="text-text-mute">
                        {" "}
                        x{f.min}–{f.max}
                      </span>
                    ) : null}
                  </span>

                  <span className="num w-[72px] shrink-0 text-right text-[13px]">
                    <span style={{ color: i === 0 ? TINT : undefined }}>
                      {Number.isFinite(abates) ? compact(Math.ceil(abates)) : "—"}
                    </span>
                    <span className="block text-[10px] text-text-mute">abates</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Note flush>
        A última coluna é quantos abates, no valor esperado, até juntar as{" "}
        {PEDRAS_DA_TROCA} pedras — chance vezes a quantidade que cai de cada vez.{" "}
        {lista.length > 0 ? (
          <>
            No melhor caso da sua faixa dá {num(pedrasPorAbate(lista[0]) * 100, 2)} pedra a cada
            cem abates.{" "}
          </>
        ) : null}
        {acimaDoNivel > 0 ? `${acimaDoNivel} fontes ficaram de fora por caçarem acima do seu nível. ` : ""}
        É valor esperado, não promessa: metade das tentativas leva mais que isso.
      </Note>
    </Panel>
  );
}
