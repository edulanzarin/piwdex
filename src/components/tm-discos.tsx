"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { TYPE_LABEL, num } from "@/lib/labels";
import type { PokeType } from "@/lib/types";
import type { Disco } from "@/lib/tm";
import type { DiscoItem } from "@/lib/tm-data";
import { Note, Panel, Sprite } from "@/components/ui";
import { TypeIcon } from "@/components/type-icon";

const TINT = "var(--color-t-tm)";

export interface LinhaDisco {
  disco: Disco;
  item: DiscoItem | undefined;
  /** quantas espécies do conjunto aprendem */
  quantas: number;
  /** quantas das SUAS cartas aprendem; null quando a bolsa está vazia */
  minhas: number | null;
  /** a maior razão de ganho entre elas; 0 quando não há ninguém */
  melhorRazao: number;
}

/**
 * OS DEZOITO DISCOS DE TIPO — a escolha, e não a consequência dela.
 *
 * O TM Researcher troca N peças por um disco à sua escolha, com o MESMO N pra
 * qualquer tipo. Como acontece com a troca do Eevee, o preço não separa nada e a
 * pergunta inteira vira "qual". Por isso o painel de cima é a grade de discos e
 * não uma lista de pokémon: a coisa que se escolhe é o disco.
 *
 * A grade mostra os dezoito tipos mesmo onde não há golpe (o de AoE fica fora
 * dela, num aviso à parte: ele não ensina golpe nenhum). Normal, Aço e Fada têm
 * disco no jogo e nenhuma das 482 espécies aprende um golpe de TM desses tipos —
 * e um item que some da lista parece decisão nossa, não fato do catálogo. Eles
 * ficam, apagados, dizendo por quê.
 */
export function TmDiscos({
  linhas,
  escolhido,
  onEscolher,
  aoe,
  temBolsa,
}: {
  linhas: LinhaDisco[];
  escolhido: PokeType | null;
  onEscolher: (t: PokeType | null) => void;
  aoe: DiscoItem | undefined;
  temBolsa: boolean;
}) {
  const semGolpe = linhas.filter((l) => l.disco.golpe == null);
  const amostra = linhas.find((l) => l.item?.icone)?.item;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {amostra?.icone ? (
            <Sprite
              src={amostra.icone}
              alt=""
              size={18}
              fallback={null}
              className="[--sprite:18px]"
            />
          ) : null}
          <span className="pix">Os discos</span>
        </span>
      }
      actions={
        <span className="num text-[13px] text-text-mute">
          {linhas.length - semGolpe.length} com golpe · mesmo preço
        </span>
      }
      bodyClassName="flex flex-col gap-3"
      style={{ "--tint": TINT } as CSSProperties}
    >
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {linhas.map((l) => {
          const on = l.disco.tipo === escolhido;
          const vazio = l.disco.golpe == null;
          return (
            <li key={l.disco.tipo}>
              <button
                type="button"
                aria-pressed={on}
                disabled={vazio}
                onClick={() => onEscolher(on ? null : l.disco.tipo)}
                title={
                  vazio
                    ? `${l.item?.nome ?? l.disco.item}: nenhuma espécie aprende um golpe de TM deste tipo`
                    : `${l.disco.golpe?.name} — ${l.quantas} espécie${l.quantas === 1 ? "" : "s"}`
                }
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-pix border px-1.5 py-2.5",
                  "transition-[border-color,background-color,transform] duration-200",
                  vazio
                    ? "cursor-not-allowed border-line/60 opacity-45"
                    : on
                      ? "border-[var(--tint)] bg-[var(--tint)]/10"
                      : "border-line hover:border-[var(--tint)]/50 hover:bg-surface-2 motion-safe:hover:-translate-y-0.5",
                )}
              >
                {/* Só o símbolo do TIPO, e maior. O ícone do item que o jogo
                    publica é o MESMO arquivo (`tm_disk_elemental.png`) nos
                    dezoito: repetido dezoito vezes ele não separa nada e ainda
                    disputa o lugar do único glifo que separa. Ele aparece uma
                    vez, no título do painel, onde diz "o objeto é um disco". */}
                <TypeIcon type={l.disco.tipo} size={22} />

                <span className="w-full truncate text-center text-[12px] text-text-dim">
                  {TYPE_LABEL[l.disco.tipo]}
                </span>

                {vazio ? (
                  <span className="pix text-[9px] text-text-mute">
                    sem golpe
                  </span>
                ) : (
                  <span className="num text-[11px] text-text-mute">
                    {temBolsa && l.minhas != null ? (
                      <span style={{ color: l.minhas > 0 ? TINT : undefined }}>
                        {l.minhas} seu{l.minhas === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <>
                        {l.quantas} espécie{l.quantas === 1 ? "" : "s"}
                      </>
                    )}
                  </span>
                )}

                {!vazio && l.melhorRazao > 0 ? (
                  <span className="num text-[10px] text-text-mute">
                    até {num(l.melhorRazao, 1)}x
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {semGolpe.length > 0 ? (
        <Note tone="warn" flush>
          {semGolpe.map((l) => TYPE_LABEL[l.disco.tipo]).join(", ")} têm disco
          no jogo e <strong>nenhum golpe</strong>: das 482 espécies do catálogo,
          nenhuma aprende um TM desses tipos. Pode ser conteúdo que ainda vem —
          mas hoje trocar peças por eles não tem em quem usar.
        </Note>
      ) : null}

      {aoe ? (
        <Note flush>
          Existe ainda o <strong>{aoe.nome}</strong>, que não ensina golpe
          nenhum: ele faz os golpes <em>Normais</em> do pokémon passarem a
          acertar em área. Como o efeito não está no moveset do catálogo, nada
          aqui o simula — ele é decisão de farm, não de dano num alvo só.
        </Note>
      ) : null}
    </Panel>
  );
}
