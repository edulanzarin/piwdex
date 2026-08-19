"use client";

// Pokemons capturados: o ACERVO persistente dos bichos que o robo manteve (nao vendeu, por
// estarem acima das travas). Filtra igual ao mercado (especie, tipo, raridade, IV, qualidade,
// shiny), pagina, e cada card abre um modal com os stats. Nunca limpa sozinho — so no botao.
// Tempo real sem poll: refetch quando o total do acervo muda no stream SSE (captura nova).

import { useCallback, useEffect, useRef, useState } from "react";
import { Sprite } from "./sprite";
import { Modal } from "./modal";
import { Pagination } from "./pagination";
import { CloseButton } from "./icon-button";
import { SelectMenu } from "./select-menu";
import { TypeFilter } from "./type-filter";
import { Field, ShinyToggle } from "./filter-field";
import { PokemonCombobox, type ComboCreature } from "./pokemon-combobox";
import { TypeBadges, QualityBadge } from "./badges";
import { Panel } from "./ui/panel";
import { EmptyState } from "./ui/feed";
import { Star, Gear, Backpack } from "./icons";
import { spriteUrl } from "@/lib/sprites";
import { RARITY_ORDER } from "@/lib/typing";
import { useT, useRarityLabel } from "./locale-provider";
import { useVipLive } from "./vip-live";
import type { PokeType, Rarity } from "@/lib/types";

interface Row {
  pokeId: string; speciesId: number; name: string; level: number; shiny: boolean;
  ivTotal: number; quality: number; rarity: Rarity; type1: PokeType; type2: PokeType | null; seenEm: string;
}
interface Page { rows: Row[]; total: number; page: number; pageCount: number }

const whenDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

export function PokeCaught({ creatures }: { creatures: ComboCreature[] }) {
  const t = useT();
  // total do acervo vindo do stream — quando muda (captura nova/limpeza), refaz a busca
  const acervoTotal = useVipLive().totals?.acervo.total;
  const [species, setSpecies] = useState<ComboCreature | null>(null);
  const [type, setType] = useState<PokeType | "">("");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [ivMin, setIvMin] = useState("");
  const [qMin, setQMin] = useState("");
  const [shiny, setShiny] = useState(false);
  const [sort, setSort] = useState<"recent" | "iv" | "quality">("recent");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [sel, setSel] = useState<Row | null>(null);
  const [clearing, setClearing] = useState(false);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (species) p.set("species", String(species.pokeId));
    if (type) p.set("type", type);
    if (rarity) p.set("rarity", rarity);
    if (ivMin) p.set("ivMin", ivMin);
    if (qMin) p.set("qMin", qMin);
    if (shiny) p.set("shiny", "1");
    p.set("sort", sort);
    p.set("page", String(page));
    return p.toString();
  }, [species, type, rarity, ivMin, qMin, shiny, sort, page]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/vip/captured?${qs()}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as Page | null;
      if (j && "rows" in j) setData(j);
    } catch {}
  }, [qs]);

  // volta pra pagina 0 quando um filtro muda
  const firstRun = useRef(true);
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } setPage(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [species, type, rarity, ivMin, qMin, shiny, sort]);
  // busca ao mudar filtro/pagina; o stream nao carrega a lista filtrada, entao o refetch
  // e disparado pela mudanca do total do acervo (sem poll cego)
  useEffect(() => { load(); }, [load, acervoTotal]);

  const clear = async () => {
    if (clearing) return;
    setClearing(true);
    try { await fetch("/api/vip/captured", { method: "DELETE" }); setData(null); await load(); }
    finally { setClearing(false); }
  };

  const rarLabel = useRarityLabel();
  const rarityOpts = [{ value: "", label: t("robo.caught.allRarities") }, ...RARITY_ORDER.map((r) => ({ value: r, label: rarLabel(r) }))];
  const sortOpts = [
    { value: "recent", label: t("robo.caught.sort.recent") },
    { value: "iv", label: t("robo.caught.sort.iv") },
    { value: "quality", label: t("robo.caught.sort.quality") },
  ];
  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="section-title flex items-center gap-2 text-green"><Star size={18} /> {t("robo.caught.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-dim">{t("robo.caught.desc")}</p>
      </div>

      {/* filtros — Panel expansivel (recolhe quando nao esta filtrando) */}
      <Panel collapsible icon={<Gear size={18} />} accent="var(--cyan)" title={t("robo.caught.filters")} className="p-4 sm:p-5" bodyClassName="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.species")}</span>
          <PokemonCombobox creatures={creatures} value={species} onSelect={(c) => { setSpecies(c); if (c) setType(""); }} />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.type")}</span>
          <TypeFilter value={type} onChange={(tp) => { setType(tp); if (tp) setSpecies(null); }} className="" />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.rarity")}</span>
          <SelectMenu value={rarity} onChange={(v) => setRarity(v as Rarity | "")} options={rarityOpts} className="" />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.sort")}</span>
          <SelectMenu value={sort} onChange={(v) => setSort(v as typeof sort)} options={sortOpts} className="" />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.ivMin")}</span>
          <input type="number" min={0} max={192} value={ivMin} onChange={(e) => setIvMin(e.target.value)} placeholder="—" className="input" />
        </label>
        <label className="flex flex-col gap-1"><span className="field-label">{t("robo.caught.f.qMin")}</span>
          <input type="number" min={0} step={0.05} value={qMin} onChange={(e) => setQMin(e.target.value)} placeholder="—" className="input" />
        </label>
        <Field label={t("robo.caught.f.shiny")}>
          <ShinyToggle active={shiny} onChange={setShiny} />
        </Field>
      </Panel>

      {/* grade — contagem no cabecalho, limpar a direita */}
      <Panel
        icon={<Backpack size={18} />} accent="var(--green)"
        title={t("robo.caught.count").replace("{n}", String(data?.total ?? 0))}
        // botao sempre no slot: invisible reserva o espaco (cabecalho de altura estavel)
        right={<button type="button" onClick={clear} disabled={clearing} className={`btn btn-ghost btn-sm disabled:opacity-40 ${(data?.total ?? 0) > 0 ? "" : "invisible"}`}>{t("robo.caught.clear")}</button>}
      >
        {rows.length === 0 ? (
          // vazio com a altura de uma linha de cards: a grade chegando nao pula o painel
          <EmptyState className="min-h-40 justify-center" message={t("robo.caught.empty")} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((p) => (
                <button key={p.pokeId} type="button" onClick={() => setSel(p)} className="card card-link flex flex-col items-center gap-1.5 p-3 text-center">
                  <div className="relative">
                    <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt={p.name} size={56} />
                    {/* estrela shiny sempre no slot: invisible reserva o canto */}
                    <span className={`absolute -right-1 -top-1 text-yellow ${p.shiny ? "" : "invisible"}`}><Star size={14} /></span>
                  </div>
                  {/* linhas truncadas (nunca quebram): todo card da grade tem a mesma altura.
                      Em 2 colunas de celular o corte e certo — o valor cheio fica no title. */}
                  <span className="w-full truncate pixel text-base" title={p.name}>{p.name}</span>
                  <span className="w-full truncate text-xs text-text-dim" title={`Lv${p.level} · IV ${p.ivTotal} · Q ${p.quality.toFixed(2)}`}>Lv{p.level} · IV {p.ivTotal} · Q {p.quality.toFixed(2)}</span>
                  <QualityBadge quality={p.quality} />
                </button>
              ))}
            </div>
            {data && data.pageCount > 1 && <Pagination page={data.page} pageCount={data.pageCount} onPage={setPage} />}
          </div>
        )}
      </Panel>

      {sel && (
        <Modal onClose={() => setSel(null)} className="w-full max-w-sm p-4 sm:p-5" labelledBy="caught-name">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 id="caught-name" className="section-title truncate" title={sel.name}>{sel.name}</h3>
            <CloseButton onClick={() => setSel(null)} />
          </div>
          {/* em 360px os dois tipos com rotulo nao cabem ao lado do sprite (o par mais
              largo passa de 220px): abaixo de sm o bloco desce pra linha propria e usa
              a largura inteira do modal, em vez de espremer ou vazar */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative shrink-0">
              <Sprite src={spriteUrl(sel.speciesId, sel.shiny)} alt={sel.name} size={72} />
              {sel.shiny && <span className="absolute -right-1 -top-1 text-yellow"><Star size={14} /></span>}
            </div>
            <div className="flex flex-col items-start gap-2">
              <TypeBadges t1={sel.type1} t2={sel.type2} />
              <QualityBadge quality={sel.quality} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="well"><div className="field-label">{t("robo.caught.f.ivMin")}</div><div className="pixel text-lg tabular-nums">{sel.ivTotal} / 192</div></div>
            <div className="well"><div className="field-label">Quality</div><div className="pixel text-lg tabular-nums">{sel.quality.toFixed(2)}</div></div>
            <div className="well"><div className="field-label">Level</div><div className="pixel text-lg tabular-nums">{sel.level}</div></div>
            <div className="well"><div className="field-label">{t("robo.caught.capturedAt")}</div><div className="pixel text-base tabular-nums">{whenDay(sel.seenEm)}</div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
