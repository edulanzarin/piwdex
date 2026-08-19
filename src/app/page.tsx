import Link from "next/link";
import { getData } from "@/lib/data";
import { PokedexIcon } from "@/components/pokedex-icon";
import { ItemsIcon, HuntIcon, CalcIcon, LabIcon, BreedIcon } from "@/components/tool-icons";
import { StatTile } from "@/components/stat-tile";
import { ChevronRight } from "@/components/icons";
import { T } from "@/components/locale-provider";

function ToolCard({
  titleKey,
  descKey,
  href,
  ctaKey,
  color,
  icon,
  ctaText = "#06131a",
}: {
  titleKey: string;
  descKey: string;
  href: string;
  ctaKey: string;
  color: string;
  icon?: React.ReactNode;
  ctaText?: string;
}) {
  return (
    <Link
      href={href}
      className="card card-link flex items-center gap-5 p-6 sm:gap-6 sm:p-8"
    >
      {/* o icone de linha herda o acento do card (currentColor): mesma cor do titulo e
          do CTA, entao a ferramenta se identifica pela cor e nao so pelo desenho */}
      {icon && <span className="shrink-0" style={{ color }}>{icon}</span>}
      {/* coluna estica na altura do card (auto-rows-fr na grade) e o CTA ancora embaixo:
          todos os cards da fileira ficam com a mesma altura e botoes alinhados */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 self-stretch">
        <h2 className="pixel text-xl" style={{ color }}><T k={titleKey} /></h2>
        <p className="text-sm text-text-dim leading-relaxed"><T k={descKey} /></p>
        <span className="btn mt-auto self-start whitespace-nowrap" style={{ background: color, color: ctaText }}>
          <T k={ctaKey} /> <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const { counts, totalDropEntries } = await getData();
  const stats: [string | number, string][] = [
    [counts.creatures, "home.stat.pokemons"],
    [counts.items, "home.stat.items"],
    [totalDropEntries.toLocaleString("pt-BR"), "home.stat.drops"],
    [counts.hunts, "home.stat.hunts"],
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="card overflow-hidden p-6 sm:p-10 lg:p-12">
        <h1 className="pixel text-xl leading-snug text-text break-words sm:text-2xl md:text-3xl lg:text-4xl">
          <T k="home.heroPre" /> <span style={{ color: "var(--cyan)" }}><T k="home.heroMid" /></span> <T k="home.heroDo" />{" "}
          <span style={{ color: "var(--green)" }}>Poke Idle World</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-text-dim leading-relaxed">
          <T k="home.subtitle" />
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <StatTile key={label} label={<T k={label} />} value={value} accent="var(--cyan)" />
          ))}
        </div>
      </section>

      {/* Ferramentas: 1 col no celular, 2 no sm+; auto-rows-fr iguala a altura dos cards */}
      <section className="grid grid-cols-1 gap-4 sm:auto-rows-fr sm:grid-cols-2">
        <ToolCard
          titleKey="home.card1.title"
          descKey="home.card1.desc"
          href="/dex"
          ctaKey="home.card1.cta"
          color="#e94b4b"
          ctaText="#fff"
          icon={<PokedexIcon size={64} />}
        />
        <ToolCard
          titleKey="home.card2.title"
          descKey="home.card2.desc"
          href="/items"
          ctaKey="home.card2.cta"
          color="var(--green)"
          ctaText="#052012"
          icon={<ItemsIcon size={64} />}
        />
        <ToolCard
          titleKey="home.card4.title"
          descKey="home.card4.desc"
          href="/hunt"
          ctaKey="home.card4.cta"
          color="var(--yellow)"
          ctaText="#06131a"
          icon={<HuntIcon size={64} />}
        />
        <ToolCard
          titleKey="home.card3.title"
          descKey="home.card3.desc"
          href="/calc"
          ctaKey="home.card3.cta"
          color="var(--purple)"
          ctaText="#1a1030"
          icon={<CalcIcon size={64} />}
        />
        <ToolCard
          titleKey="home.card5.title"
          descKey="home.card5.desc"
          href="/eevee"
          ctaKey="home.card5.cta"
          color="var(--cyan)"
          ctaText="#06131a"
          icon={<LabIcon size={64} />}
        />
        <ToolCard
          titleKey="home.card6.title"
          descKey="home.card6.desc"
          href="/breed"
          ctaKey="home.card6.cta"
          color="var(--pink)"
          ctaText="#2a0a12"
          icon={<BreedIcon size={64} />}
        />
      </section>

    </div>
  );
}
