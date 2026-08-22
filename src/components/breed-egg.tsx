"use client";

import { cn } from "@/lib/cn";
import type { BreedMon, EggProjection } from "@/lib/breeding";
import {
  DOUBLE_STONE_IV_CHANCE,
  IV_MAX,
  IV_MAX_TOTAL,
  ivTotal,
  tiersFor,
  type BreedMode,
} from "@/lib/breeding";
import { DOUBLE_STONE_EXTRA, doubleStoneMath } from "@/lib/breed-plan";
import { textoIv, textoIvTotal, type IvReading } from "@/lib/iv-reading";
import { projectAll } from "@/lib/stats";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { animatedSpriteUrl, spriteUrl } from "@/lib/sprites";
import { STAT_LABEL, STAT_SHORT, compact } from "@/lib/labels";
import { TypeBadge } from "@/components/type-icon";
import { IconGem, IconLevel, IconStone, IconTarget, STAT_ICONS } from "@/components/game-icons";
import {
  Chip,
  Empty,
  FieldLabel,
  IconCoin,
  IconStar,
  Note,
  NumberField,
  Panel,
  Sprite,
  StatTile,
  Tooltip,
} from "@/components/ui";
import type { BreedSpecies } from "./breed-tool";

const q3 = (n: number) => n.toFixed(3);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * O ovo.
 *
 * Mesma decisao de forma da calculadora: o resultado e um **perfil**, nao um
 * relatorio. Quem chegou ate aqui ja gastou doze campos preenchendo dois pais e
 * quer ver o BICHO que vai sair — sprite, nome, e as tres manchetes antes de
 * qualquer tabela.
 *
 * O que esta tela tem de proprio e a honestidade sobre o sorteio: o jogo nao
 * entrega um ovo, entrega uma DISTRIBUICAO. Por isso a Quality aparece como
 * faixa e como media ponderada, e os quatro resultados possiveis ficam abertos
 * com a probabilidade de cada um — em vez de um numero unico que finge que o
 * resultado ja esta decidido.
 */
export function BreedEgg({
  egg,
  a,
  b,
  leitura,
  especie,
  mode,
  double,
  level,
  onLevel,
  tint,
}: {
  egg: EggProjection | null;
  a: BreedMon | null;
  b: BreedMon | null;
  /** a leitura do pai que DOA o IV; null quando ele veio de IV digitado direto */
  leitura: IvReading | null;
  especie: BreedSpecies | null;
  mode: BreedMode;
  double: boolean;
  level: number;
  onLevel: (n: number) => void;
  tint: string;
}) {
  // Sem ovo a secao ainda existe: as quatro probabilidades do modo sao constantes
  // do jogo e ja ensinam o que a escolha muda, mesmo antes do par fechar.
  if (!egg || !a || !b || !especie) {
    return (
      <Panel title={<span className="flex items-center gap-2"><IconGem size={16} />O ovo</span>}>
        <div className="flex flex-col gap-4">
          <Empty
            title="Nenhum ovo ainda"
            hint="O par precisa ser da mesma espécie e ter Quality a até 0.150 de distância."
          />
          <div>
            <FieldLabel className="mb-2">O sorteio deste modo, de qualquer jeito</FieldLabel>
            <Sorteio outcomes={tiersFor(mode).map((t) => ({ ...t, quality: null, capped: false }))} tint={tint} />
          </div>
        </div>
      </Panel>
    );
  }

  const doador = egg.fromParent === "a" ? a : b;
  const outro = egg.fromParent === "a" ? b : a;
  const ivDoador = ivTotal(doador.ivs);
  const ivOutro = ivTotal(outro.ivs);
  const empate = Math.abs(a.quality - b.quality) < 1e-9;

  const stats = projectAll(especie.bases, egg.ivs, level, egg.expectedQuality);
  const ds = doubleStoneMath(egg.ivs, DOUBLE_STONE_IV_CHANCE);

  // O filho herda o IV inteiro do pai que doa — entao herda a DUVIDA daquele pai
  // junto. Se a leitura do doador nao fechou num inteiro, o IV do ovo tambem nao
  // fecha, e a tela nao pode imprimir "32" onde o que se sabe e "30 a 32".
  const incerto = leitura != null && !leitura.cravado && !leitura.impossivel;
  // Leitura impossivel nao e "incerta", e ERRADA: nenhum IV valido explica os
  // stats informados. O motor trava o IV em 0..32 e devolve um ovo de aparencia
  // normal — se a tela nao disser nada, ela publica um numero que nasceu de uma
  // entrada que ela mesma sabe estar furada.
  const furado = leitura?.impossivel ?? false;

  return (
    <section className="panel scanline relative flex flex-col">
      {/* ---- cabecalho de perfil ---- */}
      <header className="flex flex-col gap-5 border-b border-line p-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="relative grid shrink-0 place-items-center self-center">
          <span
            aria-hidden="true"
            className="anim-glow absolute h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: egg.shinyGuaranteed ? "var(--color-warn)" : RARITY_COLOR[especie.rarity] }}
          />
          <Sprite
            src={spriteUrl(especie.id, egg.shinyGuaranteed)}
            animatedSrc={egg.shinyGuaranteed ? null : animatedSpriteUrl(especie.id)}
            alt={especie.name}
            size={152}
            className="anim-float relative"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[28px] leading-none font-bold text-text">{especie.name}</h2>
            <span className="pix text-[12px] text-text-mute">o filho</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={especie.type1} />
            {especie.type2 ? <TypeBadge type={especie.type2} /> : null}
            {egg.shinyGuaranteed ? (
              <Chip tone="warn" icon={<IconStar size={14} />}>Shiny garantido</Chip>
            ) : (
              <Tooltip content="Regra provisória: ainda não confirmada por documentação do jogo.">
                <Chip size="sm" icon={<IconStar size={14} />}>
                  {pct(egg.spontaneousShinyChance)} de Shiny · provisório
                </Chip>
              </Tooltip>
            )}
          </div>

          {/* As tres manchetes. A do meio e a QUALITY MEDIA, nao o melhor caso —
              manchete otimista numa tela de sorteio e propaganda, nao dado. */}
          <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
            {[
              { label: "quality média", value: q3(egg.expectedQuality), tone: "text-neon", grande: true },
              { label: "faixa possível", value: `${q3(egg.minQuality)}–${q3(egg.maxQuality)}`, tone: "text-text" },
              {
                label: furado ? "IV não confere" : incerto ? "IV herdado, estimado" : "IV herdado",
                value: furado ? "—" : incerto ? textoIvTotal(leitura!) : `${egg.ivTotal}`,
                sufixo: furado ? undefined : `/${IV_MAX_TOTAL}`,
                tone: furado ? "text-danger" : "text-accent",
              },
            ].map((k) => (
              <div key={k.label} className="bg-surface px-3 py-2.5">
                <dd className={cn("leading-none font-bold tabular", k.grande ? "text-[26px]" : "text-[20px]", k.tone)}>
                  {k.value}
                  {k.sufixo ? <span className="text-[14px] text-text-mute">{k.sufixo}</span> : null}
                </dd>
                <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-5">
        {/* ---- o sorteio ---- */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <FieldLabel>O sorteio da Quality</FieldLabel>
            <span className="text-[13px] text-text-mute">
              parte de {q3(egg.baseQuality)}
            </span>
          </div>
          <Sorteio outcomes={egg.outcomes} tint={tint} />
          {egg.anyCapped ? (
            <Note tone="warn" className="mt-2">
              O teto de 2.600 do pokémon normal engole parte dos sorteios altos — essa Quality
              é paga e não entra.
            </Note>
          ) : null}
        </div>

        {/* ---- os IVs herdados ---- */}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <FieldLabel>
              IV herdado inteiro do slot {egg.fromParent === "a" ? "1" : "2"} · {doador.name}
            </FieldLabel>
            <span className="text-[13px] text-text-mute tabular">
              {furado ? "—" : incerto ? textoIvTotal(leitura!) : egg.ivTotal} de {IV_MAX_TOTAL}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {egg.ivs.map((v, i) => {
              const Icon = STAT_ICONS[i];
              const alvo = egg.doubleStoneEligible.includes(i);
              const largo = incerto && leitura!.faixas[i][1] - leitura!.faixas[i][0] > 1;
              return (
                <div
                  key={i}
                  title={STAT_LABEL[i]}
                  className={cn(
                    "flex flex-col items-center gap-1 border px-2 py-2",
                    alvo ? "border-warn/45 bg-warn/10" : "border-line bg-surface-2/50",
                  )}
                >
                  <span className="pix flex items-center gap-1 text-[11px] text-text-mute">
                    <Icon size={14} />
                    {STAT_SHORT[i]}
                  </span>
                  <span
                    className={cn(
                      "leading-none font-semibold tabular",
                      // `furado` entra ANTES da escada de cor: sem isso o "—" caia
                      // no ramo `v >= IV_MAX` (a leitura furada trava tudo em 32) e
                      // saia VERDE de IV perfeito, colado no aviso vermelho que diz
                      // pra nao acreditar no numero. Cor tambem afirma.
                      furado ? "text-[18px] text-text-mute" : largo ? "text-[15px] text-warn" : "text-[18px]",
                      furado || largo ? "" : v >= IV_MAX ? "text-ok" : v >= 24 ? "text-text" : "text-text-dim",
                    )}
                  >
                    {furado ? "—" : largo ? textoIv(leitura!, i) : v}
                  </span>
                </div>
              );
            })}
          </div>

          {furado ? (
            <Note tone="danger" className="mt-3">
              O IV abaixo não vale: nenhum valor entre 0 e {IV_MAX} explica os stats de{" "}
              {doador.name} no nível e na quality informados. Confira os dois no slot antes
              de olhar o resto desta tela.
            </Note>
          ) : incerto ? (
            <Note tone="warn" className="mt-3">
              Esse IV é LEITURA, não número do jogo: o stat da tela já veio arredondado, e no
              nível de {doador.name} ele cabe numa faixa de até {leitura!.largura.toFixed(0)}{" "}
              pontos. O ovo herda o que o pai realmente tem — suba esse pai de nível antes de
              queimar o par e a faixa fecha.
            </Note>
          ) : null}

          {/* O aviso que muda a decisao: o IV vem INTEIRO de um pai so, entao o
              outro esta sendo jogado fora. Se o descartado for o melhor, isso
              precisa doer ANTES de queimar os dois. */}
          {ivOutro > ivDoador ? (
            <Note tone="warn" className="mt-3">
              O slot que doa é o de maior Quality, não o de melhor IV: {outro.name} tem{" "}
              {ivOutro} de IV contra {ivDoador} e vai inteiro pro lixo — {ivOutro - ivDoador}{" "}
              pontos a menos no filho.
              {empate ? " Como a Quality empatou, quem doa é o slot 1: troque os dois de lado." : ""}
            </Note>
          ) : empate ? (
            <Note className="mt-3">
              Quality empatada: em empate quem doa o IV é o slot 1.
            </Note>
          ) : null}

          {/* `!furado`: com a leitura impossivel os IVs vem travados em 32, entao
              `ds.elegiveis` da 0 e a nota escrevia por extenso "os seis stats ja
              estao em 32" — afirmando pokemon perfeito no mesmo bloco em que o
              aviso vermelho diz que a leitura nao fecha. Conselho tirado de dado
              furado nao e conselho conservador: e conselho errado. */}
          {double && !furado ? (
            <Note tone={ds.elegiveis > 0 ? "warn" : "muted"} className="mt-3">
              {ds.elegiveis > 0 ? (
                <>
                  Double Stones: {pct(DOUBLE_STONE_IV_CHANCE)} de +1 IV num dos {ds.elegiveis}{" "}
                  stats abaixo de {IV_MAX} (marcados acima). São {DOUBLE_STONE_EXTRA} Stones a
                  mais por breed, ou seja {ds.breedsPorIv} breeds e {ds.stonesPorIv} Stones
                  extras por ponto de IV esperado.
                </>
              ) : (
                <>
                  Double Stones não faz nada aqui: os seis stats já estão em {IV_MAX}. São{" "}
                  {DOUBLE_STONE_EXTRA} Stones a mais por nada.
                </>
              )}
            </Note>
          ) : null}
        </div>

        {/* ---- os stats de verdade ---- */}
        <div className="border-t border-line pt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <FieldLabel>O filho em números, na Quality média</FieldLabel>
            <div className="flex items-end gap-2">
              <FieldLabel className="mb-2.5 flex items-center gap-1.5">
                <IconLevel size={15} />
                Nível
              </FieldLabel>
              <NumberField
                min={1}
                fallback={100}
                aria-label="Nível da projeção"
                value={level}
                onChange={onLevel}
                wrapClassName="w-28"
                className="text-center text-[15px]"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.stats.map((v, i) => {
              const Icon = STAT_ICONS[i];
              return (
                <StatTile
                  key={i}
                  label={STAT_LABEL[i]}
                  icon={<Icon size={14} />}
                  value={v}
                  ratio={egg.ivs[i] / IV_MAX}
                  tint={tint}
                  footLeft={`base ${especie.bases[i]}`}
                  footRight={`IV ${egg.ivs[i]}`}
                />
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 border border-line-strong bg-surface-2/60 p-3">
            <span className="flex items-center gap-2">
              <IconTarget size={18} className="text-accent" />
              <span className="pix text-[12px] text-text-dim">Poder no nível {level}</span>
            </span>
            <Tooltip content="Soma dos stats projetados multiplicada pela Quality média do sorteio.">
              <span className="text-[26px] leading-none font-bold text-accent tabular">
                {compact(stats.power)}
              </span>
            </Tooltip>
            <Note flush icon={null} className="ml-auto border-none pt-0 text-[12px]">
              {incerto
                ? "a Quality sai do sorteio e o IV é estimado: dois motivos pra ler isto como ordem de grandeza"
                : "a Quality real sai do sorteio; este é o caso médio"}
            </Note>
          </div>
        </div>

        {/* ---- o preco de UM breed ---- */}
        <div className="border-t border-line pt-4">
          <FieldLabel className="mb-2">O que este breed custa</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            <Custo
              icon={<IconCoin size={16} />}
              label="dinheiro"
              value={`R$ ${egg.cost.money.toLocaleString("pt-BR")}`}
              tint="var(--color-warn)"
            />
            <Custo
              icon={<IconStone size={16} />}
              label="evolution stones"
              value={String(egg.cost.stones)}
              hint={
                egg.cost.types === 2
                  ? `${egg.cost.stonesPerType} de cada tipo`
                  : "de um tipo só"
              }
              tint="var(--color-t-calc)"
            />
            <Custo
              icon={<IconGem size={16} />}
              label="strange pheromones"
              value={mode === "pheromone" ? String(egg.cost.pheromones) : "—"}
              hint={mode === "pheromone" ? undefined : "só no modo Pheromone"}
              tint="var(--color-t-breed)"
            />
          </div>
          <Note flush className="mt-3">
            Os dois pais são consumidos. Esse é o custo que não aparece em Stones nem em
            reais.
          </Note>
        </div>
      </div>
    </section>
  );
}

/** As quatro linhas do sorteio: ganho, probabilidade e a Quality que sai. */
function Sorteio({
  outcomes,
  tint,
}: {
  outcomes: { gain: number; prob: number; quality: number | null; capped: boolean }[];
  tint: string;
}) {
  const maior = Math.max(...outcomes.map((o) => o.prob));
  return (
    <div className="flex flex-col gap-1.5">
      {outcomes.map((o) => (
        <div key={o.gain} className="flex items-center gap-2 sm:gap-3">
          <span className="pix w-14 shrink-0 text-[12px] tabular" style={{ color: tint }}>
            +{q3(o.gain)}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden border border-line bg-bg-soft">
            <div
              className="h-full transition-all"
              style={{ width: `${(o.prob / maior) * 100}%`, backgroundColor: tint }}
            />
          </div>
          <span className="w-11 shrink-0 text-right text-[13px] text-text-dim tabular">
            {pct(o.prob)}
          </span>
          <span className="w-24 shrink-0 text-right text-[13px] tabular">
            {o.quality != null ? (
              <span className={o.capped ? "text-warn" : "text-text"}>
                {q3(o.quality)}
                {o.capped ? " ·teto" : ""}
              </span>
            ) : (
              <span className="text-text-mute">—</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function Custo({
  icon,
  label,
  value,
  hint,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tint: string;
}) {
  return (
    <div className="border border-line bg-surface-2/50 px-3 py-2.5">
      <span className="pix flex items-center gap-1.5 text-[11px] text-text-mute">
        <span style={{ color: tint }}>{icon}</span>
        {label}
      </span>
      <span className="mt-1.5 block text-[20px] leading-none font-bold text-text tabular">
        {value}
      </span>
      {hint ? <span className="mt-1 block text-[12px] text-text-mute">{hint}</span> : null}
    </div>
  );
}
