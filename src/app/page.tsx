import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { sortEntries } from "@/lib/dex";
import { spriteUrl } from "@/lib/sprites";
import { RARITY_COLOR } from "@/lib/typing";
import {
  Chip,
  IconBolt,
  IconChevronRight,
  IconCoin,
  IconPin,
  Panel,
  Pokeball,
  Sprite,
} from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { gold } from "@/components/poke-card";

export const revalidate = 3600;

/**
 * Pagina inicial.
 *
 * Nao e vitrine: e a porta de entrada de uma ferramenta. Por isso ela mostra
 * DADO desde o primeiro scroll — quantas especies o catalogo tem agora, quais
 * pagam mais, quais rendem mais XP — em vez de tres paragrafos explicando o que
 * o site faz. Quem chega aqui ja joga; o que ele quer saber e se a resposta que
 * procura esta aqui dentro.
 */

const TOOLS = [
  {
    href: "/dex",
    name: "Pokedex",
    desc: "Todas as especies com filtro por tipo, raridade, fraqueza, drop e faixa de nivel, valor, XP e stats.",
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catalogo de itens com o indice reverso: quem dropa cada um e com que chance real.",
    ready: false,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, qualidade e Poder pela formula do jogo. Projeta stats em qualquer nivel.",
    ready: false,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc: "Rota de caca por XP, ouro e efetividade — usando o melhor golpe CONTRA o alvo.",
    ready: false,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc: "Simula o ovo, projeta os stats do filho e planeja quantos breeds ate a Quality alvo.",
    ready: false,
  },
  {
    href: "/meta",
    name: "Meta",
    desc: "Quem bate em quem: cobertura de tipo, fraquezas cruzadas e montagem de time.",
    ready: false,
  },
];

/** Uma fatia interessante do catalogo — o "olha isso" que convida a filtrar. */
function Highlight({
  title,
  hint,
  entries,
  metric,
  href,
}: {
  title: string;
  hint: string;
  entries: Awaited<ReturnType<typeof getDexPayload>>["entries"];
  metric: (e: (typeof entries)[number]) => React.ReactNode;
  href: string;
}) {
  return (
    <Panel
      title={title}
      bodyClassName="p-1.5"
      actions={
        <Link
          href={href}
          className="pix flex items-center gap-1 text-[10px] text-accent transition-opacity hover:opacity-80"
        >
          ver tudo
          <IconChevronRight size={8} />
        </Link>
      }
    >
      <p className="px-1.5 pb-2 text-[12px] leading-snug text-text-mute">{hint}</p>
      <ul className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id}>
            <Link
              href={`/dex/${e.id}`}
              className="group flex items-center gap-2 rounded-pix px-1.5 py-1 transition-colors hover:bg-surface-2"
            >
              <span className="pix w-4 shrink-0 text-[10px] text-text-mute">{i + 1}</span>
              <Sprite src={spriteUrl(e.id)} alt={e.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-text group-hover:text-accent">
                  {e.name}
                </span>
                <span className="flex gap-1">
                  <TypeBadge type={e.type1} size="xs" showLabel={false} />
                  {e.type2 ? <TypeBadge type={e.type2} size="xs" showLabel={false} /> : null}
                  <span className="pix text-[10px]" style={{ color: RARITY_COLOR[e.rarity] }}>
                    {e.rarity}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-[13px] tabular">{metric(e)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default async function HomePage() {
  const { entries, counts, catalog } = await getDexPayload();
  const playable = entries.filter((e) => !e.variant);

  // "Paga mais por abate" so pode rankear quem TEM valor de venda. Sem esse
  // recorte o topo vira o Aerodactyl com 6,5 bilhoes — que e o preco de NPC de
  // um exclusivo que nem se caca, e nao o que ele paga por abate.
  const richest = sortEntries(playable.filter((e) => !e.valueFromNpc), "value", "desc").slice(0, 5);
  const xpKings = sortEntries(playable, "xpPerLevel", "desc").slice(0, 5);
  const strongest = sortEntries(playable, "statTotal", "desc").slice(0, 5);

  const stats = [
    { label: "especies", value: playable.length },
    { label: "itens", value: counts.items },
    { label: "pontos de caca", value: counts.hunts },
    { label: "registros de drop", value: counts.drops },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ---- topo ---- */}
      <section className="panel scanline relative overflow-hidden">
        <div className="relative flex flex-col gap-5 px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-3">
            <Pokeball size={44} className="text-accent" />
            <div>
              <h1 className="pix text-[26px] leading-none text-text sm:text-[32px]">
                piw<span className="text-accent">dex</span>
              </h1>
              <p className="pix mt-1.5 text-[10px] text-text-mute">
                dex e ferramentas de poke idle world
              </p>
            </div>
          </div>

          <p className="max-w-2xl text-[14px] leading-relaxed text-text-dim">
            O catalogo inteiro do jogo, lido direto da fonte e pesquisavel de verdade:
            filtre por tipo, raridade, estagio evolutivo, fraqueza, item que dropa e por
            faixa de nivel, valor, XP, stats e poder de golpe — tudo ao mesmo tempo.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dex"
              className="pix inline-flex h-9 items-center gap-2 rounded-pix border border-accent/60
                         bg-accent/20 px-4 text-[12px] text-accent transition-colors
                         hover:bg-accent/30 hover:border-accent"
            >
              abrir a pokedex
              <IconChevronRight size={8} />
            </Link>
            <Chip
              tone={catalog.live ? "ok" : "warn"}
              title={
                catalog.live
                  ? `Catalogo do jogo, publicado em ${catalog.generatedAt}`
                  : `Fonte indisponivel (${catalog.error ?? "motivo desconhecido"})`
              }
            >
              {catalog.live ? "catalogo ao vivo" : "catalogo salvo"}
            </Chip>
          </div>

          {/* Os numeros do catalogo AGORA — a prova de que o dado e o do jogo. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-pix border border-line bg-line sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-3 py-2.5">
                <dd className="text-[20px] leading-none font-semibold text-text tabular">
                  {s.value.toLocaleString("pt-BR")}
                </dd>
                <dt className="pix mt-1 text-[10px] text-text-mute">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- destaques do catalogo ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="pix text-[12px] text-text-dim">Do catalogo, agora</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Highlight
            title="Paga mais por abate"
            hint="Maior sellValue — o que o jogo paga por abate. Exclusivos sem valor de venda ficam de fora: o preco de NPC deles e outra grandeza."
            entries={richest}
            href="/dex?sort=value&dir=desc"
            metric={(e) => (
              <span className="flex items-center gap-1 text-warn">
                <IconCoin size={8} />
                {gold(e.value)}
              </span>
            )}
          />
          <Highlight
            title="Melhor XP por nivel"
            hint="XP dividido pelo nivel da caca: rendimento, nao volume bruto. O XP cru premia bicho de nivel alto que voce ainda nao encara."
            entries={xpKings}
            href="/dex?sort=xpPerLevel&dir=desc"
            metric={(e) => (
              <span className="text-neon">
                {(e.level > 0 ? e.xp / e.level : 0).toFixed(1)}
                <span className="ml-0.5 text-[10px] text-text-mute">/nv</span>
              </span>
            )}
          />
          <Highlight
            title="Maior total de stats"
            hint="Soma dos seis stats base — a regua grossa de forca da especie, antes de IV e Quality."
            entries={strongest}
            href="/dex?sort=statTotal&dir=desc"
            metric={(e) => (
              <span className="flex items-center gap-1 text-accent">
                <IconBolt size={8} />
                {e.statTotal}
              </span>
            )}
          />
        </div>
      </section>

      {/* ---- ferramentas ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="pix text-[12px] text-text-dim">Ferramentas</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t) => {
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="pix text-[13px] text-text">{t.name}</span>
                  {t.ready ? (
                    <IconChevronRight size={10} className="text-accent" />
                  ) : (
                    <Chip size="xs">em breve</Chip>
                  )}
                </div>
                <p className="text-[12px] leading-relaxed text-text-mute">{t.desc}</p>
              </>
            );
            return t.ready ? (
              <Link
                key={t.href}
                href={t.href}
                className="panel group flex flex-col gap-2 p-3 transition-all
                           hover:border-accent/55 hover:shadow-[0_0_24px_-12px_var(--color-accent)]"
              >
                {body}
              </Link>
            ) : (
              <div key={t.href} className="panel flex flex-col gap-2 p-3 opacity-55">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- de onde vem o dado ---- */}
      <section className="panel flex flex-col gap-2 p-4">
        <h2 className="pix flex items-center gap-2 text-[11px] text-text-dim">
          <IconPin size={10} />
          De onde vem o dado
        </h2>
        <p className="max-w-3xl text-[13px] leading-relaxed text-text-mute">
          Direto do catalogo publico do proprio jogo — criaturas, itens e pontos do mapa —
          conferido por ETag a cada visita e recarregado no segundo em que o jogo publica um
          patch. Quando a fonte nao responde, o site continua de pe com o ultimo catalogo
          salvo e diz isso na tela, em vez de servir dado velho fingindo estar ao vivo.
        </p>
      </section>
    </div>
  );
}
