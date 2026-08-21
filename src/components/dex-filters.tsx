"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Acquisition, PokeType, Rarity } from "@/lib/types";
import type { DexBounds, DexQuery, Stage } from "@/lib/dex";
import { ALL_TYPES, RARITY_COLOR, RARITY_ORDER, TYPE_COLOR } from "@/lib/typing";
import {
  Button,
  Chip,
  Combobox,
  FieldLabel,
  IconChevronDown,
  MultiSelect,
  NumberRange,
  Range,
  SearchInput,
  Switch,
  type MultiOption,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconBag, IconGem, IconLevel, IconScale, IconTarget, IconTm, IconWeak, IconXp } from "@/components/game-icons";
import { ACQ_HINT, RARITY_LABEL, REGION_LABEL, STAGE_LABEL, TYPE_LABEL } from "@/lib/labels";

/**
 * O trilho de filtros da Pokedex.
 *
 * Tres decisoes de forma, cada uma resolvendo um problema real:
 *
 * 1. **Trilho fixo, nao gaveta.** Filtro escondido atras de um botao e filtro
 *    que ninguem usa — e a versao anterior tinha 3 filtros justamente porque
 *    nao havia onde por mais. Com 15 filtros a vista, a dex responde perguntas
 *    ("quem apanha de Fogo e dropa Bulb?") em vez de so listar bicho.
 * 2. **Grupos colapsaveis, os dois primeiros abertos.** Quinze controles
 *    empilhados viram parede. Os grupos abrem sozinhos quando ha filtro ligado
 *    dentro — filtro ativo NUNCA fica escondido.
 * 3. **Faixa com slider E com par de numeros.** O slider e pra explorar
 *    ("mais ou menos ate 40"), o numero e pra precisar ("exatamente 1 a 15").
 *    Sao dois gestos diferentes na mesma pergunta.
 */

interface Props {
  q: DexQuery;
  onChange: (patch: Partial<DexQuery>) => void;
  bounds: DexBounds;
  /** contagem por tipo no conjunto atual — evita o clique que zera a lista */
  typeCounts: Record<string, number>;
  rarityCounts: Record<string, number>;
  /** nomes de item que alguem dropa, pro indice reverso */
  lootIndex: string[];
  onClear: () => void;
  activeCount: number;
}

function FilterGroup({
  title,
  active,
  defaultOpen,
  children,
}: {
  title: string;
  /** quantos filtros deste grupo estao ligados */
  active?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  // Grupo com filtro ligado NASCE aberto — senao o usuario ve a lista curta e
  // nao acha o motivo.
  const [open, setOpen] = useState(defaultOpen || (active ?? 0) > 0);
  return (
    <section className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
      >
        <span className="pix flex-1 text-[11px] text-text-dim">{title}</span>
        {active ? (
          <span className="pix rounded-pix bg-accent/20 px-1 text-[11px] text-accent">{active}</span>
        ) : null}
        <IconChevronDown
          size={8}
          className={cn("text-text-mute transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="flex flex-col gap-4 px-4 pb-4">{children}</div> : null}
    </section>
  );
}

const TYPE_OPTIONS = (counts: Record<string, number>): MultiOption<PokeType>[] =>
  ALL_TYPES.map((t) => ({
    value: t,
    label: TYPE_LABEL[t],
    tint: TYPE_COLOR[t],
    count: counts[t],
    render: <TypeBadge type={t} size="xs" />,
  }));

const ACQ_OPTIONS: MultiOption<Acquisition>[] = (["hunt", "evo", "special"] as const).map(
  (v) => ({ value: v, label: ACQ_HINT[v] }),
);

const STAGE_OPTIONS: MultiOption<Stage>[] = (["solo", "base", "mid", "final"] as const).map(
  (v) => ({ value: v, label: STAGE_LABEL[v] }),
);

const REGION_OPTIONS: MultiOption<"base" | "orre">[] = (["base", "orre"] as const).map(
  (v) => ({ value: v, label: REGION_LABEL[v] }),
);

const has = (r: [number | null, number | null]) => (r[0] != null || r[1] != null ? 1 : 0);

export function DexFilters({
  q,
  onChange,
  bounds,
  typeCounts,
  rarityCounts,
  lootIndex,
  onClear,
  activeCount,
}: Props) {
  const rarityOptions: MultiOption<Rarity>[] = RARITY_ORDER.map((r) => ({
    value: r,
    label: RARITY_LABEL[r],
    tint: RARITY_COLOR[r],
    count: rarityCounts[r],
  }));

  // Faixa que o slider entrega: null vira o extremo do catalogo, senao o
  // polegar nao teria onde ficar.
  const span = (
    key: "level" | "value" | "statTotal" | "xp" | "power",
  ): [number, number] => [
    q[key][0] ?? bounds[key][0],
    q[key][1] ?? bounds[key][1],
  ];

  // Escrever a faixa: quando ela volta a encostar nos dois extremos, o filtro
  // se APAGA em vez de ficar "ligado no valor todo" — senao o contador de
  // filtros ativos mente e a URL carrega lixo.
  const setSpan =
    (key: "level" | "value" | "statTotal" | "xp" | "power") =>
    ([lo, hi]: [number, number]) =>
      onChange({
        [key]: [
          lo <= bounds[key][0] ? null : lo,
          hi >= bounds[key][1] ? null : hi,
        ] as [number | null, number | null],
      });

  const basicos = (q.q.trim() ? 1 : 0) + (q.types.length ? 1 : 0) + (q.rarities.length ? 1 : 0);
  const origem =
    (q.acquisitions.length ? 1 : 0) + (q.regions.length ? 1 : 0) +
    (q.stages.length ? 1 : 0) + (q.onlySpots ? 1 : 0) + (q.includeVariants ? 1 : 0);
  const numeros = has(q.level) + has(q.value) + has(q.xp) + has(q.statTotal) + has(q.power);
  const tatico = (q.weakTo.length ? 1 : 0) + (q.resistTo.length ? 1 : 0) + (q.onlyTm ? 1 : 0);
  const drops = q.drops ? 1 : 0;

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="pix text-[12px] text-text">Filtros</span>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={!activeCount}>
          limpar{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </header>

      <FilterGroup title="Básico" active={basicos} defaultOpen>
        <SearchInput
          value={q.q}
          onChange={(e) => onChange({ q: e.target.value })}
          onClear={() => onChange({ q: "" })}
          placeholder="nome ou número..."
          aria-label="Buscar pokémon"
        />
        <MultiSelect
          label="tipo"
          unit="tipos"
          searchable
          value={q.types}
          onChange={(types) => onChange({ types })}
          options={TYPE_OPTIONS(typeCounts)}
          mode={q.typeMode}
          onModeChange={(typeMode) => onChange({ typeMode })}
        />
        <MultiSelect
          label="raridade"
          unit="raridades"
          value={q.rarities}
          onChange={(rarities) => onChange({ rarities })}
          options={rarityOptions}
        />
      </FilterGroup>

      <FilterGroup title="Origem" active={origem} defaultOpen>
        <MultiSelect
          label="como consegue"
          unit="origens"
          value={q.acquisitions}
          onChange={(acquisitions) => onChange({ acquisitions })}
          options={ACQ_OPTIONS}
        />
        <MultiSelect
          label="estágio"
          unit="estágios"
          value={q.stages}
          onChange={(stages) => onChange({ stages })}
          options={STAGE_OPTIONS}
        />
        <MultiSelect
          label="região"
          unit="regiões"
          value={q.regions}
          onChange={(regions) => onChange({ regions })}
          options={REGION_OPTIONS}
        />
        <Switch
          checked={q.onlySpots}
          onChange={(e) => onChange({ onlySpots: e.target.checked })}
          label="Só com ponto de caça"
          hint="esconde quem só vem de evolução ou loja"
        />
        <Switch
          checked={q.includeVariants}
          onChange={(e) => onChange({ includeVariants: e.target.checked })}
          label="Incluir variantes de skin"
          hint="Brave Blastoise e cia — mesma espécie, outro visual"
        />
      </FilterGroup>

      <FilterGroup title="Números" active={numeros}>
        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconLevel size={9} />Nível de caça</FieldLabel>
          <Range
            label="Nível de caça"
            min={bounds.level[0]}
            max={bounds.level[1]}
            value={span("level")}
            onChange={setSpan("level")}
          />
          <NumberRange
            min={bounds.level[0]}
            max={bounds.level[1]}
            value={q.level}
            onChange={(level) => onChange({ level })}
          />
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconGem size={9} />Valor de venda</FieldLabel>
          <Range
            label="Valor"
            min={bounds.value[0]}
            max={bounds.value[1]}
            step={10}
            value={span("value")}
            onChange={setSpan("value")}
            format={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))}
          />
          <NumberRange
            min={bounds.value[0]}
            max={bounds.value[1]}
            value={q.value}
            onChange={(value) => onChange({ value })}
          />
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconXp size={9} />XP por abate</FieldLabel>
          <Range
            label="XP"
            min={bounds.xp[0]}
            max={bounds.xp[1]}
            step={5}
            value={span("xp")}
            onChange={setSpan("xp")}
          />
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconScale size={9} />Total de stats base</FieldLabel>
          <Range
            label="Total de stats"
            min={bounds.statTotal[0]}
            max={bounds.statTotal[1]}
            step={5}
            value={span("statTotal")}
            onChange={setSpan("statTotal")}
          />
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconTarget size={9} />Poder do melhor golpe</FieldLabel>
          <Range
            label="Poder do golpe"
            min={bounds.power[0]}
            max={bounds.power[1]}
            step={5}
            value={span("power")}
            onChange={setSpan("power")}
          />
          {/* O pool importa muito: TODO golpe de poder 600 do jogo e de TM, e em
              164 especies o melhor golpe muda ao incluir maquina. O padrao e
              NATURAL porque e o que todo jogador tem na mao. */}
          <div className="mt-1.5 flex items-center gap-1">
            {(["natural", "tm"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant="ghost"
                active={q.movePool === p}
                onClick={() => onChange({ movePool: p })}
                className="flex-1"
              >
                {p === "natural" ? "natural" : "com TM"}
              </Button>
            ))}
          </div>
        </div>
      </FilterGroup>

      <FilterGroup title="Tático" active={tatico}>
        <div>
          <MultiSelect
            label="fraco contra"
            unit="tipos"
            searchable
            value={q.weakTo}
            onChange={(weakTo) => onChange({ weakTo })}
            options={TYPE_OPTIONS(typeCounts)}
          />
          <p className="mt-1 text-[12px] leading-snug text-text-mute">
            quem APANHA destes tipos — marcando dois, pede os dois ao mesmo tempo
          </p>
        </div>
        <div>
          <MultiSelect
            label="resiste a"
            unit="tipos"
            searchable
            value={q.resistTo}
            onChange={(resistTo) => onChange({ resistTo })}
            options={TYPE_OPTIONS(typeCounts)}
          />
          <p className="mt-1 text-[12px] leading-snug text-text-mute">
            quem AGUENTA estes tipos, incluindo imunidade
          </p>
        </div>
        <Switch
          checked={q.onlyTm}
          onChange={(e) => onChange({ onlyTm: e.target.checked })}
          label="Só quem aprende TM"
          hint="os golpes de poder 600 são todos de máquina"
        />
      </FilterGroup>

      <FilterGroup title="Drops" active={drops}>
        {/* O indice reverso: o catalogo do jogo so diz "o Bulbasaur dropa Bulb".
            A pergunta util e a inversa — "quem dropa Bulb?" — e ela nao existe
            em lugar nenhum, nem no jogo nem no piwtools. */}
        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5"><IconBag size={9} />Quem dropa este item</FieldLabel>
          <Combobox
            value={q.drops}
            onChange={(drops) => onChange({ drops })}
            options={lootIndex.map((name) => ({ value: name, label: name }))}
            placeholder="nome do item..."
            emptyText="nenhum item com esse nome"
          />
          {q.drops ? (
            <div className="mt-1.5">
              <Chip tone="accent" onRemove={() => onChange({ drops: null })}>
                {q.drops}
              </Chip>
            </div>
          ) : null}
        </div>
      </FilterGroup>
    </div>
  );
}
