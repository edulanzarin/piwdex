"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const SORT_OPTIONS: SelectOption<SortKey>[] = (
  [
    "dex", "name", "level", "value", "xp", "xpPerLevel",
    "statTotal", "power", "spots",
    "hp", "atk", "def", "spAtk", "spDef", "speed",
  ] as SortKey[]
).map((k) => ({ value: k, label: SORT_LABEL[k] }));

/** Colunas da tabela, com a chave de ordenacao de cada uma. */
const COLUMNS: { key: SortKey | null; label: string; align?: "right" }[] = [
  { key: "name", label: "Pokemon" },
  { key: null, label: "Tipo" },
  { key: null, label: "Raridade" },
  { key: "level", label: "Nv", align: "right" },
  { key: "hp", label: "HP", align: "right" },
  { key: "atk", label: "ATK", align: "right" },
  { key: "def", label: "DEF", align: "right" },
  { key: "spAtk", label: "SPA", align: "right" },
  { key: "spDef", label: "SPD", align: "right" },
  { key: "speed", label: "VEL", align: "right" },
  { key: "statTotal", label: "Total", align: "right" },
  { key: "power", label: "Golpe", align: "right" },
  { key: "value", label: "Valor", align: "right" },
  { key: "xp", label: "XP", align: "right" },
  { key: "spots", label: "Spots", align: "right" },
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

  // Contagens de faceta saem do universo VISIVEL (respeitando so a chave de
  // variantes), nao do resultado ja filtrado — senao marcar "Fogo" zera a
  // contagem de todos os outros tipos e o menu vira um beco sem saida.
  const universe = useMemo(
    () => (state.query.includeVariants ? entries : entries.filter((e) => !e.variant)),
    [entries, state.query.includeVariants],
  );
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
    <div className="grid gap-3 lg:grid-cols-[268px_minmax(0,1fr)]">
      {/* Trilho fixo no desktop: rola junto ate grudar, e o corpo dele tem
          rolagem propria pra os 15 filtros nunca ultrapassarem a janela. */}
      <aside className="hidden lg:block">
        <div className="panel sticky top-15 max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain">
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
              title="Nenhum pokemon bate com esses filtros"
              hint={
                active
                  ? `${active} filtro${active > 1 ? "s" : ""} ligado${active > 1 ? "s" : ""}. Solte um deles pra a lista voltar.`
                  : "O catalogo veio vazio — a fonte do jogo pode estar fora do ar."
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {shown.map((e, i) => (
              <PokeCard key={e.id} e={e} ceiling={bounds.statCeiling} priority={i < 10} />
            ))}
          </div>
        ) : (
          <Panel bodyClassName="p-0">
            <div className="max-h-[calc(100dvh-11rem)] overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
                  <tr className="border-b border-line-strong">
                    {COLUMNS.map((col) => {
                      const on = col.key && state.sort === col.key;
                      return (
                        <th
                          key={col.label}
                          scope="col"
                          className={cn(
                            "px-2 py-1.5 whitespace-nowrap",
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
                                "pix inline-flex items-center gap-1 text-[10px] transition-colors",
                                on ? "text-accent" : "text-text-mute hover:text-text-dim",
                              )}
                            >
                              {col.label}
                              {on ? (
                                <span className="text-[7px]">{state.dir === "asc" ? "▲" : "▼"}</span>
                              ) : null}
                            </button>
                          ) : (
                            <span className="pix text-[10px] text-text-mute">{col.label}</span>
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
            <span className="text-[12px] text-text-mute tabular">
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
              aria-label="Itens por pagina"
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
    <div className="panel flex flex-wrap items-center gap-2 p-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenFilters}
        active={active > 0}
        iconLeft={<IconFilter size={10} />}
        className="lg:hidden"
      >
        filtros{active ? ` (${active})` : ""}
      </Button>

      <span className="flex items-baseline gap-1.5">
        <span className="text-[16px] font-semibold text-text tabular">{count}</span>
        <span className="pix text-[10px] text-text-mute">
          {count === total ? "especies" : `de ${total}`}
        </span>
      </span>

      {/* Frescor do catalogo e ESTADO, nao rodape: a dex ao vivo e a dex de
          snapshot dao respostas diferentes num patch de balanceamento. */}
      <Chip
        size="xs"
        tone={catalog.live ? "ok" : "warn"}
        title={
          catalog.live
            ? `Catalogo do jogo, publicado em ${catalog.generatedAt}`
            : `Fonte indisponivel (${catalog.error ?? "motivo desconhecido"}) — mostrando o ultimo catalogo salvo`
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
          className="w-52"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleDir}
          iconLeft={<IconSort size={10} />}
          title={state.dir === "asc" ? "Crescente" : "Decrescente"}
        >
          {state.dir === "asc" ? "cresc" : "desc"}
        </Button>
        <Segmented
          aria-label="Modo de visualizacao"
          size="sm"
          value={state.view}
          onChange={onView}
          options={[
            { value: "grid", label: <IconGrid size={10} />, title: "Grade — reconhecer pela silhueta" },
            { value: "table", label: <IconRows size={10} />, title: "Tabela — comparar numero a numero" },
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
      <Chip key={`t${t}`} tint={TYPE_COLOR[t]} onRemove={() => onChange({ types: q.types.filter((x) => x !== t) })}>
        {t}
      </Chip>,
    );

  for (const r of q.rarities)
    chips.push(
      <Chip key={`r${r}`} tint={RARITY_COLOR[r]} onRemove={() => onChange({ rarities: q.rarities.filter((x) => x !== r) })}>
        {r}
      </Chip>,
    );

  for (const t of q.weakTo)
    chips.push(
      <Chip key={`w${t}`} tone="danger" onRemove={() => onChange({ weakTo: q.weakTo.filter((x) => x !== t) })}>
        fraco a {t}
      </Chip>,
    );

  for (const t of q.resistTo)
    chips.push(
      <Chip key={`rs${t}`} tone="ok" onRemove={() => onChange({ resistTo: q.resistTo.filter((x) => x !== t) })}>
        resiste {t}
      </Chip>,
    );

  const ranges: [string, keyof DexQuery, string][] = [
    ["nivel", "level", "nv"],
    ["valor", "value", "$"],
    ["xp", "xp", "xp"],
    ["stats", "statTotal", "st"],
    ["golpe", "power", "gp"],
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
      <Chip key="d" tone="accent" onRemove={() => onChange({ drops: null })}>
        dropa {q.drops}
      </Chip>,
    );
  if (q.onlyTm)
    chips.push(<Chip key="tm" tone="neon" onRemove={() => onChange({ onlyTm: false })}>com TM</Chip>);
  if (q.onlySpots)
    chips.push(<Chip key="sp" tone="ok" onRemove={() => onChange({ onlySpots: false })}>com spot</Chip>);
  if (q.includeVariants)
    chips.push(<Chip key="v" tone="warn" onRemove={() => onChange({ includeVariants: false })}>+ variantes</Chip>);

  for (const a of q.acquisitions)
    chips.push(<Chip key={`a${a}`} onRemove={() => onChange({ acquisitions: q.acquisitions.filter((x) => x !== a) })}>{a}</Chip>);
  for (const s of q.stages)
    chips.push(<Chip key={`s${s}`} onRemove={() => onChange({ stages: q.stages.filter((x) => x !== s) })}>{s}</Chip>);
  for (const g of q.regions)
    chips.push(<Chip key={`g${g}`} onRemove={() => onChange({ regions: q.regions.filter((x) => x !== g) })}>{g}</Chip>);

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
