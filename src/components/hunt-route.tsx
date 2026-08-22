"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { buildRoute, RISK_COLOR, type MovesOf, type Species } from "@/lib/combat";
import {
  RISK_LABEL,
  economyOf,
  effLabel,
  horasLabel,
  perHourLabel,
  withEconomy,
  type HuntEntrada,
} from "@/lib/hunt";
import type { HuntPayload } from "@/lib/hunt-data";
import type { HuntState } from "@/lib/hunt-url";
import { xpTotalForLevel } from "@/lib/xp";
import { TYPE_COLOR } from "@/lib/typing";
import { TYPE_LABEL } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import {
  Button,
  Chip,
  Empty,
  Field,
  IconCoin,
  IconInfo,
  Note,
  NumberField,
  Panel,
  Segmented,
  Sprite,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { IconLevel, IconXp } from "@/components/game-icons";

/**
 * "Como eu chego no nivel X": a sequencia de faixas ate a meta.
 *
 * Duas coisas que o motor faz e que a tela precisa deixar visiveis:
 *
 * 1. **A rota nao evolui ninguem.** Evoluir reseta o nivel e NAO re-rola IV/Quality,
 *    entao o pokemon que voce escolheu e o pokemon — a rota usa a especie escolhida
 *    em todos os niveis, em vez de fingir que voce vira outro bicho no meio.
 * 2. **A rota foge de hunt letal.** Alvo que te derruba antes de 2 abates fica fora,
 *    mesmo rendendo mais no papel: o rendimento dele ja e zero na pratica.
 *
 * O que a tabela de ranking nao responde e o que esta tela responde: **quanto
 * tempo**. Com a curva de XP fechada (`xp.ts`) da pra somar o custo de cada nivel
 * da faixa e dividir pelo XP/h dali — e ai "sobe ate o 200" deixa de ser um plano
 * sem preco.
 */

const ALVOS_RAPIDOS = [50, 100, 200, 500];

export function HuntRoute({
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
  const alvoValido = state.target > entrada.level;

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

  const rota = useMemo(() => {
    if (!alvoValido) return [];
    return buildRoute(
      fighter,
      entrada.level,
      state.target,
      withEconomy(payload.targets, econ),
      movesOf,
      entrada.quality,
      ivs,
      state.mode,
      entrada.vip,
      entrada.pool,
    );
  }, [alvoValido, fighter, entrada, state.target, payload.targets, econ, movesOf, ivs, state.mode]);

  // O preco da rota em tempo: o XP que cada faixa custa (curva fechada do jogo)
  // dividido pelo XP/h que a hunt daquela faixa entrega.
  const comTempo = useMemo(
    () =>
      rota.map((s) => {
        const xpFaixa = xpTotalForLevel(s.to + 1) - xpTotalForLevel(s.from);
        return { step: s, xpFaixa, horas: s.est.xpH > 0 ? xpFaixa / s.est.xpH : Infinity };
      }),
    [rota],
  );
  const horasTotal = comTempo.reduce((a, x) => a + x.horas, 0);
  const ouroTotal = comTempo.reduce((a, x) => a + x.horas * x.step.est.goldH, 0);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title={<span className="pix">A subida, faixa por faixa</span>}
        bodyClassName="flex flex-wrap items-start gap-x-3 gap-y-3"
      >
        <Field label="Nível alvo" icon={<IconLevel size={14} />} className="w-32">
          <NumberField
            min={entrada.level + 1}
            fallback={entrada.level + 1}
            value={state.target}
            onChange={(target) => patch({ target })}
            className="text-center text-[16px]"
          />
        </Field>

        <Field>
          <span className="flex h-10 items-center gap-1.5">
            {ALVOS_RAPIDOS.filter((n) => n > entrada.level).map((n) => (
              <Button key={n} variant="ghost" active={state.target === n} onClick={() => patch({ target: n })}>
                {n}
              </Button>
            ))}
          </span>
        </Field>

        <Field label="O que a rota persegue">
          <Segmented
            value={state.mode}
            onChange={(mode) => patch({ mode })}
            options={[
              { value: "xp", label: "subir rápido", title: "Cada faixa é a de maior XP/h efetivo" },
              { value: "gold", label: "ganhar ouro", title: "Cada faixa é a de maior ouro/h efetivo" },
            ]}
          />
        </Field>

        {rota.length > 0 ? (
          <div className="ml-auto flex h-14 flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="pix text-[11px] text-text-mute">tempo estimado</span>
              <span className="text-[20px] leading-none font-bold text-accent tabular">
                {horasLabel(horasTotal)}
              </span>
            </span>
            <Tooltip content="Ouro que a própria subida rende no caminho, no ritmo de cada faixa.">
              <span className="flex items-baseline gap-1.5">
                <span className="pix text-[11px] text-text-mute">ouro no caminho</span>
                <span className="text-[17px] leading-none font-semibold text-warn tabular">
                  {Math.round(ouroTotal).toLocaleString("pt-BR")}
                </span>
              </span>
            </Tooltip>
          </div>
        ) : null}
      </Panel>

      {!alvoValido ? (
        <Panel>
          <Empty
            title="O alvo tem que ser maior que o nível atual"
            hint={`Seu pokémon está no nível ${entrada.level}. Escolha um alvo acima disso.`}
            action={
              <Button variant="primary" onClick={() => patch({ target: entrada.level + 50 })}>
                subir 50 níveis
              </Button>
            }
          />
        </Panel>
      ) : rota.length === 0 ? (
        <Panel>
          <Empty
            title="Nenhuma hunt segura no alcance deste pokémon"
            hint="Todo alvo ao alcance derruba ele antes de dois abates. Suba a quality, o nível ou considere os golpes de TM."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {comTempo.map(({ step, horas }) => {
            const e = step.enemy;
            const est = step.est;
            const th = est.threat;
            return (
              <div
                key={`${step.from}-${e.pokeId}`}
                className="flex flex-col gap-3 border border-line bg-surface/70 p-3 lg:flex-row lg:items-center lg:gap-4"
              >
                {/* a faixa de nivel: e o indice da rota, entao vem primeiro e fixo */}
                <span className="flex shrink-0 items-center gap-2 lg:w-32 lg:flex-col lg:items-start lg:gap-1">
                  <span className="pix text-[13px]" style={{ color: tint }}>
                    {step.from} → {step.to}
                  </span>
                  <span className="pix text-[11px] text-text-mute">{horasLabel(horas)}</span>
                </span>

                <span className="flex min-w-0 flex-1 items-center gap-2.5 border-line/60 lg:border-l lg:pl-4">
                  <Sprite src={spriteUrl(e.pokeId)} alt={e.name} size={38} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] text-text">{e.name}</span>
                      <span className="pix text-[11px] text-text-mute">
                        {e.areas.join(", ")} · nível {e.huntLevel}
                      </span>
                    </span>
                    <span className="flex gap-1">
                      <TypeBadge type={e.t1} size="xs" />
                      {e.t2 ? <TypeBadge type={e.t2} size="xs" /> : null}
                    </span>
                  </span>
                </span>

                {/* os DOIS lados, um em cima do outro: ler so o de cima e o erro
                    que manda um pokemon de 9 de HP pro alvo que bate x2.5 nele */}
                <span className="flex shrink-0 flex-col gap-1.5 border-line/60 lg:w-52 lg:border-l lg:pl-4">
                  <span className="flex items-center gap-2">
                    <Chip size="xs" tint={TYPE_COLOR[est.moveName]} icon={<TypeIcon type={est.moveName} size={12} />}>
                      {TYPE_LABEL[est.moveName]}
                    </Chip>
                    <span className={cn("text-[14px] font-semibold tabular", est.eff >= 2 ? "text-ok" : "text-text-dim")}>
                      {effLabel(est.eff)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] text-text-mute">
                    <span className="pix text-[10px]">você apanha</span>
                    {th.moveType ? <TypeIcon type={th.moveType} size={12} /> : null}
                    <span style={{ color: RISK_COLOR[th.risk] }} className="pix text-[10px]">
                      {RISK_LABEL[th.risk]}
                    </span>
                  </span>
                </span>

                <span className="grid shrink-0 grid-cols-3 gap-3 border-line/60 text-right lg:w-64 lg:border-l lg:pl-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="pix text-[10px] text-text-mute">abates/h</span>
                    <span className="text-[14px] text-text-dim tabular">{Math.round(est.kosH)}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="pix inline-flex items-center justify-end gap-1 text-[10px] text-text-mute">
                      <IconXp size={11} />xp/h
                    </span>
                    <span className="text-[14px] text-ok tabular">{perHourLabel(est.xpH)}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="pix inline-flex items-center justify-end gap-1 text-[10px] text-text-mute">
                      <IconCoin size={11} />ouro/h
                    </span>
                    <span className={cn("text-[14px] tabular", est.goldH < 0 ? "text-danger" : "text-warn")}>
                      {perHourLabel(est.goldH)}
                    </span>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {rota.length > 0 ? (
        <Note flush icon={<IconInfo size={15} />}>
          A rota não evolui ninguém: evoluir reseta o nível e não re-rola IV nem quality,
          então ela usa a espécie que você escolheu em todos os níveis. O tempo sai da curva
          de XP do jogo dividida pelo XP/h de cada faixa — ritmo constante, sem contar as
          horas que você passa longe do jogo.
        </Note>
      ) : null}
    </div>
  );
}
