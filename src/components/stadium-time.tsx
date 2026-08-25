"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { MetaMon } from "@/lib/meta";
import type { FichaMembro } from "@/lib/stadium";
import type { SlotState, StadiumState } from "@/lib/stadium-url";
import { spriteUrl } from "@/lib/sprites";
import { effLabel } from "@/lib/hunt";
import { compact, monLabel, num, pct } from "@/lib/labels";
import {
  Chip,
  Combobox,
  Field,
  IconClose,
  IconButton,
  NumberField,
  Segments,
  Sprite,
  type ComboOption,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel } from "@/components/game-icons";

const TINT = "var(--color-t-stadium)";

/**
 * O TIME: seis slots, na ordem em que eles entram.
 *
 * A carta de cada membro carrega duas coisas que não se substituem. Os campos
 * (espécie, nível, quality) são a ENTRADA; a ficha embaixo é o que aquele
 * pokémon vale CONTRA ESTE ALVO — e ela some quando não há alvo, porque sem alvo
 * ela não existe: dano por segundo é sempre dano por segundo contra alguém.
 *
 * A medida que manda é a FATIA — quanto do boss ele leva embora antes de cair.
 * Ela está aqui e não só no resultado porque é durante a montagem que ela decide
 * alguma coisa: trocar o quarto membro é barato antes de rodar o combate.
 */
export function StadiumTime({
  mons,
  state,
  fichas,
  onSlot,
  temAlvo,
}: {
  mons: MetaMon[];
  state: StadiumState;
  /** ficha por slot; ausente quando o slot está vazio ou não há alvo */
  fichas: Map<number, FichaMembro>;
  onSlot: (i: number, p: Partial<SlotState>) => void;
  temAlvo: boolean;
}) {
  const opcoes = useMemo<ComboOption<number>[]>(
    () =>
      mons
        .map((m) => ({
          value: m.pokeId,
          label: monLabel(m),
          keywords: String(m.pokeId),
          render: (
            <span className="flex items-center gap-2">
              <Sprite src={spriteUrl(m.pokeId)} alt={m.name} size={26} />
              {m.name}
            </span>
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [mons],
  );

  const byId = useMemo(() => new Map(mons.map((m) => [m.pokeId, m])), [mons]);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {state.time.map((slot, i) => (
        <CartaSlot
          key={i}
          indice={i}
          slot={slot}
          mon={slot.id != null ? byId.get(slot.id) ?? null : null}
          ficha={fichas.get(i) ?? null}
          opcoes={opcoes}
          onSlot={onSlot}
          temAlvo={temAlvo}
        />
      ))}
    </div>
  );
}

function CartaSlot({
  indice,
  slot,
  mon,
  ficha,
  opcoes,
  onSlot,
  temAlvo,
}: {
  indice: number;
  slot: SlotState;
  mon: MetaMon | null;
  ficha: FichaMembro | null;
  opcoes: ComboOption<number>[];
  onSlot: (i: number, p: Partial<SlotState>) => void;
  temAlvo: boolean;
}) {
  const vazio = slot.id == null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-pix border p-2.5",
        // Slot vazio é TRACEJADO, e essa é a única diferença de forma entre os
        // dois estados. Vazio com a mesma borda cheia do preenchido faz a grade
        // parecer um time de seis já montado com quatro erros de carregamento.
        vazio ? "border-dashed border-line-strong bg-surface-2/30" : "border-line-strong bg-surface-2/60",
      )}
      style={{ "--tint": TINT } as CSSProperties}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="pix text-[10px] text-text-mute">#{indice + 1}</span>
        <span className="flex items-center gap-1.5">
          {mon ? (
            <>
              <TypeBadge type={mon.type1} size="xs" showLabel={false} />
              {mon.type2 ? <TypeBadge type={mon.type2} size="xs" showLabel={false} /> : null}
              <IconButton
                label={`Tirar ${mon.name} do time`}
                title="Tirar do time"
                onClick={() => onSlot(indice, { id: null })}
              >
                <IconClose size={13} />
              </IconButton>
            </>
          ) : null}
        </span>
      </header>

      <div className="flex items-center gap-2">
        <Sprite
          src={mon ? spriteUrl(mon.pokeId) : null}
          alt={mon?.name ?? ""}
          size={40}
          className="[--sprite:40px]"
          fallback={<span className="pix text-[18px] text-line-strong">+</span>}
        />
        <div className="min-w-0 flex-1">
          <Combobox
            value={slot.id}
            onChange={(v) => onSlot(indice, { id: v })}
            options={opcoes}
            placeholder="adicionar pokémon"
          />
        </div>
      </div>

      {!vazio ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nível" icon={<IconLevel size={13} />}>
            <NumberField
              value={slot.level}
              onChange={(v) => onSlot(indice, { level: v })}
              min={1}
              max={1000}
              fallback={100}
            />
          </Field>
          <Field label="Quality" icon={<IconGem size={13} />}>
            <NumberField
              value={slot.quality}
              onChange={(v) => onSlot(indice, { quality: v })}
              min={0}
              max={10}
              step={0.001}
              fallback={1}
            />
          </Field>
        </div>
      ) : null}

      {!vazio && temAlvo && ficha ? <Ficha ficha={ficha} /> : null}

      {!vazio && !temAlvo ? (
        <p className="border-t border-line pt-2 text-[12px] italic leading-relaxed text-text-mute">
          Escolha o alvo pra saber o que ele vale aqui.
        </p>
      ) : null}
    </div>
  );
}

/** O que este membro vale contra ESTE alvo. */
function Ficha({ ficha }: { ficha: FichaMembro }) {
  const semGolpe = ficha.golpe == null;

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      {semGolpe ? (
        <p className="text-[12px] italic leading-relaxed text-danger">
          Nenhum golpe dele atravessa o tipo do alvo. Ele entra, apanha e sai sem tirar nada.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={ficha.golpe!.type} size="xs" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-text-dim">
              {ficha.golpe!.name}
            </span>
            <Chip
              size="xs"
              tone={ficha.eff > 1 ? "ok" : ficha.eff < 1 ? "danger" : "neutral"}
            >
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
              titulo="dano por segundo do moveset inteiro contra este alvo"
            />
            <Dado
              rotulo="aguenta"
              valor={Number.isFinite(ficha.ttdSozinho) ? `${num(ficha.ttdSozinho, 0)}s` : "∞"}
              titulo="quanto tempo ele fica de pé sozinho contra o alvo"
            />
          </dl>
        </>
      )}
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
