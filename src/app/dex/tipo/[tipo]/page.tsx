import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDexPayload } from "@/lib/dex-data";
import { tipoDoSlug, TODOS_SLUGS, caminhoDoTipo, nomeDoTipo } from "@/lib/tipo-url";
import { defensiveDetailed, offensiveDetailed, TYPE_COLOR, ALL_TYPES } from "@/lib/typing";
import { TYPE_LABEL, RARITY_LABEL } from "@/lib/labels";
import { PokeCard } from "@/components/poke-card";
import { TypeIcon } from "@/components/type-icon";
import { JsonLd, trilha } from "@/lib/jsonld";
import { IconChevronRight } from "@/components/ui";

/**
 * O hub de um tipo.
 *
 * Ele existe por duas razoes que se somam, e nenhuma delas e "ter mais paginas".
 *
 * 1. **A pergunta existe e nao tinha pagina.** "pokemon de fogo poke idle world"
 *    e uma consulta com intencao clara, e a dex so respondia por parametro de
 *    busca (`/dex?tipo=fire`) — endereco que o buscador rastreia com ma vontade e
 *    raramente indexa.
 * 2. **As 910 fichas estavam soltas.** Elas so eram alcancaveis pela lista
 *    filtrada e pelo sitemap. Dezoito hubs no meio do caminho dao ao rastreador
 *    (e a pessoa) uma trilha curta ate qualquer especie, e distribuem autoridade
 *    da home pras folhas em vez de deixar cada ficha sozinha.
 *
 * O conteudo NAO e a lista repetida com outro filtro: cada hub afirma o que so
 * vale pra aquele tipo — quantas especies, contra quem elas batem forte, de quem
 * elas apanham, e em que faixa de nivel elas aparecem. Isso sai de `typing.ts` e
 * do catalogo, entao nao ha frase inventada nem molde com o nome trocado.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * O conjunto e FECHADO: dezoito tipos, e nao existe decimo nono.
 *
 * Sem isto, qualquer slug inventado (`/dex/tipo/banana`) e gerado sob demanda, o
 * `notFound()` renderiza a tela de "nao encontrado"... e o servidor responde
 * **200**. Isso e um soft 404, que e pior que um 404: o buscador ve pagina valida,
 * indexa, e o site passa a ter infinitas paginas vazias — num site que vive de
 * ser exato, e o tipo de coisa que custa confianca de dominio.
 *
 * `dynamicParams = false` faz o proprio Next devolver 404 pra qualquer coisa fora
 * da lista, sem renderizar nada. O `notFound()` do corpo fica como cinto de
 * seguranca pro caso de a lista e o parse discordarem um dia.
 */
export const dynamicParams = false;

/** Os dezoito valem o build: sao poucos, sao a porta de entrada das folhas, e
 *  pre-renderizados eles ja nascem prontos pro primeiro rastreio. */
export function generateStaticParams() {
  return TODOS_SLUGS.map((tipo) => ({ tipo }));
}

interface Props {
  params: Promise<{ tipo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tipo: slug } = await params;
  const t = tipoDoSlug(slug);
  if (!t) return { title: "Tipo não encontrado" };
  const { entries } = await getDexPayload();
  const doTipo = entries.filter((e) => e.type1 === t || e.type2 === t);
  const nome = nomeDoTipo(t);
  return {
    title: { absolute: `Pokémon de ${nome} no Poke Idle World — as ${doTipo.length} espécies` },
    description:
      `Todos os ${doTipo.length} pokémon de ${nome} do Poke Idle World: stats, ` +
      `onde cada um aparece, o que dropa, contra quem o tipo ${nome} bate forte e de quem ele apanha.`,
    alternates: { canonical: caminhoDoTipo(t) },
  };
}

export default async function TipoPage({ params }: Props) {
  const { tipo: slug } = await params;
  const t = tipoDoSlug(slug);
  if (!t) notFound();

  const { entries, bounds } = await getDexPayload();
  const doTipo = entries
    .filter((e) => e.type1 === t || e.type2 === t)
    .sort((a, b) => b.statTotal - a.statTotal);
  if (!doTipo.length) notFound();

  const nome = nomeDoTipo(t);
  const cor = TYPE_COLOR[t];
  const forte = offensiveDetailed(t, null);
  const { weak, resist, immune } = defensiveDetailed(t, null);

  // Fatos que so valem PRA ESTE tipo — e todos saem do catalogo, nao de molde.
  const comPonto = doTipo.filter((e) => e.level > 0);
  const nivelMin = comPonto.length ? Math.min(...comPonto.map((e) => e.level)) : 0;
  const nivelMax = comPonto.length ? Math.max(...comPonto.map((e) => e.level)) : 0;
  const maisForte = doTipo[0];
  const puros = doTipo.filter((e) => !e.type2).length;

  const lista = (ts: { type: (typeof ALL_TYPES)[number]; label: string }[]) =>
    ts.map((x) => `${TYPE_LABEL[x.type]} (${x.label})`).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <JsonLd
        dado={trilha([
          { nome: "PIWdex", caminho: "/" },
          { nome: "Pokédex", caminho: "/dex" },
          { nome: `Tipo ${nome}`, caminho: caminhoDoTipo(t) },
        ])}
      />

      <header className="panel hero px-4 py-5 sm:px-6 sm:py-7" style={{ "--tint": cor } as React.CSSProperties}>
        <span className="hero-facho" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-4">
          <span className="hero-halo anim-float grid place-items-center">
            <TypeIcon type={t} size={44} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="pix block text-[10px] text-text-mute">tipo</span>
            <h1 className="pix tint-glow text-[26px] leading-none sm:text-[32px]" style={{ color: cor }}>
              Pokémon de {nome}
            </h1>
            <p className="mt-2 text-[14px] text-text-dim">
              {doTipo.length} espécies no Poke Idle World, {puros} delas de tipo puro.
            </p>
          </div>
        </div>
      </header>

      {/* O que vale saber ANTES da lista: e o que a lista sozinha nao diz. */}
      <section className="panel flex flex-col gap-3 p-4 text-[14px] leading-relaxed text-text-dim">
        {forte.length ? (
          <p>
            Golpe de {nome} bate forte contra <strong className="text-text">{lista(forte)}</strong>.
          </p>
        ) : null}
        {weak.length ? (
          <p>
            Um pokémon de {nome} puro apanha de <strong className="text-text">{lista(weak)}</strong>
            {resist.length ? <> e resiste a {lista(resist)}</> : null}
            {immune.length ? <> — e não sente nada de {lista(immune)}</> : null}.
          </p>
        ) : null}
        {nivelMax > 0 ? (
          <p>
            No mapa eles aparecem entre o nível {nivelMin} e o {nivelMax}. O de stats mais
            altos é{" "}
            <Link href={`/dex/${maisForte.id}`} className="text-accent underline underline-offset-4">
              {maisForte.name}
            </Link>{" "}
            ({maisForte.statTotal} de total, {RARITY_LABEL[maisForte.rarity]}).
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {doTipo.map((e, i) => (
          <PokeCard key={e.id} e={e} ceiling={bounds.statCeiling} priority={i < 8} index={i} />
        ))}
      </div>

      {/* Os outros dezessete: e o que transforma dezoito paginas soltas numa malha. */}
      <nav className="panel flex flex-col gap-3 p-4">
        <h2 className="pix text-[12px] text-text-dim">Os outros tipos</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.filter((x) => x !== t).map((x) => (
            <Link
              key={x}
              href={caminhoDoTipo(x)}
              className="pix flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
              style={{
                color: TYPE_COLOR[x],
                borderColor: `color-mix(in oklab, ${TYPE_COLOR[x]} 45%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${TYPE_COLOR[x]} 12%, transparent)`,
              }}
            >
              <TypeIcon type={x} size={14} />
              {TYPE_LABEL[x]}
            </Link>
          ))}
        </div>
        <Link
          href="/dex"
          className="pix mt-1 inline-flex w-fit items-center gap-2 text-[12px] text-text-mute transition-colors hover:text-accent"
        >
          ver a pokédex inteira, com filtro
          <IconChevronRight size={14} />
        </Link>
      </nav>
    </div>
  );
}
