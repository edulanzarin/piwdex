"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { MetaMon } from "@/lib/meta";
import type { Carta } from "@/lib/bolsa";
import type { FichaMembro } from "@/lib/stadium";
import type { StadiumState } from "@/lib/stadium-url";
import { spriteUrl } from "@/lib/sprites";
import { effLabel } from "@/lib/hunt";
import { STAT_SHORT, compact, num, pct } from "@/lib/labels";
import { Badge, Button, Chip, IconButton, IconClose, Segments, Sprite } from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { Pencil } from "lucide-react";

const TINT = "var(--color-t-stadium)";

/**
 * O TIME: seis lugares, na ordem em que eles entram.
 *
 * O slot não é mais um formulário. Ele mostra uma CARTA — o pokémon que a pessoa
 * cadastrou com os stats do jogo — e a ficha do que aquela carta vale contra
 * este alvo. Ter os campos aqui dentro custava caro de duas maneiras: a mesma
 * espécie era redigitada a cada deck, e o slot cabia só o que dá pra derivar de
 * nível e quality, que exclui justamente o IV.
 *
 * A medida que manda é a FATIA — quanto do boss ele leva embora antes de cair.
 * Ela fica aqui, durante a montagem, porque é aqui que ela decide alguma coisa:
 * trocar o quarto membro é barato antes de rodar o combate.
 */
export function StadiumTime({
  mons,
  cartas,
  state,
  fichas,
  onAbrirBolsa,
  onEditarCarta,
  onTirar,
  temAlvo,
}: {
  mons: MetaMon[];
  cartas: Carta[];
  state: StadiumState;
  /** ficha por slot; ausente quando o slot está vazio ou não há alvo */
  fichas: Map<number, FichaMembro>;
  onAbrirBolsa: (slot: number) => void;
  onEditarCarta: (carta: Carta) => void;
  onTirar: (slot: number) => void;
  temAlvo: boolean;
}) {
  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);
  const porCarta = useMemo(() => new Map(cartas.map((c) => [c.id, c])), [cartas]);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {state.time.map((slot, i) => {
        const mon = slot.id != null ? byId.get(slot.id) ?? null : null;
        const carta = slot.carta ? porCarta.get(slot.carta) ?? null : null;
        return (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-2 rounded-pix border p-2.5",
              // Slot vazio é TRACEJADO, e é a única diferença de forma entre os
              // dois estados. Vazio com borda cheia faz a grade parecer um time
              // de seis montado com quatro erros de carregamento.
              mon
                ? "border-line-strong bg-surface-2/60"
                : "border-dashed border-line-strong bg-surface-2/30",
            )}
            style={{ "--tint": TINT } as CSSProperties}
          >
            <header className="flex items-center justify-between gap-2">
              <span className="pix text-[10px] text-text-mute">#{i + 1}</span>
              {mon ? (
                <span className="flex items-center gap-1.5">
                  <TypeBadge type={mon.type1} size="xs" showLabel={false} />
                  {mon.type2 ? <TypeBadge type={mon.type2} size="xs" showLabel={false} /> : null}
                  {carta ? (
                    <IconButton
                      label={`Editar a carta de ${carta.name}`}
                      title="Editar a carta"
                      size="sm"
                      onClick={() => onEditarCarta(carta)}
                    >
                      <Pencil size={12} strokeWidth={2.25} />
                    </IconButton>
                  ) : null}
                  <IconButton
                    label={`Tirar ${mon.name} do time`}
                    title="Tirar do time"
                    size="sm"
                    onClick={() => onTirar(i)}
                  >
                    <IconClose size={13} />
                  </IconButton>
                </span>
              ) : null}
            </header>

            {mon ? (
              <>
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => onAbrirBolsa(i)}
                  title="Trocar por outra carta da bolsa"
                >
                  <Sprite
                    src={spriteUrl(mon.pokeId, carta?.shiny)}
                    alt={mon.name}
                    size={40}
                    className="[--sprite:40px]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] text-text">
                      {carta?.name ?? mon.name}
                    </span>
                    <span className="pix text-[10px] text-text-mute">
                      LV {slot.level} · Q {num(slot.quality, 2)}
                    </span>
                  </span>
                  {carta?.shiny ? <Badge tone="accent" dot={false}>shiny</Badge> : null}
                </button>

                {/* Os stats REAIS, que é o que o combate usa. Eles ficam à vista
                    porque são a resposta pra "de onde saiu esse número" — sem
                    eles a ficha embaixo vira oráculo. */}
                <dl className="grid grid-cols-3 gap-x-2 gap-y-0.5 border-t border-line pt-2">
                  {slot.stats.map((v, k) => (
                    <div key={k} className="flex items-baseline justify-between gap-1">
                      <dt className="pix text-[9px] text-text-mute">{STAT_SHORT[k]}</dt>
                      <dd className="tabular text-[12px] text-text-dim">{compact(v)}</dd>
                    </div>
                  ))}
                </dl>

                {temAlvo && fichas.get(i) ? <Ficha ficha={fichas.get(i)!} /> : null}

                {!temAlvo ? (
                  <p className="border-t border-line pt-2 text-[12px] italic leading-relaxed text-text-mute">
                    Escolha o alvo pra saber o que ele vale aqui.
                  </p>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAbrirBolsa(i)}
                className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 text-text-mute transition-colors hover:text-text"
              >
                <span className="pix text-[26px] leading-none" style={{ color: TINT }}>
                  +
                </span>
                <span className="pix text-[10px]">ESCOLHER DA BOLSA</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** O que este membro vale contra ESTE alvo. */
function Ficha({ ficha }: { ficha: FichaMembro }) {
  if (!ficha.golpe) {
    return (
      <p className="border-t border-line pt-2 text-[12px] italic leading-relaxed text-danger">
        Nenhum golpe dele atravessa o tipo do alvo. Ele entra, apanha e sai sem tirar nada.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={ficha.golpe.type} size="xs" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-text-dim">
          {ficha.golpe.name}
        </span>
        <Chip size="xs" tone={ficha.eff > 1 ? "ok" : ficha.eff < 1 ? "danger" : "neutral"}>
          {effLabel(ficha.eff)}
        </Chip>
      </div>

      <Segments
        ratio={ficha.fatia}
        tint={ficha.fatia >= 1 ? "var(--color-ok)" : TINT}
        label="fatia do alvo"
        value={ficha.fatia}
        max={1}
      />

      <dl className="grid grid-cols-3 gap-x-2">
        <Dado
          rotulo="fatia"
          valor={pct(ficha.fatia * 100, ficha.fatia >= 0.1 ? 0 : 1)}
          titulo="quanto do HP do alvo ele leva embora antes de cair"
        />
        <Dado
          rotulo="dano/s"
          valor={compact(Math.round(ficha.dps))}
          titulo="dano por segundo do moveset inteiro, se todos os golpes chegarem a cair; recarga longa faz a fatia ficar bem abaixo disso"
        />
        <Dado
          rotulo="aguenta"
          valor={Number.isFinite(ficha.ttdSozinho) ? `${num(ficha.ttdSozinho, 0)}s` : "∞"}
          titulo="quanto tempo ele fica de pé sozinho contra o alvo"
        />
      </dl>
    </div>
  );
}

function Dado({ rotulo, valor, titulo }: { rotulo: string; valor: string; titulo: string }) {
  return (
    <div className="flex flex-col" title={titulo}>
      <dt className="pix text-[9px] text-text-mute">{rotulo.toUpperCase()}</dt>
      <dd className="tabular text-[13px] text-text">{valor}</dd>
    </div>
  );
}
