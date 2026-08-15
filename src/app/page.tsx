import Link from "next/link";
import { getData } from "@/lib/data";
import { PokedexIcon } from "@/components/pokedex-icon";

function ToolCard({
  eyebrow,
  title,
  desc,
  href,
  cta,
  color,
  icon,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card card-link flex flex-col gap-3 p-6"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="eyebrow" style={{ color }}>{eyebrow}</div>
          <h2 className="pixel mt-2 text-sm" style={{ color }}>{title}</h2>
        </div>
        {icon && <span className="shrink-0 opacity-90">{icon}</span>}
      </div>
      <p className="text-sm text-text-dim leading-relaxed">{desc}</p>
      <span className="btn mt-2 self-start" style={{ background: color, color: "#06131a" }}>
        {cta} ›
      </span>
    </Link>
  );
}

export default async function Home() {
  const { counts, generatedAt, totalDropEntries, live } = await getData();
  const stats = [
    [counts.creatures, "pokemons"],
    [counts.items, "itens"],
    [totalDropEntries.toLocaleString("pt-BR"), "drops mapeados"],
    [counts.hunts, "pontos de hunt"],
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="card overflow-hidden p-8 sm:p-12">
        <div className="eyebrow mb-4">Ferramentas Poke Idle World</div>
        <h1 className="pixel text-2xl sm:text-4xl leading-[1.5] text-text">
          A dex <span style={{ color: "var(--cyan)" }}>completa</span> do{" "}
          <span style={{ color: "var(--green)" }}>Poke Idle World</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-text-dim leading-relaxed">
          Stats, movesets, evolucoes, <strong className="text-text">chance real de cada drop</strong>,
          onde farmar cada item e em que area cada pokemon aparece. Puxado direto da
          fonte-mestra do jogo.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded border border-border bg-[rgba(8,14,28,0.5)] px-4 py-3">
              <div className="pixel text-base text-cyan">{value}</div>
              <div className="mt-1 text-[0.68rem] text-text-dim uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Ferramentas */}
      <section className="grid gap-4 sm:grid-cols-3">
        <ToolCard
          eyebrow="Escolha sua ferramenta"
          title="Pokedex"
          desc="Busca por nome e tipo. Cada ficha traz stats, fraquezas, evolucao, drops com chance real e onde cacar."
          href="/dex"
          cta="Abrir Pokedex"
          color="var(--cyan)"
          icon={<PokedexIcon size={44} />}
        />
        <ToolCard
          eyebrow="Indice reverso"
          title="Itens & drops"
          desc="Escolha um item e veja quem dropa e a melhor taxa de farm — ordenado do maior pro menor."
          href="/items"
          cta="Abrir itens"
          color="var(--green)"
        />
        <ToolCard
          eyebrow="Ferramenta"
          title="Calculadora IV"
          desc="Estime os IVs, o IV total e o poder do seu pokemon a partir da qualidade e dos stats. Formula do jogo."
          href="/calc"
          cta="Abrir calculadora"
          color="var(--purple)"
        />
      </section>

      <p className="text-[0.68rem] text-text-dim">
        {live ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green" /> Catalogo ao vivo, direto do jogo (atualiza sozinho).
          </span>
        ) : (
          <>Catalogo do snapshot local ({new Date(generatedAt).toLocaleString("pt-BR")}).</>
        )}
      </p>
    </div>
  );
}
