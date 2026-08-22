"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { RISK_COLOR, type Species, type MovesOf } from "@/lib/combat";
import {
  RISK_LABEL,
  economyOf,
  type HuntEntrada,
  effLabel,
  perHourLabel,
  rankHunts,
  sortRows,
  withEconomy,
  type HuntRow,
  type HuntSort,
} from "@/lib/hunt";
import type { HuntPayload } from "@/lib/hunt-data";
import type { HuntState } from "@/lib/hunt-url";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, compact } from "@/lib/labels";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import {
  Button,
  Checkbox,
  Chip,
  Empty,
  Field,
  FieldLabel,
  IconChevronRight,
  IconCoin,
  IconInfo,
  Input,
  Modal,
  Note,
  Pagination,
  Panel,
  Select,
  Sprite,
  StatTile,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { BallIcon } from "@/components/ball-icon";
import { IconLevel, IconTarget, IconXp } from "@/components/game-icons";

/**
 * "Onde eu cacço agora": todo alvo do jogo medido contra o SEU pokemon.
 *
 * O que faz esta tabela ser diferente de uma lista de XP por especie: cada linha
 * e uma simulacao dos DOIS lados do combate. A coluna de rendimento ja e efetiva
 * — se o alvo te derruba, o tempo parado na Joy saiu do XP/h antes de a linha ser
 * ordenada. Uma hunt de XP altissimo que te mata cai sozinha pro fim da lista, em
 * vez de liderar e mandar o jogador pro matadouro.
 *
 * Por isso tambem nao ha teto de nivel implicito: o alvo alto demais nao precisa
 * ser escondido por regra, ele se denuncia no risco e no rendimento.
 */

const PAGE_SIZE = 25;

const TIPOS: PokeType[] = [
  "NORMAL", "FIRE", "WATER", "ELECTRIC", "GRASS", "ICE", "FIGHTING", "POISON", "GROUND",
  "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "DARK", "STEEL", "FAIRY",
];

const areaLabel = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);
const pct = (v: number) => (v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(3)}%`);

type Col = { key: HuntSort | null; label: string; align?: "right"; title?: string };

export function HuntRanking({
  state,
  patch,
  fighter,
  ivs,
  entrada,
  payload,
  movesOf,
  tint,
}: {
  state: HuntState;
  patch: (p: Partial<HuntState>) => void;
  fighter: Species;
  ivs: number[];
  /** o pokemon e o cenario JA aplicados — o rascunho do formulario nao entra aqui */
  entrada: HuntEntrada;
  payload: HuntPayload;
  movesOf: MovesOf;
  tint: string;
}) {
  const [aberto, setAberto] = useState<HuntRow | null>(null);

  // A economia (Tipo do Dia + captura) e calculada uma vez e entra no motor pelo
  // `goldEV` do alvo — assim o ouro/h ja sai completo sem o motor saber de bonus.
  const econ = useMemo(
    () =>
      economyOf(payload.targets, {
        day: entrada.day,
        drops: payload.drops,
        ballKey: entrada.ball,
        withCatch: entrada.cap,
      }),
    [payload.targets, payload.drops, entrada.day, entrada.ball, entrada.cap],
  );

  const rows = useMemo(
    () =>
      rankHunts(fighter, {
        targets: withEconomy(payload.targets, econ),
        econ,
        movesOf,
        level: entrada.level,
        ivs,
        quality: entrada.quality,
        vip: entrada.vip,
        pool: entrada.pool,
      }),
    [fighter, payload.targets, econ, movesOf, entrada.level, ivs, entrada.quality, entrada.vip, entrada.pool],
  );

  const filtradas = useMemo(
    () =>
      rows.filter((r) => {
        const t = r.target;
        if (state.type && t.t1 !== state.type && t.t2 !== state.type) return false;
        if (state.area && !t.areas.includes(state.area)) return false;
        if (state.maxLvl != null && t.huntLevel > state.maxLvl) return false;
        if (state.safe && r.est.threat.risk === "deadly") return false;
        return true;
      }),
    [rows, state.type, state.area, state.maxLvl, state.safe],
  );

  const ordenadas = useMemo(
    () => sortRows(filtradas, state.sort, state.dir),
    [filtradas, state.sort, state.dir],
  );

  const pageCount = Math.max(1, Math.ceil(ordenadas.length / PAGE_SIZE));
  const page = Math.min(state.page, pageCount - 1);
  const shown = ordenadas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // O teto dos medidores do detalhe: o MAIOR de cada grandeza entre as hunts que
  // a lista mostra. Denominador inventado ("kosH / 1200") e barra decorativa — com
  // o teto vindo da propria lista, a barra responde "o quanto isto e da melhor".
  const teto = useMemo(
    () => ({
      kos: Math.max(1, ...filtradas.map((r) => r.est.kosH)),
      xp: Math.max(1, ...filtradas.map((r) => r.est.xpH)),
      gold: Math.max(1, ...filtradas.map((r) => r.est.goldH)),
    }),
    [filtradas],
  );

  const filtros = (state.type ? 1 : 0) + (state.area ? 1 : 0) + (state.maxLvl != null ? 1 : 0) + (state.safe ? 1 : 0);

  const COLUMNS: Col[] = [
    { key: "name", label: "Alvo" },
    { key: "level", label: "Onde", title: "Ordena pelo nível da hunt" },
    { key: "eff", label: "Seu golpe" },
    { key: "kos", label: "Abates/h", align: "right", title: "Já descontando o tempo parado por desmaio" },
    { key: "xp", label: "XP/h", align: "right" },
    { key: "gold", label: entrada.cap ? "Ouro/h + captura" : "Ouro/h", align: "right" },
    { key: "risk", label: "Risco", title: "Quantos abates a vida cheia aguenta nesta hunt" },
  ];

  const sortBy = (k: HuntSort) =>
    state.sort === k
      ? patch({ dir: state.dir === "desc" ? "asc" : "desc", page: 0 })
      : patch({ sort: k, dir: "desc", page: 0 });

  return (
    <div className="flex flex-col gap-3">
      {/* ---- filtros ----
          Trilho horizontal e nao gaveta: sao quatro controles, e o conteudo desta
          tela e a tabela — filtro aqui acompanha, nao decide. */}
      <Panel
        title={<span className="pix">Todas as hunts, medidas contra o seu pokémon</span>}
        bodyClassName="flex flex-wrap items-start gap-x-3 gap-y-3"
      >
        <Field label="Tipo do alvo" className="w-[12rem]">
          <Select
            value={state.type}
            onChange={(type) => patch({ type: type as PokeType | "", page: 0 })}
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

        <Field label="Área" className="w-[12rem]">
          <Select
            value={state.area}
            onChange={(area) => patch({ area, page: 0 })}
            options={[
              { value: "", label: "todas" },
              ...payload.areas.map((a) => ({ value: a, label: areaLabel(a) })),
            ]}
          />
        </Field>

        <Field label="Nível máximo da hunt" icon={<IconLevel size={14} />} className="w-[11rem]">
          <Input
            inputMode="numeric"
            placeholder="sem limite"
            value={state.maxLvl ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value.trim();
              patch({ maxLvl: v === "" ? null : Math.max(1, Number(v) || 1), page: 0 });
            }}
          />
        </Field>

        <Field>
          <Checkbox
            boxed
            checked={state.safe}
            onChange={(e) => patch({ safe: e.currentTarget.checked, page: 0 })}
            label="esconder as letais"
          />
        </Field>

        {filtros > 0 ? (
          <Field>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => patch({ type: "", area: "", maxLvl: null, safe: false, page: 0 })}
            >
              limpar filtros
            </Button>
          </Field>
        ) : null}
      </Panel>

      {/* ---- a tabela ---- */}
      {ordenadas.length === 0 ? (
        <Panel>
          <Empty
            title="Nenhuma hunt bate com esses filtros"
            hint={
              filtros > 0
                ? "Solte um dos filtros pra a lista voltar."
                : "Este pokémon não consegue machucar nenhum alvo do catálogo."
            }
            action={
              filtros > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => patch({ type: "", area: "", maxLvl: null, safe: false, page: 0 })}
                >
                  limpar filtros
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <div className="max-h-[calc(100dvh-11rem)] overflow-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface-2/92 backdrop-blur-xl">
                <tr className="border-b border-line-strong">
                  {COLUMNS.map((col) => {
                    const on = col.key && state.sort === col.key;
                    return (
                      <th
                        key={col.label}
                        scope="col"
                        title={col.title}
                        className={cn("px-3 py-2.5 whitespace-nowrap", col.align === "right" && "text-right")}
                      >
                        {col.key ? (
                          <button
                            type="button"
                            onClick={() => sortBy(col.key as HuntSort)}
                            className={cn(
                              "pix inline-flex items-center gap-1 text-[11px] transition-colors",
                              on ? "text-accent" : "text-text-mute hover:text-text-dim",
                            )}
                          >
                            {col.label}
                            {on ? <span className="text-[7px]">{state.dir === "asc" ? "▲" : "▼"}</span> : null}
                          </button>
                        ) : (
                          <span className="pix text-[11px] text-text-mute">{col.label}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <Linha key={r.target.pokeId} r={r} onOpen={() => setAberto(r)} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {ordenadas.length > 0 ? (
        <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-between">
          <span className="text-[13px] text-text-mute tabular">
            {page * PAGE_SIZE + 1}–{Math.min(ordenadas.length, (page + 1) * PAGE_SIZE)} de {ordenadas.length} hunts
          </span>
          <Pagination page={page} pageCount={pageCount} onChange={(p) => patch({ page: p })} />
        </div>
      ) : null}

      <Note flush icon={<IconInfo size={15} />}>
        O jogo não publica a fórmula de dano nem a de captura: estes números são
        ESTIMATIVA, calibrada contra medições reais pra comparar hunts. A ordem é
        confiável; o valor absoluto é ordem de grandeza.
      </Note>

      <Detalhe row={aberto} cap={entrada.cap} tint={tint} teto={teto} onClose={() => setAberto(null)} />
    </div>
  );
}

/** Uma linha da tabela. Extraida pra o corpo do ranking caber numa tela. */
function Linha({ r, onOpen }: { r: HuntRow; onOpen: () => void }) {
  const t = r.target;
  const th = r.est.threat;
  return (
    <tr
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
    >
      <td className="px-3 py-2">
        <span className="flex items-center gap-2.5">
          <Sprite src={spriteUrl(t.pokeId)} alt={t.name} size={34} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[15px] text-text transition-colors group-hover:text-accent">
              {t.name}
            </span>
            <span className="flex gap-1">
              <TypeBadge type={t.t1} size="xs" />
              {t.t2 ? <TypeBadge type={t.t2} size="xs" /> : null}
            </span>
          </span>
        </span>
      </td>

      <td className="px-3 py-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14px] text-text-dim">{t.areas.map(areaLabel).join(", ")}</span>
          <span className="pix text-[11px] text-text-mute">
            nível {t.huntLevel} · {t.spotCount} {t.spotCount === 1 ? "ponto" : "pontos"}
          </span>
        </span>
      </td>

      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <Chip size="xs" tint={TYPE_COLOR[r.est.moveName]} icon={<TypeIcon type={r.est.moveName} size={12} />}>
            {TYPE_LABEL[r.est.moveName]}
          </Chip>
          <span
            className={cn(
              "text-[14px] font-semibold tabular",
              r.est.eff >= 2 ? "text-ok" : r.est.eff > 1 ? "text-neon" : "text-text-mute",
            )}
          >
            {effLabel(r.est.eff)}
          </span>
        </span>
      </td>

      <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">
        {Math.round(r.est.kosH).toLocaleString("pt-BR")}
      </td>

      <td className="px-3 py-2 text-right text-[14px] text-ok tabular">{perHourLabel(r.est.xpH)}</td>

      <td className="px-3 py-2 text-right">
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className={cn("text-[14px] tabular", r.est.goldH < 0 ? "text-danger" : "text-warn")}>
            {perHourLabel(r.est.goldH)}
          </span>
          {r.econ.dayHit ? (
            <Tooltip content="Tipo do dia: o ouro desta linha já leva o bônus, com o teto de chance respeitado.">
              <span className="pix text-[9px] text-warn">DIA</span>
            </Tooltip>
          ) : null}
        </span>
      </td>

      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="pix text-[11px]" style={{ color: RISK_COLOR[th.risk] }}>
            {RISK_LABEL[th.risk]}
          </span>
          <span className="text-[12px] text-text-mute tabular">
            {th.killsPerLife >= 999 ? "sem risco" : `${th.killsPerLife.toFixed(1)} abates/vida`}
          </span>
        </span>
      </td>
    </tr>
  );
}

/** A ficha da hunt: os dois lados do combate, a economia e a captura.
 *  Existe porque a linha responde "quanto rende" e a decisao real precisa do
 *  "por que" — qual golpe, quanto se toma de volta, o que a bola custa. */
function Detalhe({
  row,
  cap,
  tint,
  teto,
  onClose,
}: {
  row: HuntRow | null;
  cap: boolean;
  tint: string;
  /** o maior valor de cada grandeza na lista — a regua das barras */
  teto: { kos: number; xp: number; gold: number };
  onClose: () => void;
}) {
  if (!row) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const t = row.target;
  const est = row.est;
  const th = est.threat;
  const c = row.econ.catch;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      eyebrow="Hunt"
      title={
        <span className="flex items-center gap-3">
          <Sprite src={spriteUrl(t.pokeId)} animatedSrc={animatedSpriteUrl(t.pokeId)} alt={t.name} size={40} />
          <span className="flex flex-col gap-1">
            <span>{t.name}</span>
            <span className="flex items-center gap-1.5">
              <TypeBadge type={t.t1} size="xs" />
              {t.t2 ? <TypeBadge type={t.t2} size="xs" /> : null}
              <span className="pix text-[11px] text-text-mute">nível {t.huntLevel}</span>
            </span>
          </span>
        </span>
      }
      footer={
        <Link
          href={`/dex/${t.pokeId}`}
          className="pix flex items-center gap-1 text-[12px] text-text-dim transition-colors hover:text-accent"
        >
          ver a ficha completa na dex
          <IconChevronRight size={14} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <StatTile
            label="Abates por hora"
            icon={<IconTarget size={14} />}
            value={Math.round(est.kosH).toLocaleString("pt-BR")}
            ratio={Math.min(1, est.kosH / teto.kos)}
            tint={tint}
            footLeft={`${est.ttkS}s por abate`}
          />
          <StatTile
            label="XP por hora"
            icon={<IconXp size={14} />}
            value={perHourLabel(est.xpH)}
            ratio={Math.min(1, est.xpH / teto.xp)}
            tint="var(--color-ok)"
            footLeft={`${t.xp.toLocaleString("pt-BR")} por abate`}
          />
          <StatTile
            label={cap ? "Ouro/h + captura" : "Ouro por hora"}
            icon={<IconCoin size={14} />}
            value={perHourLabel(est.goldH)}
            ratio={Math.min(1, Math.max(0, est.goldH) / teto.gold)}
            tint="var(--color-warn)"
            footLeft={`${Math.round(row.econ.perKill).toLocaleString("pt-BR")} por abate`}
          />
        </div>

        {/* ---- os dois lados ----
            Ler so o de cima e o erro que manda um Abra de 9 de HP pro Gastly:
            a vantagem elemental vale pros DOIS lados. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 border border-line bg-surface/60 p-3">
            <FieldLabel>Você bate nele</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tint={TYPE_COLOR[est.moveName]} icon={<TypeIcon type={est.moveName} size={14} />}>
                {TYPE_LABEL[est.moveName]}
              </Chip>
              <span className="text-[20px] leading-none font-bold text-ok tabular">{effLabel(est.eff)}</span>
              <span className="text-[13px] text-text-mute">
                {est.category === "SPECIAL" ? "golpe especial" : "golpe físico"}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-text-dim">
              {est.hits} {est.hits === 1 ? "golpe derruba" : "golpes derrubam"} o alvo (HP de hunt é
              5x o normal). O ciclo inteiro leva {est.ttkS}s contando spawn e aproximação.
            </p>
          </div>

          <div className="flex flex-col gap-2 border border-line bg-surface/60 p-3">
            <FieldLabel>Ele bate em você</FieldLabel>
            {th.moveType ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tint={TYPE_COLOR[th.moveType]} icon={<TypeIcon type={th.moveType} size={14} />}>
                    {TYPE_LABEL[th.moveType]}
                  </Chip>
                  <span className="text-[20px] leading-none font-bold tabular" style={{ color: RISK_COLOR[th.risk] }}>
                    {effLabel(th.eff)}
                  </span>
                  <span className="pix text-[11px]" style={{ color: RISK_COLOR[th.risk] }}>
                    {RISK_LABEL[th.risk]}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-text-dim">
                  {Math.round(th.hitDmg)} de dano por golpe. A vida cheia aguenta{" "}
                  {th.killsPerLife >= 999 ? "toda a hora" : `${th.killsPerLife.toFixed(1)} abates`}
                  {th.uptime < 1
                    ? ` — com os desmaios, só ${Math.round(th.uptime * 100)}% da hora rende.`
                    : ", então a hora inteira rende."}
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-text-dim">
                Este alvo não te machuca: nenhum golpe dele passa pela sua defesa.
              </p>
            )}
          </div>
        </div>

        {/* ---- captura ---- */}
        <div className="flex flex-col gap-2">
          <FieldLabel className="flex items-center gap-2">
            {c ? <BallIcon ball={c.ball} size={16} /> : null}
            Capturar este pokémon
          </FieldLabel>
          {c ? (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
                {[
                  { label: "chance por abate", value: pct(c.chance) },
                  { label: "abates por captura", value: Math.round(c.tries).toLocaleString("pt-BR") },
                  { label: "ouro em bolas", value: compact(Math.round(c.cost)) },
                  {
                    label: "líquido por abate",
                    value: `${c.net >= 0 ? "" : "−"}${compact(Math.abs(Math.round(c.net)))}`,
                    tone: c.net >= 0 ? "text-ok" : "text-danger",
                  },
                ].map((k) => (
                  <div key={k.label} className="bg-surface px-3 py-2">
                    <dd className={cn("text-[18px] leading-none font-semibold tabular", k.tone ?? "text-text")}>
                      {k.value}
                    </dd>
                    <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
                  </div>
                ))}
              </div>
              <p className="text-[13px] leading-relaxed text-text-dim">
                Com {c.ball.name} ({c.ball.priceGold} de ouro cada) contra um pokémon que vende por{" "}
                {t.sell.toLocaleString("pt-BR")}.{" "}
                {c.net >= 0
                  ? "Capturar paga mais do que as bolas custam."
                  : "As bolas custam mais do que a venda devolve — aqui a captura é prejuízo."}
              </p>
            </>
          ) : (
            <Note flush>Este pokémon não tem valor de venda no catálogo, então a lei de captura não tem como estimar.</Note>
          )}
        </div>

        {/* ---- loot ---- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[14px]">
          <span className="pix text-[11px] text-text-mute">Melhor drop</span>
          {t.topDrop ? (
            <span className="inline-flex items-center gap-2 text-text">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.topDrop.icon} alt="" width={20} height={20} className="[image-rendering:pixelated]" />
              {t.topDrop.name}
            </span>
          ) : (
            <span className="text-text-mute">nenhum drop com valor de venda</span>
          )}
          <span className="ml-auto text-[13px] text-text-mute">
            loot vale {Math.round(row.econ.loot).toLocaleString("pt-BR")} de ouro por abate
            {row.econ.dayHit ? " (com o tipo do dia)" : ""}
          </span>
        </div>
      </div>
    </Modal>
  );
}
