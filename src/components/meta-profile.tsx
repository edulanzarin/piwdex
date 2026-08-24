"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  STAT_KEYS,
  TIER_COLOR,
  nemeses,
  preys,
  roleOf,
  statStandings,
  type Duel,
  type MetaEntry,
  type MetaMon,
  type MovePool,
} from "@/lib/meta";
import { effLabel } from "@/lib/hunt";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { TYPE_COLOR } from "@/lib/typing";
import { META_ROLE_HINT, META_ROLE_LABEL, STAT_LABEL, TYPE_LABEL, monLabel, num} from "@/lib/labels";
import {
  Chip,
  FieldLabel,
  IconChevronRight,
  Modal,
  Note,
  Sprite,
  StatTile,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { STAT_ICONS } from "@/components/game-icons";

/**
 * O perfil de uma especie: a nota por extenso.
 *
 * A tier list responde "quanto ele vale"; aqui responde-se **por que** — de que lado
 * vem a nota (bater ou aguentar), com que golpe, e contra quem isso ganha ou perde.
 *
 * Algozes e presas medem os DOIS lados do duelo, e nao "tem golpe super efetivo
 * contra voce" — esse criterio promove qualquer bicho fraco com o tipo certo. Quem
 * entra na lista de algozes e quem te DERRUBA PRIMEIRO.
 */
export function MetaProfile({
  entry,
  mons,
  pool,
  onOpen,
  onClose,
}: {
  entry: MetaEntry | null;
  mons: MetaMon[];
  pool: MovePool;
  onOpen: (m: MetaMon) => void;
  onClose: () => void;
}) {
  const c = entry?.creature ?? null;

  const perfil = useMemo(() => {
    if (!c) return null;
    const st = statStandings(c, mons);
    return {
      st,
      papel: roleOf(st),
      algozes: nemeses(c, mons, 6, pool),
      presas: preys(c, mons, 6, pool),
    };
  }, [c, mons, pool]);

  if (!entry || !c || !perfil) return <Modal open={false} onClose={onClose}>{null}</Modal>;

  const tint = TYPE_COLOR[c.type1];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      eyebrow={`Meta · ${entry.position}º de ${mons.length}`}
      title={
        <span className="flex items-center gap-3">
          <Sprite
            src={spriteUrl(c.pokeId)}
            animatedSrc={animatedSpriteUrl(c.pokeId)}
            alt={c.name}
            size={44}
          />
          <span className="flex flex-col gap-1">
            <span>{monLabel(c)}</span>
            <span className="flex items-center gap-1.5">
              <TypeBadge type={c.type1} size="xs" />
              {c.type2 ? <TypeBadge type={c.type2} size="xs" /> : null}
            </span>
          </span>
        </span>
      }
      footer={
        <Link
          href={`/dex/${c.pokeId}`}
          className="pix flex items-center gap-1 text-[12px] text-text-dim transition-colors hover:text-accent"
        >
          ver a ficha completa na dex
          <IconChevronRight size={14} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---- a nota e de onde ela vem ---- */}
        <div className="flex flex-wrap items-center gap-4 rounded-pix border border-line-strong bg-surface-2/60 p-3">
          <span
            className="pix grid h-14 w-14 shrink-0 place-items-center rounded-pix border-2 text-[28px]"
            style={{
              color: TIER_COLOR[entry.tier],
              borderColor: TIER_COLOR[entry.tier],
              backgroundColor: `color-mix(in oklab, ${TIER_COLOR[entry.tier]} 12%, transparent)`,
            }}
          >
            {entry.tier}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[30px] leading-none font-bold text-text tabular">{entry.score}</span>
            <span className="pix text-[11px] text-text-mute">de 100</span>
          </span>
          <span className="flex min-w-[12rem] flex-1 flex-col gap-2">
            <Eixo label="Ataque" valor={entry.offense} cor="var(--color-danger)" />
            <Eixo label="Resistência" valor={entry.bulk} cor="var(--color-ok)" />
          </span>
          <Tooltip content={META_ROLE_HINT[perfil.papel]}>
            <Chip tint={tint}>{META_ROLE_LABEL[perfil.papel]}</Chip>
          </Tooltip>
        </div>

        {entry.best ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <FieldLabel>Golpe que define a velocidade</FieldLabel>
            <Chip tint={TYPE_COLOR[entry.best.attack.type]} icon={<TypeIcon type={entry.best.attack.type} size={14} />}>
              {entry.best.attack.name}
            </Chip>
            <span className="text-[13px] text-text-mute">
              poder {entry.best.attack.power} a cada {num(entry.best.attack.cooldownMs / 1000, 1)}s
              {entry.best.stab ? " · com STAB" : ""}
              {entry.best.tm ? " · é TM" : ""}
            </span>
          </div>
        ) : (
          <Note flush>Esta espécie não tem golpe de dano no pool escolhido.</Note>
        )}

        {/* ---- onde cada stat cai dentro do catalogo ---- */}
        <div className="flex flex-col gap-2">
          <FieldLabel>Cada stat dentro do catálogo</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STAT_KEYS.map((k, i) => {
              const s = perfil.st[k];
              const Icon = STAT_ICONS[i];
              return (
                <StatTile
                  key={k}
                  label={STAT_LABEL[i]}
                  icon={<Icon size={14} />}
                  value={s.value}
                  ratio={s.percentile}
                  tint={tint}
                  footLeft={`supera ${Math.round(s.percentile * 100)}%`}
                  footRight={`${s.rank}º`}
                />
              );
            })}
          </div>
        </div>

        {/* ---- os dois lados do confronto ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ListaDuelo
            titulo="Quem derruba ele"
            vazio="Ninguém do catálogo derruba ele primeiro."
            duelos={perfil.algozes}
            onOpen={onOpen}
            perigo
          />
          <ListaDuelo
            titulo="Quem ele derruba"
            vazio="Ele não tem vantagem clara sobre ninguém."
            duelos={perfil.presas}
            onOpen={onOpen}
          />
        </div>

        <Note flush>
          A nota combina bater (55%) e aguentar (45%), e cada eixo é normalizado pelo maior
          do catálogo. Bater é dano por SEGUNDO, com a recarga do golpe dentro; aguentar é
          HP vezes defesa, porque os dois se multiplicam — somar esconde o tanque.
        </Note>
      </div>
    </Modal>
  );
}

function Eixo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="pix w-24 shrink-0 text-[11px] text-text-mute">{label}</span>
      {/* Pilula, e nao retangulo. `h-2` de canto reto era o dialeto antigo
          sobrevivendo aqui — a espinha de stats do card da dex ja fez essa troca,
          e num trilho de 8px de altura o raio cheio custa nada e e a diferenca
          entre "medidor" e "risco". */}
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-bg-soft ring-1 ring-line">
        <span
          className="block h-full rounded-pill"
          style={{ width: `${Math.round(valor * 100)}%`, backgroundColor: cor }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-[12px] text-text-dim tabular">
        {Math.round(valor * 100)}
      </span>
    </span>
  );
}

function ListaDuelo({
  titulo,
  vazio,
  duelos,
  onOpen,
  perigo,
}: {
  titulo: string;
  vazio: string;
  duelos: Duel[];
  onOpen: (m: MetaMon) => void;
  perigo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border border-line bg-surface/60 p-3">
      <FieldLabel>{titulo}</FieldLabel>
      {duelos.length === 0 ? (
        <p className="text-[13px] text-text-mute">{vazio}</p>
      ) : (
        <ul className="flex flex-col">
          {duelos.map((d) => {
            const golpe = perigo ? d.theirs : d.mine;
            return (
              <li key={d.other.pokeId}>
                <button
                  type="button"
                  onClick={() => onOpen(d.other)}
                  className="group flex w-full items-center gap-2 border-b border-line/60 py-1.5 text-left last:border-0"
                >
                  <Sprite src={spriteUrl(d.other.pokeId)} alt={d.other.name} size={28} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-text-dim transition-colors group-hover:text-accent">
                    {monLabel(d.other)}
                  </span>
                  {golpe.move ? (
                    <Tooltip content={`${golpe.move.name} · ${TYPE_LABEL[golpe.move.type]}`}>
                      <span className="shrink-0">
                        <TypeIcon type={golpe.move.type} size={14} />
                      </span>
                    </Tooltip>
                  ) : null}
                  <span
                    className={cn(
                      "shrink-0 text-[13px] tabular",
                      perigo ? "text-danger" : "text-ok",
                    )}
                  >
                    {effLabel(golpe.eff)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
