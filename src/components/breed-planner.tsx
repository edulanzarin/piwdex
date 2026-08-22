"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { BreedMon } from "@/lib/breeding";
import { QUALITY_DIFF_MAX, QUALITY_MAX_NORMAL, expectedGain, type BreedMode } from "@/lib/breeding";
import { planBreeding, type ModePlan } from "@/lib/breed-plan";
import { spriteUrl } from "@/lib/sprites";
import { compact } from "@/lib/labels";
import { IconGem, IconStone, IconTarget } from "@/components/game-icons";
import {
  Chip,
  FieldLabel,
  IconCoin,
  IconStar,
  Note,
  NumberField,
  Panel,
  Sprite,
  Tooltip,
} from "@/components/ui";

const q3 = (n: number) => n.toFixed(3);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * O planejador: quantos breeds faltam ate a Quality alvo.
 *
 * Esta e a tela que justifica a ferramenta existir. O jogo mostra a Quality de
 * agora; o que ele nao mostra e o TAMANHO da escada — e a escada e cara: cada
 * degrau custa R$ 2.000.000, 20 Stones e dois pokemon.
 *
 * A resposta e uma DISTRIBUICAO e aparece como tres numeros, nunca um:
 *
 *   - **melhor caso**, se todo sorteio vier no maximo;
 *   - **tipico** (mediana), que e onde metade das tentativas fecha;
 *   - **azarado** (p90), que e o orcamento que nao te deixa parar no meio.
 *
 * O numero unico da media e o que faz alguem comecar uma corrente de 167 breeds
 * com dinheiro pra 150. A conta exata esta em `breed-plan.ts`.
 */
export function BreedPlanner({
  base,
  target,
  onTarget,
  mode,
  tint,
}: {
  base: BreedMon | null;
  target: number;
  onTarget: (n: number) => void;
  mode: BreedMode;
  tint: string;
}) {
  // A cadeia de Markov custa ~27ms no pior alvo possivel. Isso e barato uma vez
  // e caro a cada tecla digitada num campo de IV do outro painel — memo aqui.
  const plano = useMemo(
    () => (base ? planBreeding(base.quality, target, base.shiny) : null),
    [base, target],
  );

  // O aviso de desperdicio muda de texto conforme o alvo SEJA o teto ou apenas
  // esteja a menos de um sorteio dele: no primeiro caso a sobra inteira se perde,
  // no segundo so a parte que passa de 2.600.
  const alvoNoTeto =
    plano != null && plano.cap != null && plano.effectiveTarget >= plano.cap - 1e-9;

  return (
    <Panel
      title={<span className="flex items-center gap-2"><IconTarget size={16} />Planejador de Quality</span>}
    >
      <div className="flex flex-col gap-4">
        {/* ---- a pergunta ---- */}
        <div className="flex flex-wrap items-end gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            <FieldLabel className="mb-1">De onde parte</FieldLabel>
            {base ? (
              <span className="flex h-10 items-center gap-2">
                <Sprite src={spriteUrl(base.pokeId, base.shiny)} alt="" size={30} />
                <span className="text-[20px] leading-none font-bold text-text tabular">
                  {q3(base.quality)}
                </span>
                <span className="min-w-0 truncate text-[13px] text-text-mute">{base.name}</span>
                {base.shiny ? <Chip size="xs" tone="warn" icon={<IconStar size={13} />}>shiny</Chip> : null}
              </span>
            ) : (
              <span className="flex h-10 items-center text-[13px] text-text-mute">
                preencha um dos pais
              </span>
            )}
          </div>

          <div>
            <FieldLabel className="mb-1 flex items-center gap-1.5">
              <IconGem size={15} />
              Quality alvo
            </FieldLabel>
            <NumberField
              min={0}
              max={10}
              step={0.001}
              fallback={QUALITY_MAX_NORMAL}
              aria-label="Quality alvo"
              value={target}
              onChange={onTarget}
              wrapClassName="w-32"
              className="text-center text-[16px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {[1.5, 2, 2.3, QUALITY_MAX_NORMAL].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onTarget(n)}
                className={cn(
                  "pix h-8 border px-2.5 text-[12px] tabular transition-colors",
                  Math.abs(target - n) < 1e-9
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-line text-text-mute hover:text-text-dim",
                )}
              >
                {q3(n)}
              </button>
            ))}
          </div>
        </div>

        {/* ---- o veredito ---- */}
        {!plano ? (
          <Note icon={null}>
            O planejador parte do pai de maior Quality entre os dois slots.
          </Note>
        ) : plano.reached ? (
          <Note tone="ok">
            {q3(plano.base)} já está em {q3(plano.effectiveTarget)} ou acima. Não há breed a
            fazer por Quality.
          </Note>
        ) : (
          <>
            {plano.overCap ? (
              <Note tone="warn">
                Pokémon normal trava em {q3(QUALITY_MAX_NORMAL)}. O plano abaixo mira no teto,
                não em {q3(plano.target)} — só um Shiny passa disso.
              </Note>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              <LinhaModo
                plano={plano.free}
                delta={plano.delta}
                atual={mode === "free"}
                alvoNoTeto={alvoNoTeto}
                tint="var(--color-t-calc)"
              />
              <LinhaModo
                plano={plano.pheromone}
                delta={plano.delta}
                atual={mode === "pheromone"}
                alvoNoTeto={alvoNoTeto}
                tint="var(--color-t-breed)"
              />
            </div>

            <Note flush>
              A conta é exata sobre a tabela de sorteio do jogo, não uma simulação — mas ela
              assume que você sempre tem um parceiro válido pra cada breed. Achar esse
              parceiro é o trabalho que a tabela não mostra.
            </Note>
          </>
        )}
      </div>
    </Panel>
  );
}

function LinhaModo({
  plano,
  delta,
  atual,
  alvoNoTeto,
  tint,
}: {
  plano: ModePlan;
  delta: number;
  atual: boolean;
  alvoNoTeto: boolean;
  tint: string;
}) {
  const { dist } = plano;
  const nome = plano.mode === "free" ? "Free Breeding" : "Strange Pheromone";
  const orfao = plano.compatChance < 1;

  return (
    <div
      className="flex flex-col gap-3 border bg-surface-2/40 p-4"
      style={{
        borderColor: atual
          ? `color-mix(in oklab, ${tint} 55%, transparent)`
          : "var(--color-line)",
        boxShadow: atual ? `0 0 40px -28px ${tint}` : undefined,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="pix text-[13px]" style={{ color: tint }}>
          {nome}
        </span>
        <span className="text-[12px] text-text-mute tabular">
          ganho médio +{expectedGain(plano.mode).toFixed(4)}
        </span>
      </div>

      {/* Os TRES numeros. O tipico e o grande; melhor e azarado ficam ao lado
          porque so juntos eles dizem o tamanho da aposta. */}
      <dl className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
        {[
          { label: "melhor caso", value: dist.melhor, forte: false },
          { label: "típico", value: dist.p50, forte: true },
          { label: "azarado", value: dist.p90, forte: false },
        ].map((k) => (
          <div key={k.label} className={cn("px-3 py-2", k.forte ? "bg-surface-2" : "bg-surface")}>
            <dd
              className={cn(
                "leading-none font-bold tabular",
                k.forte ? "text-[26px]" : "text-[18px]",
                k.forte ? "text-text" : "text-text-mute",
              )}
              style={k.forte ? { color: tint } : undefined}
            >
              {k.value}
            </dd>
            <dt className="pix mt-1.5 text-[11px] text-text-mute">{k.label}</dt>
          </div>
        ))}
      </dl>
      <span className="pix -mt-1 text-[11px] text-text-mute">
        breeds pra subir {q3(delta)} de Quality
        {dist.exato ? "" : " · alvo longe demais pra conta exata, isto é aproximação"}
      </span>

      {/* O orcamento vai pelo AZARADO, nao pelo tipico: quem orça na mediana
          para no meio da corrente metade das vezes. */}
      <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-[13px]">
        <Linha
          icon={<IconCoin size={15} className="text-warn" />}
          label="dinheiro"
          tipico={`R$ ${compact(plano.money[0])}`}
          azarado={`R$ ${compact(plano.money[1])}`}
        />
        <Linha
          icon={<IconStone size={15} className="text-[var(--color-t-calc)]" />}
          label="stones"
          tipico={plano.stones[0].toLocaleString("pt-BR")}
          azarado={plano.stones[1].toLocaleString("pt-BR")}
        />
        {plano.mode === "pheromone" ? (
          <Linha
            icon={<IconGem size={15} className="text-[var(--color-t-breed)]" />}
            label="pheromones"
            tipico={plano.pheromones[0].toLocaleString("pt-BR")}
            azarado={plano.pheromones[1].toLocaleString("pt-BR")}
          />
        ) : null}
        <Linha
          icon={<IconStar size={15} className="text-text-mute" />}
          label="pokémon da espécie"
          tipico={String(plano.parents[0])}
          azarado={String(plano.parents[1])}
          hint="cada breed come dois e devolve um, então a corrente inteira custa um a mais que o número de breeds"
        />
      </dl>

      {/* Os dois riscos do jogo, com numero em vez de adjetivo. */}
      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        {orfao ? (
          <Note tone="warn" flush>
            {pct(1 - plano.compatChance)} dos sorteios sobem mais de {q3(QUALITY_DIFF_MAX)} e
            deixam o filho SEM par na sua estante de hoje — só {pct(plano.compatChance)} das
            vezes ele ainda casa com um parceiro na Quality atual.
          </Note>
        ) : (
          <Note flush>
            O maior ganho do modo cabe dentro de {q3(QUALITY_DIFF_MAX)}: o filho sempre continua
            compatível com um parceiro na Quality de agora.
          </Note>
        )}
        {plano.capWaste ? (
          <Note tone="warn" flush>
            {alvoNoTeto ? (
              <>
                O alvo É o teto: o último sorteio passa dele em {q3(dist.sobra)} de Quality,
                em média, e no pokémon normal essa sobra morre em {q3(QUALITY_MAX_NORMAL)} —
                é dinheiro jogado fora.
              </>
            ) : (
              <>
                O alvo está a menos de um sorteio do teto: os ganhos altos do último breed
                passam de {q3(QUALITY_MAX_NORMAL)}, e o que passa do teto não conta.
              </>
            )}
          </Note>
        ) : null}
      </div>
    </div>
  );
}

function Linha({
  icon,
  label,
  tipico,
  azarado,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  tipico: string;
  azarado: string;
  hint?: string;
}) {
  const corpo = (
    <span className="flex items-baseline gap-2">
      <span className="flex shrink-0 items-center gap-1.5 text-text-mute">
        {icon}
        <span className="pix text-[11px]">{label}</span>
      </span>
      <span className="ml-auto font-semibold text-text tabular">{tipico}</span>
      <span className="shrink-0 text-text-mute tabular">→ {azarado}</span>
    </span>
  );
  return hint ? <Tooltip content={hint}>{corpo}</Tooltip> : corpo;
}
