"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { PokeType, Rarity } from "@/lib/types";
import { IV_MAX, estimateIvs, ivRange, projectAll } from "@/lib/stats";
import { TIER_COLOR, qualityTier } from "@/lib/rarity";
import { TYPE_COLOR } from "@/lib/typing";
import { spriteUrl } from "@/lib/sprites";
import { buildCalcSearch, parseCalcState, EMPTY_CALC, type CalcState } from "@/lib/calc-url";
import {
  Button,
  Chip,
  Combobox,
  Empty,
  FieldLabel,
  IconChevronRight,
  NumberField,
  Panel,
  Sprite,
  Tooltip,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel, IconScale, IconTarget, STAT_ICONS } from "@/components/game-icons";
import { STAT_LABEL, STAT_SHORT, TIER_LABEL, compact } from "@/lib/labels";

/**
 * Calculadora de IV, Quality e Poder.
 *
 * A pergunta que ela responde e a unica que o jogo nao responde: **esse pokemon
 * que eu peguei presta?** O jogo mostra os stats finais e a quality; o que ele
 * esconde e o IV — o que separa dois Abras identicos na tela.
 *
 * A formula (verificada, em `stats.ts`) inverte:
 *   stat = round((base + 2*IV) * (nivel/100) * quality^exp)
 *
 * O `round` da formula e o que obriga esta tela a mostrar FAIXA e nao ponto: o
 * stat na tela do jogo ja veio arredondado, e em nivel baixo meia unidade de
 * stat vale dezenas de IV.
 *
 * A FORMA da tela (larga, campo grande, resultado em cartao) veio de uma
 * revisao: a primeira versao era um trilho estreito com seis barrinhas de 4px,
 * e o Eduardo reprovou. Formulario de consulta nao e barra lateral de filtro —
 * aqui o campo E o conteudo, entao ele ocupa a largura e o resultado responde
 * embaixo, em cartao que se le de longe.
 */

export interface CalcSpecies {
  id: number;
  name: string;
  bases: number[];
  type1: PokeType;
  type2: PokeType | null;
  rarity: Rarity;
}

const TOTAL_MAX = IV_MAX * 6;

/** Um exemplo plausivel, gerado pela propria formula — nao numero chutado.
 *  Existe porque tela de calculo vazia nao ensina o que ela faz. */
const EXEMPLO = { id: 6, level: 100, quality: 1.5, ivs: [24, 18, 20, 28, 15, 26] };

export function CalcTool({ especies }: { especies: CalcSpecies[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [s, setS] = useState<CalcState>(() => parseCalcState(new URLSearchParams(sp.toString())));

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildCalcSearch(s)}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [s, router, pathname]);

  const patch = useCallback((p: Partial<CalcState>) => setS((old) => ({ ...old, ...p })), []);

  const especie = useMemo(() => especies.find((e) => e.id === s.id) ?? null, [especies, s.id]);
  const temStats = s.stats.some((v) => v > 0);

  const preencherExemplo = () => {
    const alvo = especies.find((e) => e.id === EXEMPLO.id) ?? especies[0];
    if (!alvo) return;
    const { stats } = projectAll(alvo.bases, EXEMPLO.ivs, EXEMPLO.level, EXEMPLO.quality);
    setS({
      id: alvo.id,
      level: EXEMPLO.level,
      quality: EXEMPLO.quality,
      stats,
      target: 100,
    });
  };

  const leitura = useMemo(() => {
    if (!especie || !temStats) return null;
    const { ivs } = estimateIvs(especie.bases, s.stats, s.level, s.quality);
    const faixas = especie.bases.map((b, i) => ivRange(b, s.stats[i], s.level, s.quality, i));
    const soma = s.stats.reduce((a, b) => a + b, 0);
    const trava = (v: number) => Math.min(IV_MAX, Math.max(0, v));
    return {
      ivs,
      faixas,
      soma,
      poder: Math.round(soma * s.quality),
      somaIv: ivs.reduce((a, v) => a + trava(v), 0),
      // O trio minimo / mais provavel / maximo sai do MESMO intervalo de
      // arredondamento das barras — nao e margem de erro chutada.
      totalMin: faixas.reduce((a, [lo]) => a + trava(lo), 0),
      totalMax: faixas.reduce((a, [, hi]) => a + trava(hi), 0),
      /** Impossivel e quando NENHUM IV valido cabe na leitura — testar o ponto
       *  dava alarme falso em todo pokemon de nivel baixo. */
      impossivel: faixas.some(([lo, hi]) => lo > IV_MAX || hi < 0),
      largura: Math.max(...faixas.map(([lo, hi]) => hi - lo)),
    };
  }, [especie, s.stats, s.level, s.quality, temStats]);

  const projecao = useMemo(() => {
    if (!especie || !leitura) return null;
    const ivs = leitura.ivs.map((v) => Math.min(IV_MAX, Math.max(0, v)));
    return {
      dele: projectAll(especie.bases, ivs, s.target, s.quality),
      perfeito: projectAll(especie.bases, Array(6).fill(IV_MAX), s.target, s.quality),
    };
  }, [especie, leitura, s.target, s.quality]);

  const tier = qualityTier(s.quality);
  const tint = especie ? TYPE_COLOR[especie.type1] : "var(--color-t-calc)";

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------ entrada ------------------------------
          Larga e horizontal: o campo E o conteudo desta tela. Espremido numa
          coluna de 360px, digitar seis stats virava rolagem. */}
      <Panel
        title={<span className="flex items-center gap-2"><IconScale size={16} />O pokémon</span>}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={preencherExemplo}>
              preencher exemplo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setS(EMPTY_CALC)}
              disabled={s.id == null && !temStats}
            >
              limpar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_150px]">
            <div>
              <FieldLabel className="mb-1">Espécie</FieldLabel>
              <Combobox
                value={s.id}
                onChange={(id) => patch({ id })}
                options={especies.map((e) => ({
                  value: e.id,
                  label: e.name,
                  keywords: String(e.id),
                  render: (
                    <span className="flex items-center gap-2">
                      <Sprite src={spriteUrl(e.id)} alt={e.name} size={26} />
                      {e.name}
                    </span>
                  ),
                }))}
                placeholder="nome do pokémon..."
                emptyText="nenhuma espécie com esse nome"
              />
              <p className="mt-1 text-[12px] leading-snug text-text-mute">
                a base dela é metade da conta
              </p>
            </div>

            <div>
              <FieldLabel className="mb-1 flex items-center gap-1.5">
                <IconLevel size={15} />Nível
              </FieldLabel>
              <NumberField
                min={1}
                fallback={1}
                value={s.level}
                onChange={(level) => patch({ level })}
                className="text-center text-[15px]"
              />
              <p className="mt-1 text-[12px] leading-snug text-text-mute">
                o nível em que os stats abaixo foram vistos
              </p>
            </div>

            <div>
              <FieldLabel className="mb-1 flex items-center gap-1.5">
                <IconGem size={15} />Quality
              </FieldLabel>
              <NumberField
                min={0}
                step={0.01}
                fallback={1}
                value={s.quality}
                onChange={(quality) => patch({ quality })}
                className="text-center text-[15px]"
              />
              <p className="mt-1 flex items-center gap-1.5 text-[12px] leading-snug text-text-mute">
                <Chip size="xs" tint={TIER_COLOR[tier]}>{TIER_LABEL[tier]}</Chip>
                selvagem vai até 1,8
              </p>
            </div>
          </div>

          {/* A base da espécie aparece assim que ela é escolhida. Sem isso, quem
              está digitando os stats não tem contra o que comparar — e a base é
              justamente a metade da conta que o jogo já publica. */}
          {especie ? (
            <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
              <Link
                href={`/dex/${especie.id}`}
                className="flex shrink-0 items-center gap-2 pr-2 transition-colors hover:text-accent"
              >
                <Sprite src={spriteUrl(especie.id)} alt={especie.name} size={40} />
                <span>
                  <span className="block text-[14px] text-text">{especie.name}</span>
                  <span className="flex items-center gap-1 pt-0.5">
                    <TypeBadge type={especie.type1} size="xs" showLabel={false} />
                    {especie.type2 ? (
                      <TypeBadge type={especie.type2} size="xs" showLabel={false} />
                    ) : null}
                  </span>
                </span>
                <IconChevronRight size={14} className="text-text-mute" />
              </Link>
              <span className="pix shrink-0 text-[11px] text-text-mute">stats base</span>
              <div className="flex flex-wrap gap-1.5">
                {especie.bases.map((b, i) => {
                  const Icon = STAT_ICONS[i];
                  return (
                    <span
                      key={i}
                      title={STAT_LABEL[i]}
                      className="flex items-center gap-1.5 border border-line bg-bg-soft px-2 py-1"
                    >
                      <Icon size={14} className="text-text-mute" />
                      <span className="pix text-[11px] text-text-mute">{STAT_SHORT[i]}</span>
                      <span className="text-[14px] font-semibold text-text-dim tabular">{b}</span>
                    </span>
                  );
                })}
                <span className="flex items-center gap-1.5 border border-line-strong bg-surface-2 px-2 py-1">
                  <span className="pix text-[11px] text-text-mute">total</span>
                  <span className="text-[14px] font-semibold text-accent tabular">
                    {especie.bases.reduce((a, b) => a + b, 0)}
                  </span>
                </span>
              </div>
            </div>
          ) : null}

          <div>
            <FieldLabel className="mb-2">Stats atuais, como o jogo mostra</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_LABEL.map((label, i) => {
                const Icon = STAT_ICONS[i];
                return (
                  <div key={label}>
                    <FieldLabel className="mb-1 flex items-center gap-1 text-text-mute">
                      <Icon size={14} />
                      {STAT_SHORT[i]}
                    </FieldLabel>
                    <NumberField
                      min={0}
                      fallback={0}
                      aria-label={label}
                      value={s.stats[i]}
                      onChange={(v) => patch({ stats: s.stats.map((x, j) => (j === i ? v : x)) })}
                      className="text-center text-[15px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      {/* ------------------------------ resultado ------------------------------ */}
      <Panel
        title={<span className="flex items-center gap-2"><IconTarget size={16} />IV estimado</span>}
        actions={
          leitura && !leitura.impossivel ? (
            <span className="text-[13px] text-text-mute tabular">
              {Math.round(leitura.somaIv)} de {TOTAL_MAX}
            </span>
          ) : null
        }
      >
        {!especie ? (
          <Empty
            title="Escolha a espécie"
            hint="O IV sai da diferença entre o stat que o jogo mostra e a base da espécie — sem saber qual espécie é, não há de onde tirar."
            action={
              <Button variant="primary" onClick={preencherExemplo}>
                preencher exemplo
              </Button>
            }
          />
        ) : !temStats ? (
          <Empty
            title="Digite os stats do pokémon"
            hint="Copie os seis números da tela do jogo. Nível e quality também saem de lá."
            action={
              <Button variant="primary" onClick={preencherExemplo}>
                preencher exemplo
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {leitura!.impossivel ? (
              <p className="border border-warn/45 bg-warn/12 px-3 py-2 text-[13px] leading-relaxed text-warn">
                Nenhum IV entre 0 e {IV_MAX} explica algum desses stats. Não é um pokémon fora
                da curva — é sinal de que o <strong>nível</strong> ou a{" "}
                <strong>quality</strong> não são os que estão na tela do jogo.
              </p>
            ) : null}

            {/* Cartao por stat, nao linha de 4px: a barra e o numero precisam de
                altura pra a comparacao entre os seis acontecer de relance. */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {leitura!.ivs.map((iv, i) => {
                const [lo, hi] = leitura!.faixas[i];
                const Icon = STAT_ICONS[i];
                const largo = hi - lo > 1;
                const pctLo = Math.max(0, Math.min(100, (lo / IV_MAX) * 100));
                const pctHi = Math.max(0, Math.min(100, (hi / IV_MAX) * 100));
                return (
                  <div key={i} className="border border-line bg-bg-soft p-2.5">
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="pix flex flex-1 items-center gap-1.5 text-[11px] text-text-mute">
                        <Icon size={14} />
                        {STAT_LABEL[i]}
                      </span>
                      <span className="text-[17px] leading-none font-bold text-text tabular">
                        {largo
                          ? `${Math.max(0, lo).toFixed(0)}–${Math.min(IV_MAX, hi).toFixed(0)}`
                          : iv.toFixed(1)}
                      </span>
                      <span className="pix text-[11px] text-text-mute">/{IV_MAX}</span>
                    </div>
                    {/* Barra em duas partes: o preenchimento de 0 ate o PISO da
                        faixa (o que e certo), e a faixa em si por cima (o que
                        ainda esta em aberto). Desenhar so a faixa fazia uma
                        leitura boa virar um quadradinho solto no meio do
                        trilho, que le como marcador de grafico e nao como
                        medidor. */}
                    <span className="relative block h-3 w-full bg-surface-2">
                      <span
                        className="absolute inset-y-0 left-0"
                        style={{ width: `${pctLo}%`, backgroundColor: tint, opacity: 0.4 }}
                      />
                      <span
                        className="absolute inset-y-0"
                        style={{
                          left: `${pctLo}%`,
                          width: `${Math.max(1.5, pctHi - pctLo)}%`,
                          backgroundColor: tint,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Minimo / mais provavel / maximo — o mesmo intervalo das barras,
                somado. E a resposta honesta pra "no fim das contas, quanto?" */}
            <div>
              <FieldLabel className="mb-1.5">Faixa do IV total</FieldLabel>
              <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
                {[
                  { label: "mínimo", value: Math.round(leitura!.totalMin), tone: "text-text-mute" },
                  {
                    label: "mais provável",
                    value: leitura!.impossivel ? "—" : Math.round(leitura!.somaIv),
                    tone: "text-text",
                    forte: true,
                  },
                  { label: "máximo", value: Math.round(leitura!.totalMax), tone: "text-text-mute" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className={cn("px-3 py-2", k.forte ? "bg-surface-2" : "bg-surface")}
                  >
                    <dd
                      className={cn(
                        "leading-none font-semibold tabular",
                        k.forte ? "text-[22px]" : "text-[18px]",
                        k.tone,
                      )}
                    >
                      {k.value}
                    </dd>
                    <dt className="pix mt-1 text-[11px] text-text-mute">{k.label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {leitura!.largura > 2 ? (
              <p className="border border-line bg-bg-soft px-3 py-2 text-[13px] leading-relaxed text-text-mute">
                A leitura está <strong className="text-text-dim">larga</strong>: no nível{" "}
                {s.level} o stat que o jogo arredonda cabe num intervalo de até{" "}
                {leitura!.largura.toFixed(0)} pontos de IV. Suba o pokémon de nível e volte
                aqui — quanto maior o nível, mais estreita a faixa.
              </p>
            ) : null}

            <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
              {[
                { label: "soma dos stats", value: leitura!.soma, tone: "text-text" },
                { label: "poder agora", value: compact(leitura!.poder), tone: "text-accent" },
                {
                  // Nota derivada de leitura impossivel e pior que nota nenhuma:
                  // presa no teto, ela anuncia "100%, pokemon perfeito" logo
                  // abaixo do aviso de que os numeros nao fecham.
                  label: "do IV máximo",
                  value: leitura!.impossivel
                    ? "—"
                    : `${Math.round((leitura!.somaIv / TOTAL_MAX) * 100)}%`,
                  tone: leitura!.impossivel ? "text-text-mute" : "text-neon",
                },
              ].map((k) => (
                <div key={k.label} className="bg-surface px-3 py-2">
                  <dd className={`text-[18px] leading-none font-semibold tabular ${k.tone}`}>
                    {k.value}
                  </dd>
                  <dt className="pix mt-1 text-[11px] text-text-mute">{k.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Panel>

      {/* ------------------------------ projeção ------------------------------ */}
      <Panel
        title={<span className="flex items-center gap-2"><IconLevel size={16} />Projeção</span>}
      >
        <div className="flex flex-col gap-4">
          {/* O nivel desejado e a PERGUNTA deste painel, entao ele e campo com
              rotulo aqui dentro — nao um input miudo no canto do cabecalho, que
              e onde ele estava e onde ninguem achou. */}
          <div className="flex flex-wrap items-end gap-3 border-b border-line pb-3">
            <div>
              <FieldLabel className="mb-1 flex items-center gap-1.5">
                <IconLevel size={15} />
                Nível desejado
              </FieldLabel>
              <NumberField
                min={1}
                fallback={100}
                aria-label="Nível desejado"
                value={s.target}
                onChange={(target) => patch({ target })}
                wrapClassName="w-32"
                className="text-center text-[16px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {[50, 100, 200, 500, 1000].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="ghost"
                  active={s.target === n}
                  onClick={() => patch({ target: n })}
                >
                  {n}
                </Button>
              ))}
              <span className="pix ml-1 text-[11px] text-text-mute">
                está no {s.level}
              </span>
            </div>
          </div>

          {!projecao ? (
            <p className="text-[14px] leading-relaxed text-text-mute">
              Com a espécie e os stats preenchidos, aqui aparece como esse pokémon fica em
              qualquer nível — e quanto ele perde para um de IV perfeito.
            </p>
          ) : (
            <>
              {/* Cartao por stat, e nao tabela: a pergunta aqui nao e "leia a
                  linha do Ataque", e "onde esse pokemon esta longe do teto" —
                  e isso se ve pela barra, de relance, sem varrer coluna. */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {projecao.dele.stats.map((v, i) => {
                  const teto = projecao.perfeito.stats[i];
                  const falta = teto - v;
                  const Icon = STAT_ICONS[i];
                  return (
                    <div key={i} className="border border-line bg-bg-soft p-2.5">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="pix flex flex-1 items-center gap-1.5 text-[11px] text-text-mute">
                          <Icon size={14} />
                          {STAT_LABEL[i]}
                        </span>
                        <span className="text-[19px] leading-none font-bold text-text tabular">
                          {v}
                        </span>
                      </div>
                      <span className="relative block h-3 w-full bg-surface-2">
                        <span
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${teto > 0 ? Math.min(100, (v / teto) * 100) : 0}%`,
                            backgroundColor: tint,
                          }}
                        />
                      </span>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="pix text-[11px] text-text-mute">teto {teto}</span>
                        <span
                          className={cn(
                            "text-[13px] tabular",
                            falta > 0 ? "text-warn" : "text-ok",
                          )}
                        >
                          {falta > 0 ? `−${falta}` : "no teto"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* O poder e a conclusao, entao ele nao e mais um cartao igual aos
                  seis: e a faixa que fecha o painel. */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-line-strong bg-surface-2/60 p-3">
                <span className="flex items-center gap-2">
                  <IconTarget size={18} className="text-accent" />
                  <span className="pix text-[12px] text-text-dim">
                    Poder no nível {s.target}
                  </span>
                </span>
                <Tooltip content="Soma dos stats projetados multiplicada pela quality.">
                  <span className="text-[26px] leading-none font-bold text-accent tabular">
                    {compact(projecao.dele.power)}
                  </span>
                </Tooltip>
                <span className="flex items-baseline gap-1.5">
                  <span className="pix text-[11px] text-text-mute">com IV {IV_MAX}</span>
                  <span className="text-[17px] leading-none font-semibold text-text-mute tabular">
                    {compact(projecao.perfeito.power)}
                  </span>
                </span>
                <span className="ml-auto flex items-baseline gap-1.5">
                  <span className="pix text-[11px] text-text-mute">falta</span>
                  <span
                    className={cn(
                      "text-[17px] leading-none font-semibold tabular",
                      projecao.perfeito.power - projecao.dele.power > 0 ? "text-warn" : "text-ok",
                    )}
                  >
                    {projecao.perfeito.power - projecao.dele.power > 0
                      ? `−${compact(projecao.perfeito.power - projecao.dele.power)}`
                      : "no teto"}
                  </span>
                </span>
              </div>

              <p className="border-t border-line pt-2 text-[13px] leading-relaxed text-text-mute">
                A projeção usa o IV estimado acima, preso entre 0 e {IV_MAX}, e mantém a
                quality de <span className="text-text-dim tabular">{s.quality}</span> —
                quality não muda com o nível, só com breeding.
              </p>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
