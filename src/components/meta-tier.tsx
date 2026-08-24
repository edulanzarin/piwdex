"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { TIERS, TIER_COLOR, tierFloor, type MetaEntry, type MetaMon, type MovePool, type Tier } from "@/lib/meta";
import type { MetaState } from "@/lib/meta-url";
import { spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
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
            <section key={tier} className="panel flex overflow-hidden p-0">
              {/* A letra e a regua do corte: sem o piso, "S" e so uma letra bonita.
                  Ela GRUDA no topo em vez de centralizar: no celular a faixa E tem
                  vinte linhas de altura, e centralizado o rotulo ficava no meio de
                  um paredao de sprites, invisivel de onde a faixa comeca. */}
              <div
                className="flex w-16 shrink-0 flex-col items-center border-r px-2 py-3"
                style={{
                  borderColor: `color-mix(in oklab, ${cor} 55%, transparent)`,
                  backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)`,
                }}
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

/**
 * Um pokemon dentro da faixa — o card do site, em escala de tile.
 *
 * Ele era um retangulo cinza de canto reto com sprite, nome e nota: a unica peca
 * do site que nao tinha nem raio, nem superficie propria, nem cor de dado
 * nenhuma. Quatrocentos e oitenta e dois deles empilhados eram o que fazia a
 * tier list parecer de outra epoca ao lado da dex.
 *
 * Duas coisas mudam, e a segunda e informacao e nao acabamento:
 *
 * 1. A silhueta e a dos outros cards — painel de arte, placa com fio em cima,
 *    medalhao montado na costura, elevacao e subida no hover.
 *
 * 2. **O TIPO aparece.** Ele nao aparecia em lugar nenhum da tier list, e essa e
 *    a falta mais cara da tela: a lista existe pra decidir quem usar, e a
 *    primeira coisa que decide isso e contra o que aquilo bate. A pessoa tinha de
 *    reconhecer o tipo pelo sprite ou abrir o perfil.
 *
 * O `--tint` sai do TIPO, e nao do tier. Dentro de uma faixa todo mundo tem o
 * mesmo tier — a letra ja esta na regua a esquerda, gigante —, entao pintar os
 * quarenta e oito tiles da mesma cor nao separaria um do outro. Tipo e o que
 * varia aqui dentro.
 */
function CartaoTier({ e, onOpen }: { e: MetaEntry; onOpen: () => void }) {
  const c = e.creature;
  const tipos = [c.type1, c.type2].filter(Boolean) as PokeType[];
  const tint = TYPE_COLOR[c.type1];

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${monLabel(c)} — ${tipos.map((t) => TYPE_LABEL[t]).join(" / ")} — nota ${e.score}`}
      style={{ ["--tint" as string]: tint }}
      className={cn(
        // 100px, e nao 76.
        //
        // A 76 a peca ficava fina e esmagada: o sprite saia a 48 dentro de um
        // painel quadrado (sobrava mais moldura que bicho), e metade dos nomes
        // do catalogo truncava — "Mega Alak...", "Kangaskh...", "Mega Luca...".
        // Nome cortado num tile cuja funcao e RECONHECER anula o tile.
        //
        // O ganho de densidade que os 76 davam era falso: cabiam 16 por linha,
        // mas quatro deles nao diziam quem eram.
        "panel-card group flex w-[116px] flex-col overflow-hidden text-center",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-[color:var(--tint)] hover:shadow-elev-3",
        "focus-visible:border-[color:var(--tint)]",
      )}
    >
      <span className="relative grid aspect-square w-full place-items-center overflow-hidden bg-bg-soft">
        {/* Caixa FIXA no tamanho maior, so `transform` anima — sao ate 482
            destes na tela, e animar a caixa de um elemento borrado obriga o
            navegador a rasterizar o desfoque a cada quadro. */}
        <span
          aria-hidden="true"
          className="absolute h-20 w-20 origin-center scale-[0.72] rounded-full blur-xl transition-transform duration-300 ease-out group-hover:scale-100"
          style={{ backgroundColor: tint, opacity: 0.2 }}
        />
        <Sprite
          src={spriteUrl(c.pokeId)}
          alt={c.name}
          size={72}
          className="relative transition-transform duration-300 ease-out motion-safe:group-hover:scale-110"
        />
      </span>

      {/* ---- o TIPO, em ICONE ----

          Aqui houve ida e volta, e vale registrar as duas pontas. A faixa de cor
          de 3px entrou porque o medalhao do card grande reprovou por escala: o
          glifo teria de sair a 12px, abaixo do piso de 14, e dois discos comiam
          quase metade de uma peca de 76.

          O que mudou nao foi a opiniao, foram os dois numeros. A peca cresceu pra
          116, e os glifos de tipo deixaram de ser traco fino e passaram a ser
          desenhados CHEIOS — e cheio a 14px se le, enquanto contorno de 2px no
          mesmo tamanho vira cinza. Com as duas coisas, o icone cabe e diz mais
          que a faixa: cor sozinha exige saber a paleta de cor, o simbolo nao.

          Eles ficam DENTRO da placa, numa linha propria acima do nome, e nao
          montados na costura: na costura seriam dois discos com borda e sombra
          disputando com o sprite, que e o erro que a faixa tinha vindo corrigir. */}
      <span className="relative flex flex-col items-center gap-1 border-t border-line bg-surface-2/70 px-1.5 pt-1.5 pb-2 transition-colors duration-200 group-hover:bg-surface-3/70">
        <span aria-hidden="true" className="flex items-center gap-1">
          {tipos.map((t) => (
            <TypeIcon key={t} type={t} size={20} style={{ color: TYPE_COLOR[t] }} />
          ))}
        </span>

        <span className="w-full truncate text-[12px] leading-tight text-text-dim transition-colors group-hover:text-text">
          {c.name}
        </span>
        <span className="num flex items-baseline gap-1 text-[13px] leading-none text-text-mute tabular">
          {e.score}
          {/* Orre repete o nome da base com stats proprios: sem a marca, a mesma
              palavra aparece duas vezes na faixa com notas diferentes. */}
          {c.area === "orre" ? <span className="pix text-[8px] text-neon">orre</span> : null}
        </span>
      </span>
    </button>
  );
}
