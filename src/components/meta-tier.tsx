"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { TIERS, TIER_COLOR, tierFloor, type MetaEntry, type MetaMon, type MovePool, type Tier } from "@/lib/meta";
import type { MetaState } from "@/lib/meta-url";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_LABEL, monLabel } from "@/lib/labels";
import type { PokeType } from "@/lib/types";
import { Button, Empty, Field, Panel, SearchInput, Select, Sprite } from "@/components/ui";
import { TypeIcon } from "@/components/type-icon";

/**
 * A tier list.
 *
 * Ela e uma FAIXA por tier, com os pokemon dentro — e nao uma tabela ordenada por
 * nota. O formato importa: tier list e um idioma que o jogador ja le, e o sprite
 * grande e o que faz reconhecer sem soletrar nome.
 *
 * O corte e por SCORE, nao por posicao na fila. Cortar por posicao (top 10% = S)
 * faz o tier dizer "seu lugar na fila" em vez de "sua forca": se o jogo buffar
 * trinta especies, no corte por posicao alguem teria que DESCER pra abrir vaga.
 * Aqui elas sobem e ponto — e a regua de cada tier fica a vista, ao lado da letra.
 */

const TIPOS: PokeType[] = [
  "NORMAL", "FIRE", "WATER", "ELECTRIC", "GRASS", "ICE", "FIGHTING", "POISON", "GROUND",
  "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "DARK", "STEEL", "FAIRY",
];

/** Quantos aparecem por faixa antes do "mostrar todos". Uma faixa E com 200 sprites
 *  empurra as outras pra fora da tela e ninguem rola ate o fim dela. */
const POR_FAIXA = 48;

export function MetaTier({
  table,
  state,
  patch,
  onOpen,
}: {
  table: MetaEntry[];
  state: MetaState;
  patch: (p: Partial<MetaState>) => void;
  onOpen: (m: MetaMon) => void;
}) {
  const [abertas, setAbertas] = useState<Tier[]>([]);

  const filtradas = useMemo(() => {
    const busca = state.q.trim().toLowerCase();
    return table.filter((e) => {
      const c = e.creature;
      if (busca && !c.name.toLowerCase().includes(busca)) return false;
      if (state.type && c.type1 !== state.type && c.type2 !== state.type) return false;
      if (state.tier && e.tier !== state.tier) return false;
      return true;
    });
  }, [table, state.q, state.type, state.tier]);

  const faixas = TIERS.map((tier) => ({
    tier,
    linhas: filtradas.filter((e) => e.tier === tier),
  })).filter((f) => f.linhas.length > 0);

  const filtros = (state.q ? 1 : 0) + (state.type ? 1 : 0) + (state.tier ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <Panel bodyClassName="flex flex-wrap items-start gap-x-3 gap-y-3">
        <Field label="Buscar" className="min-w-[14rem] flex-1">
          <SearchInput
            value={state.q}
            onChange={(e) => patch({ q: e.currentTarget.value })}
            onClear={() => patch({ q: "" })}
            placeholder="nome do pokémon..."
          />
        </Field>

        <Field label="Tipo" className="w-[12rem]">
          <Select
            value={state.type}
            onChange={(type) => patch({ type: type as PokeType | "" })}
            options={[
              { value: "", label: "todos" },
              ...TIPOS.map((t) => ({
                value: t,
                label: TYPE_LABEL[t],
                render: (
                  <span className="flex items-center gap-2">
                    <TypeIcon type={t} size={14} />
                    {TYPE_LABEL[t]}
                  </span>
                ),
              })),
            ]}
          />
        </Field>

        <Field label="Tier">
          <span className="flex h-10 items-center gap-1.5">
            {TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                title={`Nota ${tierFloor(tier, state.pool)} pra cima`}
                onClick={() => patch({ tier: state.tier === tier ? "" : tier })}
                className={cn(
                  "pix grid h-8 w-8 place-items-center border text-[13px] transition-opacity",
                  state.tier && state.tier !== tier && "opacity-35",
                )}
                style={{ color: TIER_COLOR[tier], borderColor: TIER_COLOR[tier] }}
              >
                {tier}
              </button>
            ))}
          </span>
        </Field>

        {filtros > 0 ? (
          <Field>
            <Button variant="ghost" size="lg" onClick={() => patch({ q: "", type: "", tier: "" })}>
              limpar filtros
            </Button>
          </Field>
        ) : null}
      </Panel>

      {faixas.length === 0 ? (
        <Panel>
          <Empty
            title="Nenhum pokémon com esse recorte"
            hint="Solte um dos filtros pra a lista voltar."
            action={
              <Button variant="primary" onClick={() => patch({ q: "", type: "", tier: "" })}>
                limpar filtros
              </Button>
            }
          />
        </Panel>
      ) : (
        faixas.map(({ tier, linhas }) => {
          const aberta = abertas.includes(tier);
          const mostradas = aberta ? linhas : linhas.slice(0, POR_FAIXA);
          const cor = TIER_COLOR[tier];
          return (
            <section key={tier} className="flex border border-line bg-surface/60">
              {/* A letra e a regua do corte: sem o piso, "S" e so uma letra bonita.
                  Ela GRUDA no topo em vez de centralizar: no celular a faixa E tem
                  vinte linhas de altura, e centralizado o rotulo ficava no meio de
                  um paredao de sprites, invisivel de onde a faixa comeca. */}
              <div
                className="flex w-16 shrink-0 flex-col items-center border-r px-2 py-3"
                style={{ borderColor: cor, backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)` }}
              >
                <span className="sticky top-[4.5rem] flex flex-col items-center gap-1">
                  <span className="pix text-[26px] leading-none" style={{ color: cor }}>{tier}</span>
                  <span className="pix text-[10px] text-text-mute">{tierFloor(tier, state.pool)}+</span>
                  <span className="text-[11px] text-text-mute tabular">{linhas.length}</span>
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap content-start gap-1.5 p-2.5">
                {mostradas.map((e) => (
                  <CartaoTier key={e.creature.pokeId} e={e} onOpen={() => onOpen(e.creature)} />
                ))}
                {linhas.length > POR_FAIXA ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAbertas((cur) => (aberta ? cur.filter((x) => x !== tier) : [...cur, tier]))
                    }
                    className="tap pix self-center px-3 text-[11px] text-text-mute transition-colors hover:text-accent"
                  >
                    {aberta ? "mostrar menos" : `+${linhas.length - POR_FAIXA} restantes`}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/** Um pokemon dentro da faixa: sprite grande, nome pequeno, nota. O sprite e o que
 *  se reconhece de relance; o resto e confirmacao. */
function CartaoTier({ e, onOpen }: { e: MetaEntry; onOpen: () => void }) {
  const c = e.creature;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${monLabel(c)} — nota ${e.score}`}
      className="group flex w-[72px] flex-col items-center gap-0.5 border border-transparent bg-bg-soft/50 px-1 py-1.5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <Sprite src={spriteUrl(c.pokeId)} alt={c.name} size={40} />
      <span className="w-full truncate text-center text-[11px] text-text-dim transition-colors group-hover:text-text">
        {c.name}
      </span>
      <span className="pix flex items-baseline gap-1 text-[10px] text-text-mute tabular">
        {e.score}
        {/* Orre repete o nome da base com stats proprios: sem a marca, a mesma
            palavra aparece duas vezes na faixa com notas diferentes. */}
        {c.area === "orre" ? <span className="text-[9px] text-neon">orre</span> : null}
      </span>
    </button>
  );
}
