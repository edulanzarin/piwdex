import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getData } from "@/lib/data";
import { agora, fecharPiso } from "@/lib/pacing";
import {
  buildItemEntry,
  cardSpeciesName,
  killsPerUnit,
  nameKey,
  tmDiskType,
  type ItemEntry,
} from "@/lib/items";
import { assetIconUrl, spriteUrl } from "@/lib/sprites";
import { resumoDoItem } from "@/lib/prosa";
import { JsonLd, trilha } from "@/lib/jsonld";
import { TYPE_COLOR } from "@/lib/typing";
import type { Attack, Creature, PokeType } from "@/lib/types";
import {
  Chip,
  IconChevronRight,
  IconCoin,
  IconPin,
  Note,
  Panel,
  Sprite,
  Tooltip,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import {
  CategoryIcon,
  IconChance,
  IconGem,
  IconHeal,
  IconLevel,
  IconLoot,
  IconRevive,
  IconShop,
  IconTarget,
  IconTm,
  ItemCategoryIcon,
} from "@/components/game-icons";
import { pctText } from "@/components/item-card";
import {
  CATEGORY_LABEL,
  ITEM_CATEGORY_LABEL,
  ITEM_ORIGIN_LABEL,
  compact as gold,
} from "@/lib/labels";

// Dinamica de proposito — o frescor mora no source.ts. Ver src/app/page.tsx.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = await getData();
  const item = db.getItem(Number(id));
  if (!item) return { title: "Item não encontrado" };
  return {
    title: `${item.name} — onde farmar e quanto vale`,
    description: resumoDoItem(item, db).descricao,
    alternates: { canonical: `/itens/${item.id}` },
    openGraph: {
      type: "article",
      title: `${item.name} — Poke Idle World`,
      description: resumoDoItem(item, db).descricao,
      url: `/itens/${item.id}`,
    },
  };
}

/** Uma linha do indice reverso, ja com o que a tabela mostra. */
interface Fonte {
  creature: Creature;
  chancePct: number;
  minCount: number;
  maxCount: number;
  spots: number;
  /** abates, na media, pra sair uma unidade desta fonte */
  kills: number;
}

export default async function ItemPage({ params }: Props) {
  const t0 = agora();
  const { id } = await params;
  const db = await getData();
  const item = db.getItem(Number(id));
  if (!item) notFound();

  const e: ItemEntry = buildItemEntry(item, {
    sourcesOf: db.dropSourcesOf,
    spotsOf: (c) => db.locationsOf(c).length,
  });

  const resumo = resumoDoItem(item, db);
  const migalhas = trilha([
    { nome: "PIWdex", caminho: "/" },
    { nome: "Itens", caminho: "/itens" },
    { nome: item.name, caminho: `/itens/${item.id}` },
  ]);

  const fontes: Fonte[] = db.dropSourcesOf(item.name).map((s) => ({
    creature: s.creature,
    chancePct: s.chancePct,
    minCount: s.minCount,
    maxCount: s.maxCount,
    spots: db.locationsOf(s.creature).length,
    kills: killsPerUnit({
      id: s.creature.pokeId,
      name: s.creature.name,
      chancePct: s.chancePct,
      minCount: s.minCount,
      maxCount: s.maxCount,
      level: s.creature.huntLevel,
    }),
  }));

  // ---- onde farmar: os pontos de caca das fontes, agrupados por AREA ----
  // O jogador nao escolhe "o Pidgey de nivel 12", escolhe uma area do mapa.
  // Trinta linhas de spot repetindo a mesma area nao ajudam; a area com a faixa
  // de nivel e quem dropa la, sim.
  const areas = new Map<
    string,
    { area: string; min: number; max: number; especies: Set<string>; spots: number }
  >();
  for (const f of fontes) {
    if (f.spots === 0) continue;
    for (const h of db.locationsOf(f.creature)) {
      const cur = areas.get(h.area) ?? {
        area: h.area,
        min: h.level,
        max: h.level,
        especies: new Set<string>(),
        spots: 0,
      };
      cur.min = Math.min(cur.min, h.level);
      cur.max = Math.max(cur.max, h.level);
      cur.especies.add(f.creature.name);
      cur.spots += 1;
      areas.set(h.area, cur);
    }
  }
  const areaList = [...areas.values()].sort((a, b) => a.min - b.min);

  // ---- o item que aponta pra outra coisa do catalogo ----
  const cardName = cardSpeciesName(item.name);
  const cardSpecies = cardName
    ? db.creatures.find((c) => nameKey(c.name) === nameKey(cardName)) ?? null
    : null;

  const tmType = tmDiskType(item.name) as PokeType | null;
  let tmMove: Attack | null = null;
  let tmLearners = 0;
  if (tmType) {
    for (const c of db.creatures) {
      const hit = c.attacks.find((a) => a.tm === tmType);
      if (!hit) continue;
      tmLearners++;
      if (!tmMove || hit.power > tmMove.power) tmMove = hit;
    }
  }

  await fecharPiso(t0);

  const melhor = e.bestFarm ?? e.best;
  // O catalogo lista a fonte e declara a chance como ZERO — nao e "nao cai", e
  // "a fonte nao diz". Toda derivacao em cima disso (abates por unidade, ouro
  // por abate) seria chute com cara de numero.
  const semChancePublicada = e.sources > 0 && (e.best?.chancePct ?? 0) === 0;

  return (
    <div className="flex flex-col gap-4">
      <JsonLd dado={migalhas} />
      <nav className="flex items-center gap-1.5 text-[13px] text-text-mute">
        <Link href="/itens" className="transition-colors hover:text-[var(--color-t-itens)]">
          Itens
        </Link>
        <IconChevronRight size={14} />
        <span className="text-text-dim">{item.name}</span>
      </nav>

      {/* ---- identidade ---- */}
      <header className="panel scanline relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative grid shrink-0 place-items-center self-center">
          <span
            aria-hidden="true"
            className="anim-glow absolute h-24 w-24 rounded-full bg-[var(--color-t-itens)] blur-2xl"
          />
          <Sprite
            src={assetIconUrl(item.icon)}
            alt={item.name}
            size={112}
            priority
            fallback={<ItemCategoryIcon category={e.category} size={44} />}
            className="anim-float relative"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="pix text-[12px] text-text-mute">
            id {item.id} · {ITEM_ORIGIN_LABEL[e.origin]}
          </span>
          <h1 className="text-[24px] leading-none font-semibold text-text">{item.name}</h1>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip icon={<ItemCategoryIcon category={e.category} size={14} />}>
              {ITEM_CATEGORY_LABEL[e.category]}
            </Chip>
            {item.rare ? (
              <Chip tone="accent" icon={<IconGem size={14} />}>
                raro
              </Chip>
            ) : null}
            {e.farmSources > 0 ? (
              <Chip tone="ok" icon={<IconPin size={14} />}>
                dá pra farmar
              </Chip>
            ) : e.sources > 0 ? (
              <Chip tone="warn">só de espécie sem ponto no mapa</Chip>
            ) : null}
            {e.goldPrice > 0 ? (
              <Chip tone="neon" icon={<IconShop size={14} />}>
                {e.goldPrice} de ouro na loja
              </Chip>
            ) : null}
          </div>

          {/* A prosa derivada vem primeiro (de onde cai, quantos abates por
              unidade, quanto paga); a descricao do jogo, quando existe, fica
              depois — ela e sabor, nao resposta. Ver `lib/prosa.ts`. */}
          <p className="max-w-3xl text-[14px] leading-relaxed text-text-dim">
            {resumo.frases.join(" ")}
          </p>
          {item.description ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-text-mute italic">
              {item.description}
            </p>
          ) : null}

          <dl className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-pix border border-line bg-line sm:grid-cols-4">
            {[
              {
                label: "valor de npc",
                value: item.npcPrice > 0 ? gold(item.npcPrice) : "—",
                icon: <IconCoin size={15} />,
                tone: item.npcPrice > 0 ? "text-warn" : "text-text-mute",
              },
              {
                label: "quem dropa",
                value: e.sources || "—",
                icon: <IconLoot size={15} />,
                tone: "text-text",
              },
              {
                label: "melhor chance",
                value: melhor ? pctText(melhor.chancePct) : "—",
                icon: <IconChance size={15} />,
                tone: melhor ? "text-ok" : "text-text-mute",
              },
              // O quarto slot muda de GRANDEZA conforme o item: cura, revive ou
              // o nivel de farm. O rotulo muda junto — o mesmo rotulo pra tres
              // coisas diferentes e o que faz a ficha se contradizer.
              e.healAmount > 0
                ? { label: "cura", value: e.healAmount, icon: <IconHeal size={15} />, tone: "text-ok" }
                : e.revivePct > 0
                  ? {
                      label: "revive com",
                      value: `${Math.round(e.revivePct * 100)}%`,
                      icon: <IconRevive size={15} />,
                      tone: "text-ok",
                    }
                  : {
                      label: "farma a partir do nível",
                      value: e.minFarmLevel ?? "—",
                      icon: <IconLevel size={15} />,
                      tone: e.minFarmLevel != null ? "text-accent" : "text-text-mute",
                    },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-3 py-2">
                <dd
                  className={`flex items-center gap-1 text-[18px] leading-none font-semibold tabular ${s.tone}`}
                >
                  {s.icon}
                  {s.value}
                </dd>
                <dt className="pix mt-1 text-[11px] text-text-mute">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ---- o item que aponta pra outra coisa do catalogo ----
          Carta e disco de TM nao caem de ninguem: sem este painel a ficha deles
          seria uma tabela vazia, mesmo o nome carregando a resposta inteira. */}
      {cardSpecies ? (
        <Panel
          title={
            <span className="flex items-center gap-2">
              <IconGem size={16} />
              A carta é deste pokémon
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/dex/${cardSpecies.pokeId}`}
              className="flex items-center gap-3 border border-line p-2.5 transition-colors hover:border-accent/40 hover:bg-surface-2"
            >
              <Sprite src={spriteUrl(cardSpecies.pokeId)} alt={cardSpecies.name} size={56} />
              <span>
                <span className="block text-[15px] text-text">{cardSpecies.name}</span>
                <span className="pix text-[11px] text-text-mute">
                  #{String(cardSpecies.pokeId).padStart(3, "0")}
                </span>
              </span>
            </Link>
            <p className="max-w-md text-[14px] leading-relaxed text-text-mute">
              A carta cai do <strong className="text-text-dim">shiny</strong> desta espécie, que
              não vive no catálogo público — por isso a tabela de quem dropa vem vazia aqui.
              Sacrificar a carta no Altar invoca o shiny pra tentativa de captura.
            </p>
          </div>
        </Panel>
      ) : null}

      {tmType ? (
        <Panel
          title={
            <span className="flex items-center gap-2">
              <IconTm size={16} />
              A máquina ensina
            </span>
          }
          actions={
            tmLearners ? (
              <span className="text-[13px] text-text-mute tabular">
                {tmLearners} espécies aprendem
              </span>
            ) : null
          }
        >
          {tmMove ? (
            <div className="flex flex-wrap items-center gap-4">
              <span
                className="flex items-center gap-2 border p-2.5"
                style={{
                  borderColor: `${TYPE_COLOR[tmType]}70`,
                  backgroundColor: `${TYPE_COLOR[tmType]}14`,
                }}
              >
                <span className="text-[16px] font-semibold text-text">{tmMove.name}</span>
                <TypeBadge type={tmMove.type} size="xs" />
              </span>
              <span className="flex items-center gap-1.5 text-[14px] text-accent">
                <IconTarget size={15} />
                {tmMove.power} de poder
              </span>
              <span className="flex items-center gap-1.5 text-[14px] text-text-dim">
                <CategoryIcon category={tmMove.category} size={15} />
                {CATEGORY_LABEL[tmMove.category]}
              </span>
              <Link
                href="/dex?hastm=1"
                className="text-[14px] text-text-mute underline-offset-4 transition-colors hover:text-accent hover:underline"
              >
                ver quem aprende TM na dex
              </Link>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-text-mute">
              Nenhuma espécie do catálogo aprende um golpe desta máquina — ela existe no
              inventário, mas o golpe ainda não aparece em nenhum moveset publicado.
            </p>
          )}
        </Panel>
      ) : null}

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* ---- como farmar ---- */}
        <Panel
          className="h-full"
          title={
            <span className="flex items-center gap-2">
              <IconChance size={16} />
              Como farmar
            </span>
          }
        >
          {semChancePublicada ? (
            /* 346 linhas do catalogo — todas de Strange Pheromone — vem com
               `chance: 0`. Nao da pra derivar abate por unidade nem ouro por
               abate a partir disso, e inventar um numero aqui seria pior que
               nao ter: a tela diz o que a fonte diz e para. */
            <p className="text-[14px] leading-relaxed text-text-mute">
              As {e.sources} espécies que dropam este item vêm com{" "}
              <span className="text-text-dim">chance 0</span> no catálogo do jogo. Não dá pra
              dizer quantos abates custa uma unidade: o drop existe, mas o jogo resolve a
              chance dele por uma regra que o catálogo público não publica.
            </p>
          ) : e.bestFarm ? (
            <div className="flex flex-col gap-3">
              <Link
                href={`/dex/${e.bestFarm.id}`}
                className="flex items-center gap-3 border border-line bg-bg-soft p-2.5 transition-colors hover:border-accent/40 hover:bg-surface-2"
              >
                <Sprite src={spriteUrl(e.bestFarm.id)} alt={e.bestFarm.name} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="pix block text-[11px] text-text-mute">melhor fonte</span>
                  <span className="block truncate text-[16px] text-text">{e.bestFarm.name}</span>
                  <span className="text-[13px] text-text-mute">
                    nível {e.bestFarm.level || "—"} ·{" "}
                    {e.bestFarm.minCount === e.bestFarm.maxCount
                      ? `${e.bestFarm.minCount} por drop`
                      : `${e.bestFarm.minCount}–${e.bestFarm.maxCount} por drop`}
                  </span>
                </span>
                <span className="pix shrink-0 text-[16px] text-ok tabular">
                  {pctText(e.bestFarm.chancePct)}
                </span>
              </Link>

              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line">
                <div className="bg-surface px-3 py-2">
                  <dd className="text-[17px] leading-none font-semibold text-text tabular">
                    {Number.isFinite(killsPerUnit(e.bestFarm))
                      ? Math.max(1, Math.round(killsPerUnit(e.bestFarm))).toLocaleString("pt-BR")
                      : "—"}
                  </dd>
                  <dt className="pix mt-1 text-[11px] text-text-mute">abates por unidade</dt>
                </div>
                <div className="bg-surface px-3 py-2">
                  <dd className="text-[17px] leading-none font-semibold text-warn tabular">
                    {e.goldPerKill > 0 ? gold(Math.round(e.goldPerKill)) : "—"}
                  </dd>
                  <dt className="pix mt-1 text-[11px] text-text-mute">ouro por abate</dt>
                </div>
              </dl>

              {/* O numero acima e derivado, entao a ficha diz COMO ele sai — sem
                  isso ele vira um numero de autoridade que ninguem consegue
                  conferir contra o jogo. */}
              <Note flush icon={null}>
                Ouro por abate = chance × quantidade média × valor de NPC, nesta fonte. Não
                conta o que o abate paga por si.
              </Note>
            </div>
          ) : e.sources > 0 ? (
            <p className="text-[14px] leading-relaxed text-text-mute">
              Cai de {e.sources === 1 ? "uma espécie" : `${e.sources} espécies`}, mas nenhuma
              delas tem ponto de caça no mapa — só se chega nelas por evolução, loja ou evento.
              Na prática, este item não se farma: ele aparece quando o pokémon que o dropa
              aparece.
            </p>
          ) : (
            <p className="text-[14px] leading-relaxed text-text-mute">
              Nenhuma espécie do catálogo dropa este item.{" "}
              {e.goldPrice > 0
                ? `Ele se compra na loja por ${e.goldPrice} de ouro.`
                : "Ele vem de altar, clã, evento ou do shiny — fora do catálogo público."}
            </p>
          )}
        </Panel>

        {/* ---- onde aparece ----
            Sempre renderizado, mesmo vazio: painel que some faz o grid de duas
            colunas ficar torto e a ficha de um item deixar de parecer com a de
            outro. O que muda e o CONTEUDO. */}
        <Panel
          className="h-full"
          title={
            <span className="flex items-center gap-2">
              <IconPin size={16} />
              Onde aparece
            </span>
          }
          actions={
            areaList.length ? (
              <span className="text-[13px] text-text-mute tabular">
                {areaList.length} {areaList.length > 1 ? "áreas" : "área"}
              </span>
            ) : null
          }
        >
          {areaList.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-text-mute">
              Nenhuma área do mapa: quem dropa este item não tem ponto de caça.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {areaList.map((a) => (
                <li
                  key={a.area}
                  className="flex items-center gap-2 border border-line bg-bg-soft px-2 py-1.5"
                >
                  <IconPin size={16} className="shrink-0 text-ok" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-text">{a.area}</span>
                    <span className="block truncate text-[12px] text-text-mute">
                      {[...a.especies].slice(0, 3).join(", ")}
                      {a.especies.size > 3 ? ` +${a.especies.size - 3}` : ""}
                    </span>
                  </span>
                  <span className="pix shrink-0 text-[11px] text-text-dim tabular">
                    nv {a.min === a.max ? a.min : `${a.min}–${a.max}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- o indice reverso ---- */}
      <Panel
        title={
          <span className="flex items-center gap-1.5">
            <IconLoot size={16} />
            Quem dropa
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {e.sources ? (
              <Link
                href={`/dex?d=${encodeURIComponent(item.name)}`}
                className="pix text-[11px] text-text-mute underline-offset-4 transition-colors hover:text-accent hover:underline"
              >
                abrir na dex
              </Link>
            ) : null}
            <span className="text-[13px] text-text-mute tabular">{fontes.length}</span>
          </div>
        }
        bodyClassName="p-0"
      >
        {fontes.length === 0 ? (
          <p className="p-3 text-[14px] text-text-mute">
            Nenhuma espécie do catálogo dropa este item.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface-2/92 backdrop-blur-xl">
                <tr className="border-b border-line-strong">
                  {["Pokémon", "Nível", "Chance", "Quantidade", "Abates por unidade", "Locais"].map(
                    (h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`pix px-3 py-2 text-[11px] text-text-mute ${i > 0 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {fontes.map((f) => (
                  <tr
                    key={f.creature.pokeId}
                    className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/70"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/dex/${f.creature.pokeId}`}
                        className="flex items-center gap-2"
                      >
                        <Sprite
                          src={spriteUrl(f.creature.pokeId)}
                          alt={f.creature.name}
                          size={34}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] text-text group-hover:text-accent">
                            {f.creature.name}
                          </span>
                          {/* Fonte que nao se caça precisa DIZER isso na linha:
                              senao a tabela promete uma caçada que nao existe. */}
                          {f.spots === 0 ? (
                            <span className="pix text-[11px] text-warn">sem ponto no mapa</span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[14px] text-text-dim tabular">
                      {f.creature.huntLevel || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[14px] text-ok tabular">
                      {pctText(f.chancePct)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[14px] text-text-dim tabular">
                      {f.minCount === f.maxCount ? f.minCount : `${f.minCount}–${f.maxCount}`}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[14px] text-text-dim tabular">
                      {Number.isFinite(f.kills) ? (
                        <Tooltip content={`Na média, ${Math.max(1, Math.round(f.kills)).toLocaleString("pt-BR")} abates de ${f.creature.name} por unidade.`}>
                          <span>{Math.max(1, Math.round(f.kills)).toLocaleString("pt-BR")}</span>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[14px] text-text-mute tabular">
                      {f.spots || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
