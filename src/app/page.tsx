import Link from "next/link";
import { getData } from "@/lib/data";
import { PokedexIcon } from "@/components/pokedex-icon";
import { ItemsIcon, HuntIcon, CalcIcon, LabIcon } from "@/components/tool-icons";
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
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex min-w-0 flex-col gap-2.5">
        <h2 className="pixel text-[0.8rem] sm:text-sm" style={{ color }}><T k={titleKey} /></h2>
        <p className="text-sm text-text-dim leading-relaxed"><T k={descKey} /></p>
        <span className="btn mt-1 self-start whitespace-nowrap" style={{ background: color, color: ctaText }}>
          <T k={ctaKey} /> ›
        </span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const { counts, generatedAt, totalDropEntries, live } = await getData();
  const stats: [string | number, string][] = [
    [counts.creatures, "home.stat.pokemons"],
    [counts.items, "home.stat.items"],
    [totalDropEntries.toLocaleString("pt-BR"), "home.stat.drops"],
    [counts.hunts, "home.stat.hunts"],
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="card overflow-hidden p-6 sm:p-10 lg:p-12">
        <div className="eyebrow mb-4"><T k="home.eyebrow" /></div>
        <h1 className="pixel text-lg leading-[1.5] text-text break-words sm:text-3xl lg:text-4xl">
          <T k="home.heroPre" /> <span style={{ color: "var(--cyan)" }}><T k="home.heroMid" /></span> <T k="home.heroDo" />{" "}
          <span style={{ color: "var(--green)" }}>Poke Idle World</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-text-dim leading-relaxed">
          <T k="home.subtitle" />
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-4 py-3">
              <div className="pixel text-base text-cyan">{value}</div>
              <div className="mt-1 text-[0.68rem] text-text-dim uppercase tracking-wide"><T k={label} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* Ferramentas */}
      <section className="grid gap-4 sm:grid-cols-2">
        <ToolCard
          titleKey="home.card1.title"
          descKey="home.card1.desc"
          href="/dex"
          ctaKey="home.card1.cta"
          color="#e94b4b"
          ctaText="#fff"
          icon={<PokedexIcon size={80} />}
        />
        <ToolCard
          titleKey="home.card2.title"
          descKey="home.card2.desc"
          href="/items"
          ctaKey="home.card2.cta"
          color="var(--green)"
          ctaText="#052012"
          icon={<ItemsIcon size={80} />}
        />
        <ToolCard
          titleKey="home.card4.title"
          descKey="home.card4.desc"
          href="/hunt"
          ctaKey="home.card4.cta"
          color="var(--yellow)"
          ctaText="#06131a"
          icon={<HuntIcon size={80} />}
        />
        <ToolCard
          titleKey="home.card3.title"
          descKey="home.card3.desc"
          href="/calc"
          ctaKey="home.card3.cta"
          color="var(--purple)"
          ctaText="#1a1030"
          icon={<CalcIcon size={80} />}
        />
        <ToolCard
          titleKey="home.card5.title"
          descKey="home.card5.desc"
          href="/eevee"
          ctaKey="home.card5.cta"
          color="var(--cyan)"
          ctaText="#06131a"
          icon={<LabIcon size={80} />}
        />
      </section>

      <p className="text-[0.68rem] text-text-dim">
        {live ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green" /> <T k="home.live" />
          </span>
        ) : (
          <T k="home.snapshot" vars={{ date: new Date(generatedAt).toLocaleString("pt-BR") }} />
        )}
      </p>
    </div>
  );
}
