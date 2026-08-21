"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { DexBounds, DexEntry, DexQuery, SortKey } from "@/lib/dex";
import {
  EMPTY_QUERY,
  SORT_LABEL,
  activeCount as countActive,
  countBy,
  countByType,
  matches,
  sortEntries,
} from "@/lib/dex";
import { buildSearch, parseState, type DexState } from "@/lib/dex-url";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import {
  Button,
  Chip,
  Empty,
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
import { DexFilters } from "@/components/dex-filters";
import { PokeCard, PokeRow } from "@/components/poke-card";
import { IconGem, IconScale, IconTarget, IconTm, IconXp, IconBag, IconLevel, STAT_ICONS } from "@/components/game-icons";
import { ACQ_LABEL, RARITY_LABEL, REGION_LABEL, STAGE_LABEL, TYPE_LABEL } from "@/lib/labels";
import { TypeIcon } from "@/components/type-icon";

/**
 * A Pokedex.
 *
 * O estado vive na URL. Nao e purismo: sem isso o F5 perde 8 filtros ajustados
 * a mao, "voltar" sai da pagina em vez de desfazer o ultimo filtro, e mandar
 * uma busca pra alguem vira print em vez de link. A escrita e `replace` com
 * atraso — `push` a cada tecla digitada entulharia o historico com 30 entradas
 * pra uma palavra.
 */

const PAGE_SIZES = [24, 60, 120] as const;

/** Cabecalho curto das seis colunas de stat. */
const STAT_SHORT_COL = ["Vida", "Atq", "Def", "AtqE", "DefE", "Vel"] as const;

const SORT_OPTIONS: SelectOption<SortKey>[] = (
  [
    "dex", "name", "level", "value", "xp", "xpPerLevel",
    "statTotal", "power", "spots",
    "hp", "atk", "def", "spAtk", "spDef", "speed",
  ] as SortKey[]
).map((k) => ({ value: k, label: SORT_LABEL[k] }));

/** Colunas da tabela, com a chave de ordenacao de cada uma. */
type Col = { key: SortKey | null; label: string; align?: "right"; icon?: React.ReactNode };

const COLUMNS: Col[] = [
  { key: "name", label: "Pokémon" },
  { key: null, label: "Tipo" },
  { key: null, label: "Raridade", icon: <IconGem size={14} /> },
  { key: "level", label: "Nível", align: "right", icon: <IconLevel size={14} /> },
  // as seis colunas de stat vao so com icone: o nome inteiro nao cabe e a
  // abreviacao ("AES") nao diz nada — o `title` guarda o nome por extenso
  ...(["hp", "atk", "def", "spAtk", "spDef", "speed"] as SortKey[]).map((k, i) => ({
    key: k,
    label: STAT_SHORT_COL[i],
    align: "right" as const,
    icon: React.createElement(STAT_ICONS[i], { size: 8 }),
  })),
  { key: "statTotal", label: "Total", align: "right", icon: <IconScale size={14} /> },
  { key: "power", label: "Golpe", align: "right", icon: <IconTarget size={14} /> },
  { key: "value", label: "Valor", align: "right" },
  { key: "xp", label: "XP", align: "right", icon: <IconXp size={14} /> },
  { key: "spots", label: "Locais", align: "right" },
];

export function DexBrowser({
  entries,
  bounds,
  lootIndex,
  catalog,
}: {
  entries: DexEntry[];
  bounds: DexBounds;
  lootIndex: string[];
  catalog: { live: boolean; generatedAt: string; error: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // A URL semeia o estado no primeiro render; dali em diante o React manda e a
  // URL acompanha. O caminho inverso (URL -> estado a cada mudanca) faria cada
  // tecla digitada esperar um round-trip do roteador.
  const [state, setState] = useState<DexState>(() => parseState(new URLSearchParams(sp.toString())));
  const [drawer, setDrawer] = useState(false);
  const [pageSize, setPageSize] = useState<number>(60);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(`${pathname}${buildSearch(state)}`, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [state, router, pathname]);

  const patch = useCallback((p: Partial<DexQuery>) => {
    // Mexeu no filtro, volta pra pagina 1 — senao o filtro devolve 12 itens e a
    // tela continua na pagina 4, mostrando vazio.
    setState((s) => ({ ...s, query: { ...s.query, ...p }, page: 0 }));
  }, []);

  const clear = useCallback(() => setState((s) => ({ ...s, query: EMPTY_QUERY, page: 0 })), []);

  const filtered = useMemo(
    () => entries.filter((e) => matches(e, state.query)),
    [entries, state.query],
  );

  const sorted = useMemo(
    () => sortEntries(filtered, state.sort, state.dir, state.query.movePool),
    [filtered, state.sort, state.dir, state.query.movePool],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(state.page, pageCount - 1);
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize);

  // Contagens de faceta saem do universo INTEIRO, nao do resultado ja filtrado
  // — senao marcar "Fogo" zera a contagem de todos os outros tipos e o menu
  // vira um beco sem saida.
  const universe = entries;
  const typeCounts = useMemo(() => countByType(universe), [universe]);
  const rarityCounts = useMemo(() => countBy(universe, (e) => e.rarity), [universe]);

  const active = countActive(state.query);
  const setSort = (sort: SortKey) => setState((s) => ({ ...s, sort, page: 0 }));
  const toggleDir = () =>
    setState((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc", page: 0 }));

  const filters = (
    <DexFilters
      q={state.query}
      onChange={patch}
      bounds={bounds}
      typeCounts={typeCounts}
      rarityCounts={rarityCounts}
      lootIndex={lootIndex}
      onClear={clear}
      activeCount={active}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
      {/* Trilho fixo no desktop: rola junto ate grudar, e o corpo dele tem
          rolagem propria pra os 15 filtros nunca ultrapassarem a janela. */}
      <aside className="hidden lg:block">
        <div className="panel sticky top-[4.75rem] max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
          {filters}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <DexToolbar
          total={universe.length}
          count={sorted.length}
          active={active}
          state={state}
          onSort={setSort}
          onToggleDir={toggleDir}
          onView={(view) => setState((s) => ({ ...s, view }))}
          onOpenFilters={() => setDrawer(true)}
          catalog={catalog}
        />

        <ActiveChips q={state.query} onChange={patch} onClear={clear} />

        {sorted.length === 0 ? (
          <Panel>
            <Empty
              title="Nenhum pokémon bate com esses filtros"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shown.map((e, i) => (
              <PokeCard
                key={e.id}
                e={e}
                ceiling={bounds.statCeiling}
                priority={i < 10}
                index={i}
              />
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
                          className={cn(
                            "px-3 py-2.5 whitespace-nowrap",
                            col.align === "right" && "text-right",
                          )}
                        >
                          {col.key ? (
                            <button
                              type="button"
                              onClick={() =>
                                on ? toggleDir() : setSort(col.key as SortKey)
                              }
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
                    <PokeRow key={e.id} e={e} />
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

      {/* No celular o trilho vira gaveta — a MESMA arvore de filtros, sem
          segunda implementacao que sai do ar com a do desktop. */}
      <Modal
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filtros"
        eyebrow="Pokedex"
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

/** Barra de controle: quantos deu, como ordenar, como ver. */
function DexToolbar({
  total,
  count,
  active,
  state,
  onSort,
  onToggleDir,
  onView,
  onOpenFilters,
  catalog,
}: {
  total: number;
  count: number;
  active: number;
  state: DexState;
  onSort: (k: SortKey) => void;
  onToggleDir: () => void;
  onView: (v: DexState["view"]) => void;
  onOpenFilters: () => void;
  catalog: { live: boolean; generatedAt: string; error: string | null };
}) {
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFilters}
        active={active > 0}
        iconLeft={<IconFilter size={16} />}
        className="lg:hidden"
      >
        filtros{active ? ` (${active})` : ""}
      </Button>

      <span className="flex items-baseline gap-1.5">
        <span className="text-[17px] font-semibold text-text tabular">{count}</span>
        <span className="pix text-[11px] text-text-mute">
          {count === total ? "espécies" : `de ${total}`}
        </span>
      </span>

      {/* Frescor do catalogo e ESTADO, nao rodape: a dex ao vivo e a dex de
          snapshot dao respostas diferentes num patch de balanceamento. */}
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
          onChange={onSort}
          options={SORT_OPTIONS}
          className="w-60"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleDir}
          iconLeft={<IconSort size={16} />}
          title={state.dir === "asc" ? "Crescente" : "Decrescente"}
        >
          {state.dir === "asc" ? "cresc" : "desc"}
        </Button>
        <Segmented
          aria-label="Modo de visualização"
          size="sm"
          value={state.view}
          onChange={onView}
          options={[
            { value: "grid", label: <IconGrid size={16} />, title: "Grade — reconhecer pela silhueta" },
            { value: "table", label: <IconRows size={16} />, title: "Tabela — comparar número a número" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * Os filtros ligados, por extenso e removiveis um a um.
 *
 * Sem isso, um filtro esquecido dentro de um grupo fechado faz a lista parecer
 * quebrada — e no celular, onde o trilho e gaveta, ele fica literalmente
 * invisivel. Aqui todo filtro ativo tem rosto e um X.
 */
function ActiveChips({
  q,
  onChange,
  onClear,
}: {
  q: DexQuery;
  onChange: (p: Partial<DexQuery>) => void;
  onClear: () => void;
}) {
  const chips: React.ReactNode[] = [];

  if (q.q.trim())
    chips.push(
      <Chip key="q" tone="accent" onRemove={() => onChange({ q: "" })}>
        &quot;{q.q.trim()}&quot;
      </Chip>,
    );

  for (const t of q.types)
    chips.push(
      <Chip
        key={`t${t}`}
        tint={TYPE_COLOR[t]}
        icon={<TypeIcon type={t} size={14} />}
        onRemove={() => onChange({ types: q.types.filter((x) => x !== t) })}
      >
        {TYPE_LABEL[t]}
      </Chip>,
    );

  for (const r of q.rarities)
    chips.push(
      <Chip
        key={`r${r}`}
        tint={RARITY_COLOR[r]}
        icon={<IconGem size={14} />}
        onRemove={() => onChange({ rarities: q.rarities.filter((x) => x !== r) })}
      >
        {RARITY_LABEL[r]}
      </Chip>,
    );

  for (const t of q.weakTo)
    chips.push(
      <Chip key={`w${t}`} tone="danger" onRemove={() => onChange({ weakTo: q.weakTo.filter((x) => x !== t) })}>
        fraco a {TYPE_LABEL[t]}
      </Chip>,
    );

  for (const t of q.resistTo)
    chips.push(
      <Chip key={`rs${t}`} tone="ok" onRemove={() => onChange({ resistTo: q.resistTo.filter((x) => x !== t) })}>
        resiste a {TYPE_LABEL[t]}
      </Chip>,
    );

  const ranges: [string, keyof DexQuery, string][] = [
    ["nivel", "level", "nível"],
    ["valor", "value", "valor"],
    ["xp", "xp", "xp"],
    ["stats", "statTotal", "stats"],
    ["golpe", "power", "golpe"],
  ];
  for (const [, key, short] of ranges) {
    const r = q[key] as [number | null, number | null];
    if (r[0] == null && r[1] == null) continue;
    chips.push(
      <Chip key={String(key)} tone="neon" onRemove={() => onChange({ [key]: [null, null] } as Partial<DexQuery>)}>
        {short} {r[0] ?? "*"}–{r[1] ?? "*"}
      </Chip>,
    );
  }

  if (q.drops)
    chips.push(
      <Chip key="d" tone="accent" icon={<IconBag size={14} />} onRemove={() => onChange({ drops: null })}>
        dropa {q.drops}
      </Chip>,
    );
  if (q.onlyTm)
    chips.push(<Chip key="tm" tone="neon" icon={<IconTm size={14} />} onRemove={() => onChange({ onlyTm: false })}>com TM</Chip>);
  if (q.onlySpots)
    chips.push(<Chip key="sp" tone="ok" onRemove={() => onChange({ onlySpots: false })}>com local de caça</Chip>);

  for (const a of q.acquisitions)
    chips.push(<Chip key={`a${a}`} onRemove={() => onChange({ acquisitions: q.acquisitions.filter((x) => x !== a) })}>{ACQ_LABEL[a]}</Chip>);
  for (const s of q.stages)
    chips.push(<Chip key={`s${s}`} onRemove={() => onChange({ stages: q.stages.filter((x) => x !== s) })}>{STAGE_LABEL[s]}</Chip>);
  for (const g of q.regions)
    chips.push(<Chip key={`g${g}`} onRemove={() => onChange({ regions: q.regions.filter((x) => x !== g) })}>{REGION_LABEL[g]}</Chip>);

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
