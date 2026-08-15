import Link from "next/link";
import { getData } from "@/lib/data";
import { PokedexIcon } from "@/components/pokedex-icon";
import { T, TB } from "@/components/locale-provider";

function ToolCard({
  eyebrowKey,
  titleKey,
  descKey,
  href,
  ctaKey,
  color,
  icon,
  ctaText = "#06131a",
}: {
  eyebrowKey: string;
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
      className="card card-link flex flex-col gap-3 p-6"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow" style={{ color }}><T k={eyebrowKey} /></div>
          <h2 className="pixel mt-2 text-sm" style={{ color }}><T k={titleKey} /></h2>
        </div>
        {icon && <span className="shrink-0 opacity-90">{icon}</span>}
      </div>
      <p className="text-sm text-text-dim leading-relaxed"><T k={descKey} /></p>
      <span className="btn mt-2 self-start" style={{ background: color, color: ctaText }}>
        <T k={ctaKey} /> ›
      </span>
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
      <section className="card overflow-hidden p-8 sm:p-12">
        <div className="eyebrow mb-4"><T k="home.eyebrow" /></div>
        <h1 className="pixel text-2xl sm:text-4xl leading-[1.5] text-text">
          <T k="home.heroPre" /> <span style={{ color: "var(--cyan)" }}><T k="home.heroMid" /></span> <T k="home.heroDo" />{" "}
          <span style={{ color: "var(--green)" }}>Poke Idle World</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-text-dim leading-relaxed">
          <TB k="home.subtitle" bKey="home.subtitleB" />
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ToolCard
          eyebrowKey="home.card1.eyebrow"
          titleKey="home.card1.title"
          descKey="home.card1.desc"
          href="/dex"
          ctaKey="home.card1.cta"
          color="#e94b4b"
          ctaText="#fff"
          icon={<PokedexIcon size={44} />}
        />
        <ToolCard
          eyebrowKey="home.card2.eyebrow"
          titleKey="home.card2.title"
          descKey="home.card2.desc"
          href="/items"
          ctaKey="home.card2.cta"
          color="var(--green)"
        />
        <ToolCard
          eyebrowKey="home.card4.eyebrow"
          titleKey="home.card4.title"
          descKey="home.card4.desc"
          href="/hunt"
          ctaKey="home.card4.cta"
          color="var(--yellow)"
          ctaText="#06131a"
        />
        <ToolCard
          eyebrowKey="home.card3.eyebrow"
          titleKey="home.card3.title"
          descKey="home.card3.desc"
          href="/calc"
          ctaKey="home.card3.cta"
          color="var(--purple)"
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
