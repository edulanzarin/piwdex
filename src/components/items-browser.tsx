"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { ItemBounds, ItemEntry, ItemQuery, ItemSortKey } from "@/lib/items";
import {
  EMPTY_ITEM_QUERY,
  ITEM_SORT_LABEL,
  activeCount as countActive,
  countBy,
  matches,
  sortEntries,
} from "@/lib/items";
import type { DexBrief } from "@/lib/items-data";
import { buildItemsSearch, parseItemsState, type ItemsState } from "@/lib/items-url";
import {
  Button,
  Chip,
  Empty,
  IconCoin,
  IconFilter,
  IconGrid,
  IconRows,
  IconSort,
  Modal,
  Pagination,
  Panel,
  Segmented,
  Select,
  type SelectOption,
} from "@/components/ui";
import { ItemsFilters } from "@/components/items-filters";
import { ItemCard, ItemRow } from "@/components/item-card";
import {
  IconChance,
  IconGem,
  IconLevel,
  IconLoot,
  ItemCategoryIcon,
} from "@/components/game-icons";
import { ITEM_CATEGORY_LABEL, ITEM_ORIGIN_LABEL, compact } from "@/lib/labels";

/**
 * A tela de Itens.
 *
 * Mesmo contrato da Pokedex — estado na URL, trilho fixo no desktop e gaveta no
 * celular com a MESMA arvore de filtros, grid pra reconhecer e tabela pra
 * comparar. O que muda e a pergunta: aqui a coluna que decide e "de onde vem",
 * nao "quanto ele bate".
 */

const PAGE_SIZES = [24, 60, 120] as const;

const SORT_OPTIONS: SelectOption<ItemSortKey>[] = (
  [
    "name", "category", "price", "gold",
    "sources", "chance", "farmLevel", "goldPerKill", "id",
  ] as ItemSortKey[]
).map((k) => ({ value: k, label: ITEM_SORT_LABEL[k] }));

type Col = {
  key: ItemSortKey | null;
  label: string;
  align?: "right";
  icon?: React.ReactNode;
  /** o que a coluna mede, quando o rotulo curto nao basta */
  hint?: string;
};

const COLUMNS: Col[] = [
  { key: "name", label: "Item" },
  { key: "category", label: "Categoria" },
  { key: "price", label: "NPC", align: "right", icon: <IconCoin size={14} /> },
  { key: "gold", label: "Ouro", align: "right" },
  { key: "sources", label: "Fontes", align: "right", icon: <IconLoot size={14} /> },
  { key: "chance", label: "Chance", align: "right", icon: <IconChance size={14} /> },
  { key: null, label: "Melhor fonte" },
  {
    key: "farmLevel",
    label: "Nível mín.",
    align: "right",
    icon: <IconLevel size={14} />,
    hint: "Nível da fonte farmável mais baixa — pode não ser a mesma espécie da coluna anterior",
  },
  { key: "goldPerKill", label: "Ouro/abate", align: "right" },
];

export function ItemsBrowser({
  entries,
  bounds,
  dexIndex,
  catalog,
}: {
  entries: ItemEntry[];
  bounds: ItemBounds;
  dexIndex: DexBrief[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [state, setState] = useState<ItemsState>(() =>
    parseItemsState(new URLSearchParams(sp.toString())),
  );
  const [drawer, setDrawer] = useState(false);
  const [pageSize, setPageSize] = useState<number>(60);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildItemsSearch(state)}`, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [state, router, pathname]);

  const patch = useCallback((p: Partial<ItemQuery>) => {
    setState((s) => ({ ...s, query: { ...s.query, ...p }, page: 0 }));
  }, []);

  const clear = useCallback(
    () => setState((s) => ({ ...s, query: EMPTY_ITEM_QUERY, page: 0 })),
    [],
  );

  const filtered = useMemo(
    () => entries.filter((e) => matches(e, state.query)),
    [entries, state.query],
  );

  const sorted = useMemo(
    () => sortEntries(filtered, state.sort, state.dir),
    [filtered, state.sort, state.dir],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(state.page, pageCount - 1);
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize);

  // Faceta sai do universo INTEIRO, nao do resultado filtrado: senao marcar
  // "Pedra" zera a contagem de todas as outras categorias e o menu vira beco
  // sem saida.
  const categoryCounts = useMemo(() => countBy(entries, (e) => e.category), [entries]);
  const originCounts = useMemo(() => countBy(entries, (e) => e.origin), [entries]);

  const active = countActive(state.query);
  const setSort = (sort: ItemSortKey) => setState((s) => ({ ...s, sort, page: 0 }));
  const toggleDir = () =>
    setState((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc", page: 0 }));

  const filters = (
    <ItemsFilters
      q={state.query}
      onChange={patch}
      bounds={bounds}
      categoryCounts={categoryCounts}
      originCounts={originCounts}
      dexIndex={dexIndex}
      onClear={clear}
      activeCount={active}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="panel sticky top-[4.75rem] max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
          {filters}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="panel flex flex-wrap items-center gap-3 p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDrawer(true)}
            active={active > 0}
            iconLeft={<IconFilter size={16} />}
            className="lg:hidden"
          >
            filtros{active ? ` (${active})` : ""}
          </Button>

          <span className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-semibold text-text tabular">{sorted.length}</span>
            <span className="pix text-[11px] text-text-mute">
              {sorted.length === entries.length ? "itens" : `de ${entries.length}`}
            </span>
          </span>

          <Chip
            size="xs"
            tone={catalog.live ? "ok" : "warn"}
            title={
              catalog.live
                ? `Catálogo do jogo, publicado em ${catalog.generatedAt}`
                : `Fonte indisponível (${catalog.error ?? "motivo desconhecido"}) — mostrando o último catálogo salvo`
            }
          >
            {catalog.live ? "AO VIVO" : "SNAPSHOT"}
          </Chip>

          <div className="ml-auto flex items-center gap-1.5">
            <Select
              aria-label="Ordenar por"
              prefix="ordem"
              value={state.sort}
              onChange={setSort}
              options={SORT_OPTIONS}
              className="w-60"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={toggleDir}
              iconLeft={<IconSort size={16} />}
              title={state.dir === "asc" ? "Crescente" : "Decrescente"}
            >
              {state.dir === "asc" ? "cresc" : "desc"}
            </Button>
            <Segmented
              aria-label="Modo de visualização"
              size="sm"
              value={state.view}
              onChange={(view) => setState((s) => ({ ...s, view }))}
              options={[
                { value: "grid", label: <IconGrid size={16} />, title: "Grade — reconhecer pelo ícone" },
                { value: "table", label: <IconRows size={16} />, title: "Tabela — comparar número a número" },
              ]}
            />
          </div>
        </div>

        <ActiveChips q={state.query} onChange={patch} onClear={clear} dexIndex={dexIndex} />

        {sorted.length === 0 ? (
          <Panel>
            <Empty
              title="Nenhum item bate com esses filtros"
              hint={
                active
                  ? `${active} filtro${active > 1 ? "s" : ""} ligado${active > 1 ? "s" : ""}. Solte um deles pra a lista voltar.`
                  : "O catálogo veio vazio — a fonte do jogo pode estar fora do ar."
              }
              action={
                active ? (
                  <Button variant="primary" onClick={clear}>
                    limpar filtros
                  </Button>
                ) : null
              }
            />
          </Panel>
        ) : state.view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {shown.map((e, i) => (
              <ItemCard key={e.id} e={e} index={i} priority={i < 10} />
            ))}
          </div>
        ) : (
          <Panel bodyClassName="p-0">
            <div className="max-h-[calc(100dvh-11rem)] overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface-2/92 backdrop-blur-xl">
                  <tr className="border-b border-line-strong">
                    {COLUMNS.map((col) => {
                      const on = col.key && state.sort === col.key;
                      return (
                        <th
                          key={col.label}
                          scope="col"
                          title={col.hint}
                          className={cn(
                            "px-3 py-2.5 whitespace-nowrap",
                            col.align === "right" && "text-right",
                          )}
                        >
                          {col.key ? (
                            <button
                              type="button"
                              onClick={() => (on ? toggleDir() : setSort(col.key as ItemSortKey))}
                              className={cn(
                                "pix inline-flex items-center gap-1 text-[11px] transition-colors",
                                on ? "text-accent" : "text-text-mute hover:text-text-dim",
                              )}
                            >
                              {col.icon}
                              {col.label}
                              {on ? (
                                <span className="text-[7px]">{state.dir === "asc" ? "▲" : "▼"}</span>
                              ) : null}
                            </button>
                          ) : (
                            <span className="pix inline-flex items-center gap-1 text-[11px] text-text-mute">
                              {col.icon}
                              {col.label}
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <ItemRow key={e.id} e={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {sorted.length > 0 ? (
          <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-between">
            <span className="text-[13px] text-text-mute tabular">
              {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} de {sorted.length}
            </span>
            <Pagination
              page={page}
              pageCount={pageCount}
              onChange={(p) => {
                setState((s) => ({ ...s, page: p }));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
            <Segmented
              aria-label="Itens por página"
              size="sm"
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v));
                setState((s) => ({ ...s, page: 0 }));
              }}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
        ) : null}
      </div>

      <Modal
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filtros"
        eyebrow="Itens"
        size="sm"
        bodyClassName="p-0"
        footer={
          <>
            <Button variant="ghost" onClick={clear} disabled={!active}>
              limpar
            </Button>
            <Button variant="primary" onClick={() => setDrawer(false)}>
              ver {sorted.length}
            </Button>
          </>
        }
      >
        {filters}
      </Modal>
    </div>
  );
}

/** Os filtros ligados, por extenso e removiveis um a um — filtro esquecido
 *  dentro de um grupo fechado faz a lista parecer quebrada. */
function ActiveChips({
  q,
  onChange,
  onClear,
  dexIndex,
}: {
  q: ItemQuery;
  onChange: (p: Partial<ItemQuery>) => void;
  onClear: () => void;
  dexIndex: DexBrief[];
}) {
  const chips: React.ReactNode[] = [];

  if (q.q.trim())
    chips.push(
      <Chip key="q" tone="accent" onRemove={() => onChange({ q: "" })}>
        &quot;{q.q.trim()}&quot;
      </Chip>,
    );

  for (const c of q.categories)
    chips.push(
      <Chip
        key={`c${c}`}
        icon={<ItemCategoryIcon category={c} size={14} />}
        onRemove={() => onChange({ categories: q.categories.filter((x) => x !== c) })}
      >
        {ITEM_CATEGORY_LABEL[c]}
      </Chip>,
    );

  for (const o of q.origins)
    chips.push(
      <Chip key={`o${o}`} onRemove={() => onChange({ origins: q.origins.filter((x) => x !== o) })}>
        {ITEM_ORIGIN_LABEL[o]}
      </Chip>,
    );

  if (q.onlyRare)
    chips.push(
      <Chip key="rare" tone="accent" icon={<IconGem size={14} />} onRemove={() => onChange({ onlyRare: false })}>
        só raros
      </Chip>,
    );
  if (q.onlyFarmable)
    chips.push(
      <Chip key="farm" tone="ok" onRemove={() => onChange({ onlyFarmable: false })}>
        dá pra farmar
      </Chip>,
    );

  const ranges: [keyof ItemQuery, string, (n: number) => string][] = [
    ["price", "npc", (n) => compact(n)],
    ["chance", "chance", (n) => `${n}%`],
    ["farmLevel", "nível", (n) => String(n)],
    ["sources", "fontes", (n) => String(n)],
  ];
  for (const [key, short, fmt] of ranges) {
    const r = q[key] as [number | null, number | null];
    if (r[0] == null && r[1] == null) continue;
    chips.push(
      <Chip
        key={String(key)}
        tone="neon"
        onRemove={() => onChange({ [key]: [null, null] } as Partial<ItemQuery>)}
      >
        {short} {r[0] != null ? fmt(r[0]) : "*"}–{r[1] != null ? fmt(r[1]) : "*"}
      </Chip>,
    );
  }

  if (q.droppedBy != null) {
    const nome = dexIndex.find((d) => d.id === q.droppedBy)?.name ?? `#${q.droppedBy}`;
    chips.push(
      <Chip key="by" tone="accent" onRemove={() => onChange({ droppedBy: null })}>
        dropado por {nome}
      </Chip>,
    );
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips}
      <Button size="sm" variant="ghost" onClick={onClear}>
        limpar tudo
      </Button>
    </div>
  );
}
