"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_LABEL, compact, num } from "@/lib/labels";
import { TIER_COLOR, type Tier } from "@/lib/meta";
import type { GanhoTm } from "@/lib/tm";
import type { PokeType } from "@/lib/types";
import { Empty, Note, Panel, Segmented, Sprite, Switch } from "@/components/ui";
import { TypeIcon } from "@/components/type-icon";

const TINT = "var(--color-t-tm)";

export interface LinhaQuem {
  ganho: GanhoTm;
  /** o tier sem o disco e com ele — quando diferem, é a leitura que decide */
  tierNat: Tier | null;
  tierTm: Tier | null;
  /** o apelido da carta, quando a linha veio da bolsa */
  carta: string | null;
  stab: boolean;
}

/**
 * QUEM APROVEITA — a resposta, depois de o disco estar escolhido.
 *
 * A ordem é pela RAZÃO e não pelo dano final, e a diferença decide errado se for
 * trocada. Dano final ordena por quem já era forte: o Scizor termina com o maior
 * número da lista e ganha só 1,77x, porque o moveset natural dele já era bom. A
 * razão ordena por quem o disco TRANSFORMA — o Jolteon salta 7,6x. Com uma peça
 * gasta e um disco na mão, transformar vale mais que somar.
 *
 * As duas colunas ficam na tela mesmo assim, porque a segunda pergunta existe:
 * "e depois de tudo, quem bate mais?" é a de quem já tem os dois.
 */
export function TmQuem({
  tipo,
  golpe,
  linhas,
  ordem,
  onOrdem,
  meus,
  onMeus,
  temBolsa,
}: {
  tipo: PokeType | null;
  golpe: {
    name: string;
    power: number;
    cooldownMs: number;
    category: string;
  } | null;
  linhas: LinhaQuem[];
  ordem: "razao" | "final";
  onOrdem: (o: "razao" | "final") => void;
  meus: boolean;
  onMeus: (v: boolean) => void;
  temBolsa: boolean;
}) {
  const topo = linhas[0];

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {tipo ? <TypeIcon type={tipo} size={16} /> : null}
          <span className="pix">
            {tipo
              ? `Quem aproveita ${TYPE_LABEL[tipo]}`
              : "Quem mais ganha com um TM"}
          </span>
        </span>
      }
      actions={
        <span className="flex items-center gap-2">
          {temBolsa ? (
            <Switch
              checked={meus}
              onChange={(e) => onMeus(e.currentTarget.checked)}
              label="só os meus"
            />
          ) : null}
          <Segmented
            value={ordem}
            onChange={onOrdem}
            size="sm"
            aria-label="Ordenar por"
            options={[
              {
                value: "razao",
                label: "Salto",
                title: "quem o disco mais transforma",
              },
              {
                value: "final",
                label: "Dano",
                title: "quem termina batendo mais",
              },
            ]}
          />
        </span>
      }
      bodyClassName="flex flex-col gap-3"
      style={{ "--tint": TINT } as CSSProperties}
    >
      {golpe ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-line-strong bg-surface-2/60 px-3 py-2">
          <span className="text-[14px] text-text">{golpe.name}</span>
          <span className="num text-[12px] text-text-mute">
            {golpe.power} de poder a cada {golpe.cooldownMs / 1000}s ·{" "}
            {golpe.category === "SPECIAL" ? "especial" : "físico"}
          </span>
        </div>
      ) : null}

      {linhas.length === 0 ? (
        <Empty
          title={
            meus
              ? "Nenhuma carta sua aprende esse disco"
              : "Ninguém aprende esse disco"
          }
          hint={
            meus
              ? "Desligue o recorte pra ver o catálogo inteiro, ou cadastre o pokémon na bolsa."
              : "Nenhuma das 482 espécies tem golpe de TM desse tipo."
          }
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {linhas.map((l, i) => {
            const g = l.ganho;
            const razaoInf = !Number.isFinite(g.razao);
            return (
              <li key={`${g.mon.pokeId}-${l.carta ?? ""}`}>
                <Link
                  href={`/dex/${g.mon.pokeId}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-pix border px-2.5 py-2",
                    "transition-[border-color,background-color] duration-200",
                    i === 0
                      ? "border-[var(--tint)]/55 bg-[var(--tint)]/8"
                      : "border-line hover:border-[var(--tint)]/40 hover:bg-surface-2",
                  )}
                >
                  <Sprite
                    src={spriteUrl(g.mon.pokeId)}
                    alt={g.mon.name}
                    size={40}
                    className="[--sprite:40px] shrink-0"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] text-text">
                        {l.carta ?? g.mon.name}
                      </span>
                      {l.stab ? (
                        <span
                          className="pix shrink-0 rounded-pill px-1.5 py-px text-[9px]"
                          style={{
                            color: TINT,
                            backgroundColor: `color-mix(in oklab, ${TINT} 16%, transparent)`,
                          }}
                          title="o tipo do disco é o tipo dele: o golpe bate 1,5x"
                        >
                          STAB
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-[11px] text-text-mute">
                      sai de {g.melhorNatural?.name ?? "nada ofensivo"}
                    </span>
                  </span>

                  {/* 106px e nao 86: "1,5k -> 11,4k" nao cabia em 86 e quebrava
                      em duas linhas, empurrando o rotulo pra fora do alinhamento
                      das outras linhas. */}
                  <span className="num w-[106px] shrink-0 text-right text-[12px] text-text-dim">
                    {compact(Math.round(g.natural))}
                    <span className="text-text-mute"> {"->"} </span>
                    {compact(Math.round(g.comTm))}
                    <span className="block text-[10px] text-text-mute">
                      poder/s
                    </span>
                  </span>

                  <span className="num w-[54px] shrink-0 text-right text-[14px]">
                    <span style={{ color: i === 0 ? TINT : undefined }}>
                      {razaoInf ? "novo" : `${num(g.razao, 1)}x`}
                    </span>
                    {/* O tier só vira SETA quando ele muda. Mostrar "B B" em
                        toda linha treinaria o olho a ignorar a coluna, e é
                        justamente ela que responde se o disco muda de patamar
                        ou só soma dano dentro do mesmo. */}
                    {l.tierTm ? (
                      <span className="pix block text-[10px]">
                        {l.tierNat && l.tierNat !== l.tierTm ? (
                          <>
                            <span style={{ color: TIER_COLOR[l.tierNat] }}>
                              {l.tierNat}
                            </span>
                            <span className="text-text-mute">{"->"}</span>
                          </>
                        ) : null}
                        <span style={{ color: TIER_COLOR[l.tierTm] }}>
                          {l.tierTm}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {topo ? (
        <Note flush>
          O salto é a razão entre o dano por segundo do moveset com o disco e
          sem ele — e ele{" "}
          <strong>não muda com o seu nível nem com a quality</strong>: os dois
          lados usam o mesmo stat multiplicado pelo mesmo fator, que cancela.{" "}
          {meus
            ? "Nas suas cartas o IV entra na conta, e ele importa quando o golpe natural e o do TM usam stats diferentes."
            : "A conta aqui é sobre a base da espécie, como na tier list."}{" "}
          Não é multiplicação do golpe: o TM SOMA um golpe muito bom a um
          moveset que continua disparando.
        </Note>
      ) : null}
    </Panel>
  );
}
