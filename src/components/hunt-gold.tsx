"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { RISK_COLOR, type MovesOf, type Species } from "@/lib/combat";
import {
  RISK_LABEL,
  horasLabel,
  perHourLabel,
  type HuntEntrada,
  type HuntRow,
} from "@/lib/hunt";
import type { HuntPayload } from "@/lib/hunt-data";
import type { HuntState } from "@/lib/hunt-url";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL, compact } from "@/lib/labels";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import type { PokeType } from "@/lib/types";
import {
  Button,
  Chip,
  Empty,
  Field,
  IconChevronRight,
  IconCoin,
  IconInfo,
  Note,
  NumberField,
  Panel,
  Sprite,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";

/**
 * "Onde eu farmo ouro": o melhor ouro/h AGORA, no nivel em que o pokemon esta.
 *
 * Esta aba existe porque a rota nao dava conta da pergunta, e o jeito como ela nao
 * dava era traicoeiro. Rota tem linha de chegada; farm de ouro nao tem. Enquanto
 * "ganhar ouro" foi um modo da rota, o numero grande da tela era o ouro somado ate
 * o nivel alvo — ou seja, ouro/h vezes HORAS. A rota mais lenta ganhava por ser
 * lenta: 176h a 447k/h "rendem" 78M contra 99h a 459k/h rendendo 45M, e a tela
 * coroava a pior das duas.
 *
 * Aqui o alvo nao e nivel, e OURO. Voce diz quanto quer juntar e a tela responde
 * quantas horas, no ritmo do melhor spot. Assim demorar mais nunca vira vitoria: o
 * mesmo numero que ordena a lista e o que encurta a espera.
 *
 * Duas coisas que o numero desta tela ja carrega e nem sempre se ve:
 *  - **O ouro/h e efetivo.** Se a hunt te derruba, o tempo parado na Joy ja saiu
 *    dele. Spot letal (voce cai antes de dois abates) fica de fora: farm que exige
 *    babysitting nao e farm.
 *  - **A captura NAO entra no ouro/h.** Ela e estimada por uma lei ajustada por valor
 *    de venda, com erro mediano de ~1,9x, e numa sessao medida de 738 abates errou por
 *    5,7 — o suficiente pra trocar o sinal do termo (a tela prometia +194k/h onde a
 *    sessao entregou -30k/h, porque a bola e cobrada em todo abate). O loot da mesma
 *    sessao bateu drop a drop. Entao o loot ordena e a captura fica ao lado, com o
 *    ponto em que a bola se paga, que e uma afirmacao que se confere numa sessao.
 */

/** Metas que quase todo mundo digita — o campo continua livre pro resto. */
const METAS = [1_000_000, 10_000_000, 100_000_000];

/** Quanto rende ficar parado nesse spot por N horas. 8h e uma noite de idle. */
const JANELAS = [1, 8, 24];

const areaLabel = (a: string) => a.charAt(0).toUpperCase() + a.slice(1);

export function HuntGold({
  state,
  patch,
  fighter,
  ivs,
  entrada,
  rows: todas,
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
  /** os 342 alvos ja medidos contra o lutador — a conta vem pronta do `hunt-tool` */
  rows: HuntRow[];
  tint: string;
}) {
  /* Aqui a lista vira a de OURO: fora o que mata e o que nao paga, e em ordem
     de ouro/h. O `filter` ja devolve array novo, entao o `sort` nao mexe no
     `rows` que as outras abas recebem. */
  const rows = useMemo(
    () =>
      todas
        .filter((r) => r.est.threat.risk !== "deadly" && r.est.goldH > 0)
        .sort((a, b) => b.est.goldH - a.est.goldH),
    [todas],
  );

  const melhor = rows[0] ?? null;
  const horasMeta = melhor && melhor.est.goldH > 0 ? state.goal / melhor.est.goldH : null;

  if (!melhor) {
    return (
      <Panel>
        <Empty
          title="Nenhum spot seguro paga ouro pra este pokémon"
          hint="Todo alvo ao alcance dele derruba ele antes de dois abates, ou não solta nada que valha venda. Suba a quality, o nível ou considere os golpes de TM."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={<span className="pix">Quanto ouro você quer juntar</span>}
        bodyClassName="flex flex-wrap items-start gap-x-3 gap-y-3"
      >
        <Field label="Meta de ouro" icon={<IconCoin size={14} />} className="w-48">
          <NumberField
            grouped
            min={1}
            fallback={1_000_000}
            value={state.goal}
            onChange={(goal) => patch({ goal })}
            className="text-center text-[16px]"
          />
        </Field>

        <Field>
          <span className="flex h-10 items-center gap-1.5">
            {METAS.map((n) => (
              <Button key={n} variant="ghost" active={state.goal === n} onClick={() => patch({ goal: n })}>
                {compact(n)}
              </Button>
            ))}
          </span>
        </Field>

        <div className="ml-auto flex h-14 flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="pix text-[11px] text-text-mute">tempo até a meta</span>
            <span className="text-[20px] leading-none font-bold text-accent tabular">
              {horasMeta == null ? "—" : horasLabel(horasMeta)}
            </span>
          </span>
          <Tooltip content="No ritmo do spot que mais paga, sem trocar de lugar e sem subir de nível.">
            <span className="flex items-baseline gap-1.5">
              <span className="pix text-[11px] text-text-mute">no melhor ritmo</span>
              <span className="text-[17px] leading-none font-semibold text-warn tabular">
                {perHourLabel(melhor.est.goldH)}
              </span>
            </span>
          </Tooltip>
        </div>
      </Panel>

      <Destaque row={melhor} cap={entrada.cap} day={entrada.day} tint={tint} />

      {rows.length > 1 ? (
        <Panel title={<span className="pix">Se esse não der, os próximos</span>} bodyClassName="p-0">
          <div className="flex flex-col">
            {rows.slice(1, 10).map((r, i) => (
              <Linha key={r.target.pokeId} r={r} pos={i + 2} cap={entrada.cap} melhor={melhor.est.goldH} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Note flush icon={<IconInfo size={15} />}>
        O ouro por hora é só o loot, a preço de NPC, e já desconta o tempo parado na Joy.
        Spot letal fica fora: farm que precisa de você olhando rende zero na prática. A
        captura aparece ao lado como estimativa e não decide a ordem, porque a lei que
        estima ela erra por bem mais do que o loot.
      </Note>
    </div>
  );
}

/** O spot que ganhou, aberto: de onde vem o ouro e o que ele rende parado. */
function Destaque({
  row,
  cap,
  day,
  tint,
}: {
  row: HuntRow;
  cap: boolean;
  day: PokeType | "";
  tint: string;
}) {
  const t = row.target;
  const est = row.est;
  const th = est.threat;
  const c = row.econ.catch;
  // Tres estados diferentes, e nenhum e "zero": captura desligada, captura ligada num
  // alvo que o jogo nao compra (a lei nao tem como estimar) e captura valendo.
  const capH = cap && c ? c.net * est.kosH : null;
  // Onde a captura empata com a bola. E o unico numero desta caixa que nao depende da
  // lei: sai so do preco da bola e do valor de venda, e uma sessao confere.
  const empate = c && (c.ball.priceGold ?? 0) > 0 ? t.sell / (c.ball.priceGold ?? 1) : null;

  return (
    <Panel bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="relative grid shrink-0 place-items-center">
          <span
            aria-hidden="true"
            className="absolute h-12 w-12 rounded-full blur-2xl"
            style={{ backgroundColor: tint }}
          />
          <Sprite
            src={spriteUrl(t.pokeId)}
            animatedSrc={animatedSpriteUrl(t.pokeId)}
            alt={t.name}
            size={52}
            className="relative"
          />
        </span>

        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[19px] leading-none font-bold text-text">{t.name}</span>
            <span className="pix text-[11px] text-text-mute">
              {t.areas.map(areaLabel).join(", ")} · nível {t.huntLevel} · {t.spotCount}{" "}
              {t.spotCount === 1 ? "ponto" : "pontos"}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={t.t1} size="xs" />
            {t.t2 ? <TypeBadge type={t.t2} size="xs" /> : null}
            <Chip size="xs" tint={RISK_COLOR[th.risk]}>{RISK_LABEL[th.risk]}</Chip>
            {row.econ.dayHit && day ? (
              <Chip size="xs" tint={TYPE_COLOR[day]} icon={<TypeIcon type={day} size={12} />}>
                dia de {TYPE_LABEL[day]}
              </Chip>
            ) : null}
          </span>
        </span>

        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="pix text-[11px] text-text-mute">ouro/h no loot</span>
          <span className="text-[26px] leading-none font-bold text-warn tabular">
            {perHourLabel(est.goldH)}
          </span>
        </span>
      </div>

      {/* Os três números verificados, e a captura ao lado marcada como estimativa. */}
      <div className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
        {[
          {
            label: "abates por hora",
            value: Math.round(est.kosH).toLocaleString("pt-BR"),
            foot: `${est.ttkS}s por abate`,
            tone: "text-text",
          },
          {
            label: row.econ.dayHit ? "loot por abate (com o dia)" : "loot por abate",
            value: Math.round(row.econ.loot).toLocaleString("pt-BR"),
            foot: "preço de NPC",
            tone: "text-warn",
          },
          {
            label: "XP/h de graça",
            value: perHourLabel(est.xpH),
            foot: "sobe enquanto você farma",
            tone: "text-ok",
          },
          capH != null && c
            ? {
                label: "captura · estimativa",
                value: perHourLabel(capH),
                foot: `1 em ${Math.round(c.tries).toLocaleString("pt-BR")}${empate ? ` · paga a bola em 1 em ${Math.round(empate).toLocaleString("pt-BR")}` : ""}`,
                tone: capH >= 0 ? "text-ok" : "text-danger",
              }
            : {
                label: "captura",
                value: "—",
                foot: cap ? "o jogo não compra este" : "desligada no cenário",
                tone: "text-text-mute",
              },
        ].map((k) => (
          <div key={k.label} className="bg-surface px-3 py-2.5">
            <dd className={cn("text-[18px] leading-none font-semibold tabular", k.tone)}>{k.value}</dd>
            <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
            <dd className="mt-1 text-[12px] text-text-mute tabular">{k.foot}</dd>
          </div>
        ))}
      </div>

      {/* Ouro/h e uma taxa, e taxa nao se compara com preco de loja. Em horas de
          verdade ela vira o numero com que se decide comprar alguma coisa. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
        <span className="pix text-[11px] text-text-mute">parado aqui você junta</span>
        {JANELAS.map((h) => (
          <span key={h} className="flex items-baseline gap-1.5">
            <span className="pix text-[11px]" style={{ color: tint }}>
              {h}h
            </span>
            <span className="text-[15px] font-semibold text-warn tabular">
              {Math.round(est.goldH * h).toLocaleString("pt-BR")}
            </span>
          </span>
        ))}
        <Link
          href={`/dex/${t.pokeId}`}
          className="pix ml-auto flex items-center gap-1 text-[11px] text-text-dim transition-colors hover:text-accent"
        >
          ver o loot completo na dex
          <IconChevronRight size={14} />
        </Link>
      </div>
    </Panel>
  );
}

/** Um concorrente. A barra e a fracao do melhor: ordem sem regua nao diz se o
 *  segundo colocado perde por pouco ou por muito. */
function Linha({ r, pos, cap, melhor }: { r: HuntRow; pos: number; cap: boolean; melhor: number }) {
  const t = r.target;
  const est = r.est;
  const c = r.econ.catch;
  return (
    <div className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-0">
      <span className="pix w-5 shrink-0 text-[11px] text-text-mute tabular">{pos}</span>
      <Sprite src={spriteUrl(t.pokeId)} alt={t.name} size={32} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-[14px] text-text">{t.name}</span>
          {r.econ.dayHit ? (
            <Tooltip content="Tipo do dia: o ouro desta linha já leva o bônus, com o teto de chance respeitado.">
              <span className="pix text-[9px] text-warn">DIA</span>
            </Tooltip>
          ) : null}
        </span>
        <span className="pix text-[10px] text-text-mute">
          {t.areas.map(areaLabel).join(", ")} · nível {t.huntLevel}
        </span>
      </span>

      <span className="hidden w-44 shrink-0 flex-col gap-0.5 text-right sm:flex">
        <span className="text-[12px] text-text-mute tabular">
          {Math.round(r.econ.loot).toLocaleString("pt-BR")} por abate
        </span>
        {cap && c ? (
          <Tooltip content="Estimativa, e ela fica fora do que ordena esta lista.">
            <span className={cn("text-[12px] tabular", c.net >= 0 ? "text-text-mute" : "text-danger")}>
              captura ~{perHourLabel(c.net * est.kosH)}
            </span>
          </Tooltip>
        ) : null}
      </span>

      <span className="w-24 shrink-0 text-right">
        <span className="text-[15px] font-semibold text-warn tabular">{perHourLabel(est.goldH)}</span>
      </span>

      <span className="hidden w-24 shrink-0 sm:block" aria-hidden="true">
        <span className="block h-1.5 bg-line">
          <span
            className="block h-full bg-warn/70"
            style={{ width: `${Math.max(2, Math.min(100, (est.goldH / melhor) * 100))}%` }}
          />
        </span>
      </span>

      <span className="pix hidden w-16 shrink-0 text-right text-[10px] sm:block" style={{ color: RISK_COLOR[est.threat.risk] }}>
        {RISK_LABEL[est.threat.risk]}
      </span>
    </div>
  );
}
