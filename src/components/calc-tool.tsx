"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { PokeType, Rarity } from "@/lib/types";
import { IV_MAX, estimateIvs, ivRange, projectAll } from "@/lib/stats";
import { TIER_COLOR, qualityTier } from "@/lib/rarity";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { buildCalcSearch, parseCalcState, EMPTY_CALC, type CalcState } from "@/lib/calc-url";
import { baixarImagem, copiarImagem, desenharCartao } from "@/lib/share-card";
import {
  Button,
  Chip,
  Combobox,
  Empty,
  FieldLabel,
  IconChevronRight,
  IconLink,
  IconCheck,
  Note,
  NumberField,
  Panel,
  Sprite,
  StatTile,
  Tooltip,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import {
  IconGem,
  IconLevel,
  IconScale,
  IconTarget,
  STAT_ICONS,
} from "@/components/game-icons";
import { STAT_LABEL, STAT_SHORT, TIER_LABEL, TYPE_LABEL, compact } from "@/lib/labels";

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
 * O `round` obriga esta tela a mostrar FAIXA e nao ponto: o stat na tela do
 * jogo ja veio arredondado, e em nivel baixo meia unidade vale dezenas de IV.
 *
 * A FORMA levou duas revisoes, e as duas viraram regra:
 *
 * 1. **O formulario e a tarefa, entao ocupa a largura.** A primeira versao
 *    punha a entrada num trilho de 360px, como o de filtros da dex — mas
 *    trilho serve input que ACOMPANHA um conteudo, e aqui o campo e o
 *    conteudo.
 * 2. **O resultado e um PERFIL, nao um relatorio.** Numero em tabela e o
 *    formato de quem ja sabe o que procura; quem abre a calculadora quer ver o
 *    pokemon dele. Por isso sprite grande, nome, tipo e as tres manchetes
 *    antes de qualquer stat — e por isso o cartao de compartilhar existe.
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

/** Exemplo gerado pela propria formula — nao numero chutado. Existe porque
 *  tela de calculo vazia nao ensina o que ela faz. */
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
    setS({ id: alvo.id, level: EXEMPLO.level, quality: EXEMPLO.quality, stats, target: 100 });
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

  /** Texto do IV de um stat: faixa quando ela e larga, ponto quando e estreita. */
  const textoIv = (i: number): string => {
    const [lo, hi] = leitura!.faixas[i];
    return hi - lo > 1
      ? `${Math.max(0, lo).toFixed(0)}–${Math.min(IV_MAX, hi).toFixed(0)}`
      : leitura!.ivs[i].toFixed(1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ============================ entrada ============================
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
            </div>
          </div>

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

      {/* ============================ o perfil ============================ */}
      {!especie || !temStats ? (
        <Panel>
          <Empty
            title={especie ? "Digite os stats do pokémon" : "Escolha a espécie"}
            hint={
              especie
                ? "Os seis números saem da tela do pokémon no jogo."
                : "Sem a espécie não há base pra comparar."
            }
            action={
              <Button variant="primary" onClick={preencherExemplo}>
                preencher exemplo
              </Button>
            }
          />
        </Panel>
      ) : (
        <section className="panel scanline relative flex flex-col">
          {/* ---- cabecalho de perfil ----
              Sprite grande, nome, tipo e as tres manchetes ANTES de qualquer
              stat. Quem abre a calculadora quer ver o pokemon dele; tabela e o
              formato de quem ja sabe o que procura. */}
          <header className="flex flex-col gap-5 border-b border-line p-5 sm:flex-row sm:items-center sm:gap-7">
            <div className="relative grid shrink-0 place-items-center self-center">
              <span
                aria-hidden="true"
                className="anim-glow absolute h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: RARITY_COLOR[especie.rarity] }}
              />
              <Sprite
                src={spriteUrl(especie.id)}
                animatedSrc={animatedSpriteUrl(especie.id)}
                alt={especie.name}
                size={168}
                priority
                className="anim-float relative"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[30px] leading-none font-bold text-text">{especie.name}</h2>
                <span className="pix text-[13px]" style={{ color: tint }}>
                  nível {s.level}
                </span>
                <Link
                  href={`/dex/${especie.id}`}
                  className="pix ml-auto flex items-center gap-1 text-[11px] text-text-mute transition-colors hover:text-accent"
                >
                  ver na dex
                  <IconChevronRight size={14} />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <TypeBadge type={especie.type1} />
                {especie.type2 ? <TypeBadge type={especie.type2} /> : null}
                <Chip tint={TIER_COLOR[tier]} icon={<IconGem size={14} />}>
                  {TIER_LABEL[tier]} · {s.quality}
                </Chip>
              </div>

              {/* As tres manchetes. O percentual so aparece quando a leitura
                  fecha — nota derivada de entrada impossivel e pior que nota
                  nenhuma. */}
              <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
                {[
                  {
                    label: "do IV máximo",
                    value: leitura!.impossivel
                      ? "—"
                      : `${Math.round((leitura!.somaIv / TOTAL_MAX) * 100)}%`,
                    tone: leitura!.impossivel ? "text-text-mute" : "text-neon",
                    grande: true,
                  },
                  { label: "poder agora", value: compact(leitura!.poder), tone: "text-accent" },
                  { label: "soma dos stats", value: leitura!.soma, tone: "text-text" },
                ].map((k) => (
                  <div key={k.label} className="bg-surface px-3 py-2.5">
                    <dd
                      className={cn(
                        "leading-none font-bold tabular",
                        k.grande ? "text-[26px]" : "text-[22px]",
                        k.tone,
                      )}
                    >
                      {k.value}
                    </dd>
                    <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </header>

          {/* ---- a leitura, stat a stat ---- */}
          <div className="flex flex-col gap-4 p-5">
            {leitura!.impossivel ? (
              <Note tone="warn">
                Nenhum IV entre 0 e {IV_MAX} explica esses stats. Confira o nível e a quality.
              </Note>
            ) : null}

            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel>IV estimado, stat a stat</FieldLabel>
              <span className="text-[13px] text-text-mute tabular">
                {leitura!.impossivel ? "—" : `${Math.round(leitura!.somaIv)} de ${TOTAL_MAX}`}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {especie.bases.map((base, i) => {
                const [lo, hi] = leitura!.faixas[i];
                const Icon = STAT_ICONS[i];
                return (
                  <StatTile
                    key={i}
                    label={STAT_LABEL[i]}
                    icon={<Icon size={14} />}
                    value={textoIv(i)}
                    suffix={`/${IV_MAX}`}
                    ratio={leitura!.ivs[i] / IV_MAX}
                    range={[lo / IV_MAX, hi / IV_MAX]}
                    tint={tint}
                    footLeft={`base ${base}`}
                  />
                );
              })}
            </div>

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
              <Note>
                Leitura larga: o arredondamento do jogo cabe em até{" "}
                {leitura!.largura.toFixed(0)} pontos de IV. Sobe de nível que ela fecha.
              </Note>
            ) : null}

            <Compartilhar
              especie={especie}
              state={s}
              tier={tier}
              tint={tint}
              leitura={leitura!}
              textoIv={textoIv}
            />
          </div>
        </section>
      )}

      {/* ============================ projeção ============================ */}
      <Panel title={<span className="flex items-center gap-2"><IconLevel size={16} />Projeção</span>}>
        <div className="flex flex-col gap-4">
          {/* O nivel desejado e a PERGUNTA deste painel, entao ele e campo com
              rotulo aqui dentro — nao um input miudo no canto do cabecalho. */}
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
            </div>
          </div>

          {!projecao ? (
            <Note icon={null}>
              Preencha a espécie e os stats.
            </Note>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {projecao.dele.stats.map((v, i) => {
                  const teto = projecao.perfeito.stats[i];
                  const falta = teto - v;
                  const Icon = STAT_ICONS[i];
                  return (
                    <StatTile
                      key={i}
                      label={STAT_LABEL[i]}
                      icon={<Icon size={14} />}
                      value={v}
                      ratio={teto > 0 ? v / teto : 0}
                      tint={tint}
                      footLeft={`teto ${teto}`}
                      footRight={
                        <span className={falta > 0 ? "text-warn" : "text-ok"}>
                          {falta > 0 ? `−${falta}` : "no teto"}
                        </span>
                      }
                    />
                  );
                })}
              </div>

              {/* O poder e a conclusao, entao ele nao e mais um cartao igual aos
                  seis: e a faixa que fecha o painel. */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-line-strong bg-surface-2/60 p-3">
                <span className="flex items-center gap-2">
                  <IconTarget size={18} className="text-accent" />
                  <span className="pix text-[12px] text-text-dim">Poder no nível {s.target}</span>
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

              <Note flush icon={null}>
                Quality não muda com o nível, só com breeding.
              </Note>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

/**
 * Compartilhar: o link e o cartao.
 *
 * O link e de graca — o estado inteiro ja mora na URL, entao "olha esse
 * Charizard" e um copiar. O cartao existe porque o que circula no grupo do jogo
 * e imagem, nao link, e porque ele e desenhado NO NAVEGADOR: nada do pokemon do
 * jogador sai da maquina dele pra virar um print.
 */
function Compartilhar({
  especie,
  state,
  tier,
  tint,
  leitura,
  textoIv,
}: {
  especie: CalcSpecies;
  state: CalcState;
  tier: ReturnType<typeof qualityTier>;
  tint: string;
  leitura: {
    ivs: number[];
    faixas: [number, number][];
    somaIv: number;
    poder: number;
    impossivel: boolean;
  };
  textoIv: (i: number) => string;
}) {
  const [copiado, setCopiado] = useState<"link" | "imagem" | null>(null);
  const [gerando, setGerando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  const avisar = (qual: "link" | "imagem") => {
    setCopiado(qual);
    setTimeout(() => setCopiado(null), 2200);
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      avisar("link");
    } catch {
      setRecado("O navegador não deixou copiar. O link da barra de endereço já é o certo.");
    }
  };

  const gerarImagem = async () => {
    setGerando(true);
    setRecado(null);
    try {
      const blob = await desenharCartao({
        nome: especie.name,
        level: state.level,
        quality: state.quality,
        tierLabel: TIER_LABEL[tier],
        tierColor: TIER_COLOR[tier],
        tipos: [especie.type1, especie.type2]
          .filter((t): t is PokeType => t != null)
          .map((t) => ({ nome: TYPE_LABEL[t], cor: TYPE_COLOR[t] })),
        spriteUrl: spriteUrl(especie.id),
        stats: STAT_LABEL.map((label, i) => ({
          label,
          texto: textoIv(i),
          ratio: leitura.ivs[i] / IV_MAX,
          range: [leitura.faixas[i][0] / IV_MAX, leitura.faixas[i][1] / IV_MAX] as [number, number],
        })),
        ivTotal: `${Math.round(leitura.somaIv)}/${TOTAL_MAX}`,
        ivPct: leitura.impossivel
          ? "—"
          : `${Math.round((leitura.somaIv / TOTAL_MAX) * 100)}%`,
        poder: compact(leitura.poder),
        confiavel: !leitura.impossivel,
        tint,
      });
      if (!blob) {
        setRecado("Não deu pra desenhar o cartão neste navegador.");
        return;
      }
      if (await copiarImagem(blob)) {
        avisar("imagem");
      } else {
        // Firefox ainda nao escreve imagem na area de transferencia — em vez de
        // falhar calado, o arquivo desce.
        baixarImagem(blob, `${especie.name.toLowerCase()}-iv.png`);
        setRecado("Seu navegador não copia imagem, então o arquivo foi baixado.");
      }
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <FieldLabel>Compartilhar</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={copiarLink}
          iconLeft={copiado === "link" ? <IconCheck size={16} /> : <IconLink size={16} />}
        >
          {copiado === "link" ? "link copiado" : "copiar link"}
        </Button>
        <Button variant="primary" onClick={gerarImagem} disabled={gerando}>
          {gerando ? "desenhando..." : copiado === "imagem" ? "imagem copiada" : "gerar imagem"}
        </Button>
      </div>
      {recado ? <Note flush icon={null}>{recado}</Note> : null}
    </div>
  );
}
