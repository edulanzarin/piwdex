"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  ALL_CATEGORIES,
  type ItemBounds,
  type ItemCategory,
  type ItemOrigin,
  type ItemQuery,
} from "@/lib/items";
import type { DexBrief } from "@/lib/items-data";
import { spriteUrl } from "@/lib/sprites";
import {
  Button,
  Chip,
  Combobox,
  FieldLabel,
  IconChevronDown,
  MultiSelect,
  NumberRange,
  IconCoin,
  Range,
  SearchInput,
  Sprite,
  Switch,
  type MultiOption,
} from "@/components/ui";
import {
  IconChance,
  IconLevel,
  IconLoot,
  ItemCategoryIcon,
} from "@/components/game-icons";
import { ITEM_CATEGORY_LABEL, ITEM_ORIGIN_HINT, compact } from "@/lib/labels";

/**
 * O trilho de filtros dos Itens — mesma forma da dex (trilho fixo, grupos
 * colapsaveis que nascem abertos quando ha filtro dentro).
 *
 * Uma diferenca de fundo em relacao a dex, e ela e de DADO, nao de gosto: o
 * valor de NPC vai de 1 a 1.000.000, com metade do catalogo abaixo de 40. Num
 * trilho linear, essa metade inteira mora nos primeiros 0,004% da barra e o
 * polegar nao consegue separar 30 de 900. Por isso preco entra so por NUMERO,
 * enquanto chance (0-100), nivel e contagem de fontes — que sao escalas curtas
 * e uniformes — ganham slider.
 */

interface Props {
  q: ItemQuery;
  onChange: (patch: Partial<ItemQuery>) => void;
  bounds: ItemBounds;
  categoryCounts: Record<string, number>;
  originCounts: Record<string, number>;
  /** especies que dropam alguma coisa, pro filtro inverso */
  dexIndex: DexBrief[];
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
  active?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
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
          size={14}
          className={cn("text-text-mute transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="flex flex-col gap-4 px-4 pb-4">{children}</div> : null}
    </section>
  );
}

const ORIGIN_OPTIONS: MultiOption<ItemOrigin>[] = (["drop", "shop", "special"] as const).map(
  (v) => ({ value: v, label: ITEM_ORIGIN_HINT[v] }),
);

const has = (r: [number | null, number | null]) => (r[0] != null || r[1] != null ? 1 : 0);

export function ItemsFilters({
  q,
  onChange,
  bounds,
  categoryCounts,
  originCounts,
  dexIndex,
  onClear,
  activeCount,
}: Props) {
  const categoryOptions: MultiOption<ItemCategory>[] = ALL_CATEGORIES.map((c) => ({
    value: c,
    label: ITEM_CATEGORY_LABEL[c],
    count: categoryCounts[c],
    render: (
      <span className="flex items-center gap-1.5">
        <ItemCategoryIcon category={c} size={15} />
        {ITEM_CATEGORY_LABEL[c]}
      </span>
    ),
  }));

  const span = (key: "chance" | "farmLevel" | "sources"): [number, number] => [
    q[key][0] ?? bounds[key][0],
    q[key][1] ?? bounds[key][1],
  ];

  // Faixa que volta a encostar nos dois extremos se APAGA — senao o contador de
  // filtros ativos mente e a URL carrega lixo.
  const setSpan =
    (key: "chance" | "farmLevel" | "sources") =>
    ([lo, hi]: [number, number]) =>
      onChange({
        [key]: [
          lo <= bounds[key][0] ? null : lo,
          hi >= bounds[key][1] ? null : hi,
        ] as [number | null, number | null],
      });

  const basicos =
    (q.q.trim() ? 1 : 0) + (q.categories.length ? 1 : 0) + (q.onlyRare ? 1 : 0);
  const origem = (q.origins.length ? 1 : 0) + (q.onlyFarmable ? 1 : 0);
  const numeros = has(q.price) + has(q.chance) + has(q.farmLevel) + has(q.sources);
  const quem = q.droppedBy != null ? 1 : 0;

  const selecionado = dexIndex.find((d) => d.id === q.droppedBy) ?? null;

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
          placeholder="nome ou descrição..."
          aria-label="Buscar item"
        />
        <MultiSelect
          label="categoria"
          unit="categorias"
          value={q.categories}
          onChange={(categories) => onChange({ categories })}
          options={categoryOptions}
        />
        <Switch
          checked={q.onlyRare}
          onChange={(e) => onChange({ onlyRare: e.target.checked })}
          label="Só os raros"
          hint="o selo de raro é do próprio jogo"
        />
      </FilterGroup>

      <FilterGroup title="Origem" active={origem} defaultOpen>
        <MultiSelect
          label="de onde vem"
          unit="origens"
          value={q.origins}
          onChange={(origins) => onChange({ origins })}
          options={ORIGIN_OPTIONS.map((o) => ({ ...o, count: originCounts[o.value] }))}
        />
        {/* "Cai de alguem" e "da pra farmar" NAO sao a mesma coisa: 54 itens so
            caem de especies que nao tem ponto no mapa — quem so evolui ou so
            vem do cassino. Sem esta chave, a lista promete uma cacada que nao
            existe. */}
        <Switch
          checked={q.onlyFarmable}
          onChange={(e) => onChange({ onlyFarmable: e.target.checked })}
          label="Só o que dá pra farmar"
          hint="esconde quem só cai de espécie sem ponto no mapa"
        />
      </FilterGroup>

      <FilterGroup title="Números" active={numeros}>
        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5">
            <IconCoin size={15} />
            Valor de NPC
          </FieldLabel>
          {/* Sem slider aqui de proposito — ver o comentario do topo: a escala
              e de cauda longa (1 a 1.000.000, mediana 40) e o trilho linear
              nao consegue separar 30 de 900. */}
          <NumberRange
            min={bounds.price[0]}
            max={bounds.price[1]}
            value={q.price}
            onChange={(price) => onChange({ price })}
          />
          <p className="mt-1 text-[12px] leading-snug text-text-mute">
            o que o Mark paga por unidade — vai de 1 a {compact(bounds.price[1])}
          </p>
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5">
            <IconChance size={15} />
            Chance na melhor fonte
          </FieldLabel>
          <Range
            label="Chance"
            min={bounds.chance[0]}
            max={bounds.chance[1]}
            value={span("chance")}
            onChange={setSpan("chance")}
            format={(n) => `${n}%`}
          />
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5">
            <IconLevel size={15} />
            Nível pra farmar
          </FieldLabel>
          <Range
            label="Nível pra farmar"
            min={bounds.farmLevel[0]}
            max={bounds.farmLevel[1]}
            step={5}
            value={span("farmLevel")}
            onChange={setSpan("farmLevel")}
          />
          <NumberRange
            min={bounds.farmLevel[0]}
            max={bounds.farmLevel[1]}
            value={q.farmLevel}
            onChange={(farmLevel) => onChange({ farmLevel })}
          />
          <p className="mt-1 text-[12px] leading-snug text-text-mute">
            nível da fonte farmável mais baixa — some quem não se caça
          </p>
        </div>

        <div>
          <FieldLabel className="mb-1 flex items-center gap-1.5">
            <IconLoot size={15} />
            Quantas espécies dropam
          </FieldLabel>
          <Range
            label="Quantas fontes"
            min={bounds.sources[0]}
            max={bounds.sources[1]}
            value={span("sources")}
            onChange={setSpan("sources")}
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Quem dropa" active={quem}>
        {/* O indice reverso ao contrario. A dex responde "quem dropa Bulb?";
            aqui a pergunta e "o que sai do Bulbasaur?" — util pra decidir se
            vale caçar um bicho pelo loot, e igualmente ausente do jogo. */}
        <div>
          <FieldLabel className="mb-1">Itens que esta espécie dropa</FieldLabel>
          <Combobox
            value={q.droppedBy}
            onChange={(droppedBy) => onChange({ droppedBy })}
            options={dexIndex.map((d) => ({
              value: d.id,
              label: d.name,
              render: (
                <span className="flex items-center gap-2">
                  <Sprite src={spriteUrl(d.id)} alt={d.name} size={26} />
                  {d.name}
                </span>
              ),
            }))}
            placeholder="nome do pokémon..."
            emptyText="nenhuma espécie com esse nome"
          />
          {selecionado ? (
            <div className="mt-1.5">
              <Chip tone="accent" onRemove={() => onChange({ droppedBy: null })}>
                {selecionado.name}
              </Chip>
            </div>
          ) : null}
        </div>
      </FilterGroup>
    </div>
  );
}
