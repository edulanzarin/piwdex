import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { chanceToPct, getData } from "@/lib/data";
import { getDexPayload } from "@/lib/dex-data";
import { buildEntry, rolesOf } from "@/lib/dex";
import { spriteUrl } from "@/lib/sprites";
import { RARITY_COLOR, TYPE_COLOR, defensiveDetailed, offensiveDetailed } from "@/lib/typing";
import { projectAll } from "@/lib/stats";
import {
  Chip,
  IconChevronRight,
  IconCoin,
  IconEvolve,
  IconPin,
  Panel,
  Sprite,
  StatBar,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeMultChip } from "@/components/type-icon";
import {
  CategoryIcon,
  IconAtk,
  IconBag,
  IconGem,
  IconLevel,
  IconScale,
  IconTarget,
  IconTm,
  IconDef as IconDefShield,
  IconWeak,
  IconXp,
  STAT_ICONS,
} from "@/components/game-icons";
import {
  CATEGORY_LABEL,
  RARITY_LABEL,
  ROLE_LABEL,
  STAT_LABEL,
  compact as gold,
  multWord,
} from "@/lib/labels";

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = await getData();
  const c = db.getCreature(Number(id));
  if (!c) return { title: "Pokémon não encontrado" };
  return {
    title: c.name,
    description:
      `${c.name} no Poke Idle World: stats base, fraquezas, golpes, evolução, ` +
      `locais de caça e drops com a chance real de cada item.`,
  };
}

export default async function CreaturePage({ params }: Props) {
  const { id } = await params;
  const db = await getData();
  const c = db.getCreature(Number(id));
  if (!c) notFound();

  // Mesmo teto de barra do grid: um stat 65 tem de desenhar igual na ficha e no
  // card. Usar o proprio maximo da especie faria o Bulbasaur parecer no teto.
  const { bounds } = await getDexPayload();

  const e = buildEntry(c, {
    spotsOf: (x) => db.locationsOf(x).length,
    acquisitionOf: db.acquisitionOf,
    chainOf: (x) => db.evolutionChainOf(x).map((s) => ({ pokeId: s.creature.pokeId })),
  });

  const spots = db.locationsOf(c);
  const chain = db.evolutionChainOf(c);
  const { weak, resist, immune } = defensiveDetailed(c.type1, c.type2);
  const strong = offensiveDetailed(c.type1, c.type2);
  const roles = rolesOf(e);

  // Ordena golpes por poder, separando os dois pools. A separacao nao e detalhe:
  // TODO golpe de poder 600 do jogo e de TM, e misturar promete um DPS que quem
  // nao tem a maquina nao possui.
  const natural = c.attacks.filter((a) => !a.tm).sort((a, b) => b.power - a.power);
  const machine = c.attacks.filter((a) => a.tm).sort((a, b) => b.power - a.power);

  const drops = [...c.loot].sort((a, b) => b.chance - a.chance);

  // Projecao com IV perfeito (32) e Quality 1.0 — a referencia de teto que a
  // calculadora depois compara contra o bicho real do jogador.
  const perfect = projectAll(e.stats, [32, 32, 32, 32, 32, 32], 100, 1);


  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-1.5 text-[12px] text-text-mute">
        <Link href="/dex" className="transition-colors hover:text-accent">
          Pokedex
        </Link>
        <IconChevronRight size={8} />
        <span className="text-text-dim">{c.name}</span>
      </nav>

      {/* ---- identidade ---- */}
      <header className="panel scanline relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative grid shrink-0 place-items-center self-center">
          <span
            aria-hidden="true"
            className="absolute h-28 w-28 rounded-full blur-2xl"
            style={{ backgroundColor: RARITY_COLOR[c.rarity], opacity: 0.22 }}
          />
          <Sprite src={spriteUrl(c.pokeId)} alt={c.name} size={128} priority className="relative" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="pix text-[11px] text-text-mute">
            #{String(c.pokeId).padStart(3, "0")}
            {c.area ? ` · ${c.area}` : ""}
          </span>
          <h1 className="text-[24px] leading-none font-semibold text-text">{c.name}</h1>

          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={c.type1} />
            {c.type2 ? <TypeBadge type={c.type2} /> : null}
            <Chip tint={RARITY_COLOR[c.rarity]} icon={<IconGem size={8} />}>
              {RARITY_LABEL[c.rarity]}
            </Chip>
            {roles.map((r) => (
              <Chip key={r}>{ROLE_LABEL[r] ?? r}</Chip>
            ))}
            {e.hasTm ? (
              <Chip tone="neon" icon={<IconTm size={8} />}>
                aprende TM
              </Chip>
            ) : null}
          </div>

          {c.description ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-text-mute">{c.description}</p>
          ) : null}

          <dl className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-pix border border-line bg-line sm:grid-cols-4">
            {[
              { label: "nível de caça", value: c.huntLevel || "—", icon: <IconLevel size={9} /> },
              {
                // Declara qual grandeza esta na tela: `sellValue` (o que o jogo
                // paga por abate) e `priceNpc` (preco do cassino) nao se
                // comparam, e o rotulo unico faz a ficha se contradizer.
                label: e.valueFromNpc ? "preço de npc" : "venda por abate",
                value: e.value > 0 ? gold(e.value) : "—",
                icon: <IconCoin size={9} />,
                tone: e.valueFromNpc ? "text-text-dim" : "text-warn",
              },
              { label: "xp por abate", value: c.experience || "—", tone: "text-neon", icon: <IconXp size={9} /> },
              {
                label: "total de stats",
                value: e.statTotal,
                icon: <IconScale size={9} />,
                tone: "text-accent",
              },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-3 py-2">
                <dd className={`flex items-center gap-1 text-[17px] leading-none font-semibold tabular ${s.tone ?? "text-text"}`}>
                  {s.icon}
                  {s.value}
                </dd>
                <dt className="pix mt-1 text-[10px] text-text-mute">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ---- stats ---- */}
        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <IconScale size={10} />
              Stats base
            </span>
          }
          actions={<span className="text-[12px] text-text-mute tabular">{e.statTotal}</span>}
        >
          <div className="flex flex-col gap-1.5">
            {e.stats.map((v, i) => {
              const Icon = STAT_ICONS[i];
              return (
                <StatBar
                  key={i}
                  label={STAT_LABEL[i]}
                  icon={<Icon size={9} />}
                  value={v}
                  max={bounds.statCeiling}
                  tint={TYPE_COLOR[c.type1]}
                />
              );
            })}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-[12px] leading-relaxed text-text-mute">
            No nível 100 com IV perfeito e Quality 1.0 isso vira{" "}
            <span className="text-text-dim tabular">{perfect.sum}</span> de soma e{" "}
            <span className="text-accent tabular">{perfect.power}</span> de Poder. IV e Quality
            são por INDIVÍDUO — o catálogo só define a base.
          </p>
        </Panel>

        {/* ---- defesa ---- */}
        <Panel title={<span className="flex items-center gap-1.5"><IconWeak size={10} />Como apanha</span>}>
          {weak.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[10px] text-danger"><IconWeak size={9} />fraco contra</p>
              <div className="flex flex-wrap gap-1">
                {weak.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-danger" />
                ))}
              </div>
            </div>
          ) : null}

          {resist.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[10px] text-ok"><IconDefShield size={9} />resiste a</p>
              <div className="flex flex-wrap gap-1">
                {resist.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-ok" />
                ))}
              </div>
            </div>
          ) : null}

          {immune.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 text-[10px] text-text-mute">imune a</p>
              <div className="flex flex-wrap gap-1">
                {immune.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-text-mute" />
                ))}
              </div>
            </div>
          ) : null}

          {strong.length ? (
            <div className="border-t border-line pt-3">
              {/* STAB (1.5x por golpe do proprio tipo) e coisa SEPARADA da
                  efetividade (x2/x0.5). Juntar os dois num numero so foi um erro
                  ja pago — aqui a lista e so cobertura de tipo. */}
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[10px] text-accent"><IconTarget size={9} />bate forte em</p>
              <div className="flex flex-wrap gap-1">
                {strong.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-accent" />
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        {/* ---- evolucao ---- */}
        {chain.length > 1 ? (
          <Panel title={<span className="flex items-center gap-1.5"><IconEvolve size={10} />Linha evolutiva</span>}>
            <ol className="flex flex-wrap items-center gap-1">
              {chain.map((s, i) => (
                <li key={s.creature.pokeId} className="flex items-center gap-1">
                  {i > 0 ? (
                    <span className="flex flex-col items-center px-1 text-text-mute">
                      <IconChevronRight size={10} />
                      {s.evolveLevel ? (
                        <span className="pix text-[10px] text-text-mute">nv {s.evolveLevel}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <Link
                    href={`/dex/${s.creature.pokeId}`}
                    className={`flex flex-col items-center gap-0.5 rounded-pix border p-1.5 transition-colors ${
                      s.creature.pokeId === c.pokeId
                        ? "border-accent/60 bg-accent/10"
                        : "border-line hover:border-accent/40 hover:bg-surface-2"
                    }`}
                  >
                    <Sprite src={spriteUrl(s.creature.pokeId)} alt={s.creature.name} size={44} />
                    <span className="text-[11px] text-text-dim">{s.creature.name}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        ) : null}

        {/* ---- onde cacar ---- */}
        <Panel
          title={<span className="flex items-center gap-1.5"><IconPin size={10} />Onde caçar</span>}
          actions={<span className="text-[12px] text-text-mute tabular">{spots.length}</span>}
        >
          {spots.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-mute">
              {e.acquisition === "evo"
                ? "Não aparece no mapa — só se consegue evoluindo."
                : "Não aparece no mapa nem por evolução: vem de loja, cassino, ovo ou evento."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {spots.map((h) => (
                <li
                  key={h.slug}
                  className="flex items-center gap-2 rounded-pix border border-line bg-bg-soft px-2 py-1.5"
                >
                  <IconPin size={10} className="shrink-0 text-ok" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text">{h.name}</span>
                    <span className="text-[11px] text-text-mute">{h.area}</span>
                  </span>
                  <span className="pix shrink-0 text-[10px] text-text-dim tabular">nv {h.level}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- golpes ---- */}
      <Panel
        title={<span className="flex items-center gap-1.5"><IconAtk size={10} />Golpes</span>}
        actions={
          <span className="text-[12px] text-text-mute tabular">
            {natural.length} naturais{machine.length ? ` · ${machine.length} TM` : ""}
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-strong">
                {["Golpe", "Tipo", "Categoria", "Poder", "Aprende"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`pix px-3 py-2 text-[10px] text-text-mute ${i >= 3 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ...natural.map((a) => ({ a, tm: false })),
                ...machine.map((a) => ({ a, tm: true })),
              ].map(({ a, tm }) => (
                <tr key={`${a.name}-${a.learnLevel}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-[13px] text-text">
                    <span className="flex items-center gap-1.5">
                      {a.name}
                      {tm ? <Chip size="xs" tone="neon" icon={<IconTm size={7} />}>TM</Chip> : null}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <TypeBadge type={a.type} size="xs" />
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-text-mute">
                    <span className="flex items-center gap-1.5" title={CATEGORY_LABEL[a.category]}>
                      <CategoryIcon category={a.category} size={9} />
                      {CATEGORY_LABEL[a.category]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-[13px] text-accent tabular">{a.power}</td>
                  <td className="px-3 py-1.5 text-right text-[13px] text-text-dim tabular">
                    {tm ? "—" : a.learnLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Sem coluna de cooldown: o valor do catalogo e o cooldown BASE e a
            velocidade do bicho o encurta no jogo, entao exibi-lo cru daria um
            numero errado. Fica so o comentario — o aviso na tela era ruido. */}
      </Panel>

      {/* ---- drops ---- */}
      <Panel
        title={<span className="flex items-center gap-1.5"><IconBag size={10} />Drops</span>}
        actions={<span className="text-[12px] text-text-mute tabular">{drops.length}</span>}
        bodyClassName="p-0"
      >
        {drops.length === 0 ? (
          <p className="p-3 text-[13px] text-text-mute">Não dropa nada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line-strong">
                  {["Item", "Chance", "Quantidade", "Valor NPC"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`pix px-3 py-2 text-[10px] text-text-mute ${i > 0 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drops.map((l) => {
                  const item = db.getItemByName(l.name);
                  // A fonte guarda `chance` na escala 0..100000 — a porcentagem
                  // real e /1000. E o numero exato que o piwtools nao mostra.
                  const pct = chanceToPct(l.chance);
                  return (
                    <tr key={l.name} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 text-[13px] text-text">
                        <span className="flex items-center gap-1.5">
                          {l.name}
                          {item?.rare ? <Chip size="xs" tone="accent" icon={<IconGem size={7} />}>raro</Chip> : null}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[13px] text-ok tabular">
                        <Tooltip content={`1 a cada ${Math.round(100 / pct).toLocaleString("pt-BR")} abates, na média`}>
                          <span>{pct < 0.01 ? pct.toFixed(4) : pct.toFixed(3)}%</span>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[13px] text-text-dim tabular">
                        {l.minCount === l.maxCount ? l.minCount : `${l.minCount}–${l.maxCount}`}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[13px] text-warn tabular">
                        {item?.npcPrice ? gold(item.npcPrice) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
