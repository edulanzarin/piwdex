"use client";

import { useMemo } from "react";
import { typeStandings, type MetaMon, type MovePool } from "@/lib/meta";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, compact, monLabel } from "@/lib/labels";
import { Chip, Note, Panel, Sprite } from "@/components/ui";
import { TypeIcon } from "@/components/type-icon";

/**
 * O panorama ofensivo por tipo: com que tipo o jogo bate mais forte, quem carrega
 * esse tipo e quantas especies o tem.
 *
 * A pergunta que isto responde e de MONTAGEM, nao de duelo: "meu time nao tem nada
 * de Pedra — quem eu pego pra isso?". Por isso a linha aponta o melhor usuario do
 * tipo, e nao so o numero.
 *
 * O DPS aqui e neutro (sem alvo): a defesa do outro lado seria uma constante e nao
 * muda ordem nenhuma. Quem quer o numero contra um alvo concreto usa o Duelo.
 */
export function MetaTypes({
  mons,
  pool,
  onOpen,
}: {
  mons: MetaMon[];
  pool: MovePool;
  onOpen: (m: MetaMon) => void;
}) {
  const linhas = useMemo(() => {
    const mapa = typeStandings(mons, pool);
    return [...mapa.values()].sort((a, b) => b.bestDps - a.bestDps);
  }, [mons, pool]);

  const teto = Math.max(1, ...linhas.map((l) => l.bestDps));

  return (
    <div className="flex flex-col gap-3">
      <Panel bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-surface-2/92">
              <tr className="border-b border-line-strong">
                {["Tipo", "Bate mais forte com", "Quem carrega", "Espécies do tipo"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`pix px-3 py-2.5 text-[11px] whitespace-nowrap text-text-mute ${i >= 2 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.type} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2">
                    <Chip tint={TYPE_COLOR[l.type]} icon={<TypeIcon type={l.type} size={14} />}>
                      {TYPE_LABEL[l.type]}
                    </Chip>
                  </td>

                  <td className="px-3 py-2">
                    {l.bestUser && l.bestMove ? (
                      <button
                        type="button"
                        onClick={() => onOpen(l.bestUser!)}
                        className="group flex w-full items-center gap-2.5 text-left"
                      >
                        <Sprite src={spriteUrl(l.bestUser.pokeId)} alt={l.bestUser.name} size={32} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] text-text transition-colors group-hover:text-accent">
                            {monLabel(l.bestUser)}
                          </span>
                          <span className="pix text-[10px] text-text-mute">{l.bestMove.name}</span>
                        </span>
                        {/* a barra e comparada com o TIPO mais forte do jogo, nao com
                            o maior desta linha — e o que deixa ver a distancia entre
                            um tipo que tem um golpe bom e um que nao tem */}
                        <span className="ml-auto flex min-w-0 flex-1 items-center gap-2">
                          <span className="h-1.5 min-w-0 flex-1 bg-bg-soft ring-1 ring-line">
                            <span
                              className="block h-full"
                              style={{
                                width: `${Math.round((l.bestDps / teto) * 100)}%`,
                                backgroundColor: TYPE_COLOR[l.type],
                              }}
                            />
                          </span>
                          <span className="w-14 shrink-0 text-right text-[13px] text-text-dim tabular">
                            {compact(Math.round(l.bestDps))}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <span className="text-[13px] text-text-mute">nenhum golpe de dano neste pool</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">{l.users}</td>
                  <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">{l.species}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Note flush>
        &quot;Bate mais forte&quot; é dano por segundo, com a recarga do golpe na conta e com
        STAB quando o dono é do mesmo tipo. Não é o poder do golpe: um de 160 a cada 30s
        rende menos que um de 60 a cada 5s. &quot;Quem carrega&quot; conta quantas espécies
        têm algum golpe do tipo; a última coluna conta quem É do tipo.
      </Note>
    </div>
  );
}
