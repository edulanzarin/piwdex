import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDexPayload } from "@/lib/dex-data";
import {
  raridadeDoSlug,
  TODOS_SLUGS_RARIDADE,
  caminhoDaRaridade,
  nomeDaRaridade,
  pluralDaRaridade,
} from "@/lib/raridade-url";
import { RARITY_COLOR, RARITY_ORDER } from "@/lib/typing";
import { RARITY_LABEL, TYPE_LABEL, compact as gold } from "@/lib/labels";
import { PokeCard } from "@/components/poke-card";
import { JsonLd, trilha } from "@/lib/jsonld";
import { IconChevronRight } from "@/components/ui";
import { IconGem } from "@/components/game-icons";

/**
 * O hub de uma raridade.
 *
 * Irmao do hub de tipo (`/dex/tipo/[tipo]`), e existe pela mesma razao: a dex
 * filtra por raridade, mas por parametro de busca, e ninguem chega ali por uma
 * consulta. "pokemon lendario poke idle world" e pergunta de quem joga.
 *
 * O que muda e O QUE A PAGINA AFIRMA. No hub de tipo o assunto e combate (contra
 * quem bate, de quem apanha). Aqui o assunto e ESCASSEZ: quantos existem, quanto
 * do catalogo isso representa, quanto eles pagam por abate e se da pra caca-los
 * — porque raridade alta costuma vir junto com "nao aparece no mapa", e essa e a
 * frustracao real de quem procura.
 *
 * Duas paginas com a mesma lista e textos diferentes seriam conteudo duplicado.
 * Duas paginas que respondem perguntas diferentes, nao.
 */
export const dynamic = "force-static";
export const revalidate = 3600;

/** Conjunto fechado: seis raridades, e nao existe setima. Sem isto,
 *  `/dex/raridade/banana` viraria soft 404 (200 com tela de "nao encontrado"),
 *  que e o buscador indexando pagina vazia. Mesma armadilha do hub de tipo. */
export const dynamicParams = false;

export function generateStaticParams() {
  return TODOS_SLUGS_RARIDADE.map((raridade) => ({ raridade }));
}

interface Props {
  params: Promise<{ raridade: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { raridade: slug } = await params;
  const r = raridadeDoSlug(slug);
  if (!r) return { title: "Raridade não encontrada" };
  const { entries } = await getDexPayload();
  const n = entries.filter((e) => e.rarity === r).length;
  const plural = pluralDaRaridade(r);
  return {
    title: { absolute: `Pokémon ${plural} no Poke Idle World — os ${n} do catálogo` },
    description:
      `Os ${n} pokémon ${plural} do Poke Idle World: quais são, quanto pagam por abate, ` +
      `em que nível aparecem e quais deles não dá pra caçar no mapa.`,
    alternates: { canonical: caminhoDaRaridade(r) },
  };
}

export default async function RaridadePage({ params }: Props) {
  const { raridade: slug } = await params;
  const r = raridadeDoSlug(slug);
  if (!r) notFound();

  const { entries, bounds } = await getDexPayload();
  const daFaixa = entries
    .filter((e) => e.rarity === r)
    .sort((a, b) => b.statTotal - a.statTotal);
  if (!daFaixa.length) notFound();

  const cor = RARITY_COLOR[r];
  const nome = nomeDaRaridade(r);
  const plural = pluralDaRaridade(r);

  // Os fatos de ESCASSEZ. Todos saem do catalogo — nenhum e adjetivo nosso.
  const fatia = ((daFaixa.length / entries.length) * 100).toFixed(1).replace(".", ",");
  const comPonto = daFaixa.filter((e) => e.spots > 0);
  const semPonto = daFaixa.length - comPonto.length;
  const niveis = comPonto.map((e) => e.level).filter((n) => n > 0);
  const nivelMin = niveis.length ? Math.min(...niveis) : 0;
  const nivelMax = niveis.length ? Math.max(...niveis) : 0;
  const maisRico = [...daFaixa].sort((a, b) => b.value - a.value)[0];
  const tipos = new Map<string, number>();
  for (const e of daFaixa) tipos.set(e.type1, (tipos.get(e.type1) ?? 0) + 1);
  const tipoTop = [...tipos.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-4">
      <JsonLd
        dado={trilha([
          { nome: "PIWdex", caminho: "/" },
          { nome: "Pokédex", caminho: "/dex" },
          { nome: `Raridade ${nome}`, caminho: caminhoDaRaridade(r) },
        ])}
      />

      <header
        className="panel hero px-4 py-5 sm:px-6 sm:py-7"
        style={{ "--tint": cor } as CSSProperties}
      >
        <span className="hero-facho" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-4">
          <span className="hero-halo anim-float grid place-items-center">
            {/* O GameIcon fecha o contrato em size/className — cor vai por
                herança, que e o que o primitivo espera. */}
            <span style={{ color: cor }}>
              <IconGem size={40} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <span className="pix block text-[10px] text-text-mute">raridade</span>
            <h1 className="pix tint-glow text-[26px] leading-none sm:text-[32px]" style={{ color: cor }}>
              Pokémon {plural}
            </h1>
            <p className="mt-2 text-[14px] text-text-dim">
              {daFaixa.length} espécies, {fatia}% do catálogo do Poke Idle World.
            </p>
          </div>
        </div>
      </header>

      <section className="panel flex flex-col gap-3 p-4 text-[14px] leading-relaxed text-text-dim">
        {nivelMax > 0 ? (
          <p>
            No mapa eles aparecem entre o nível {nivelMin} e o {nivelMax}
            {tipoTop ? (
              <>
                , e o tipo mais comum entre eles é{" "}
                <strong className="text-text">{TYPE_LABEL[tipoTop[0] as keyof typeof TYPE_LABEL]}</strong>{" "}
                ({tipoTop[1]} espécies)
              </>
            ) : null}
            .
          </p>
        ) : null}
        {/* A frustracao real de quem procura raridade alta: metade nao se caca. */}
        {semPonto > 0 ? (
          <p>
            <strong className="text-text">
              {semPonto} {semPonto === 1 ? "não tem" : "não têm"} ponto de caça no mapa
            </strong>{" "}
            — {semPonto === 1 ? "chega-se a ele" : "chega-se a eles"} por evolução, loja,
            cassino ou evento. {comPonto.length}{" "}
            {comPonto.length === 1 ? "aparece" : "aparecem"} para caçar.
          </p>
        ) : (
          <p>Todos os {daFaixa.length} têm ponto de caça no mapa.</p>
        )}
        {maisRico && maisRico.value > 0 ? (
          <p>
            O que paga mais por abate é{" "}
            <Link href={`/dex/${maisRico.id}`} className="text-accent underline underline-offset-4">
              {maisRico.name}
            </Link>
            , com {gold(maisRico.value)} de ouro
            {maisRico.valueFromNpc ? " (preço de NPC — essa espécie não se caça)" : ""}.
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {daFaixa.map((e, i) => (
          <PokeCard key={e.id} e={e} ceiling={bounds.statCeiling} priority={i < 8} index={i} />
        ))}
      </div>

      <nav className="panel flex flex-col gap-3 p-4">
        <h2 className="pix text-[12px] text-text-dim">As outras raridades</h2>
        <div className="flex flex-wrap gap-2">
          {RARITY_ORDER.filter((x) => x !== r).map((x) => (
            <Link
              key={x}
              href={caminhoDaRaridade(x)}
              className="pix flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
              style={{
                color: RARITY_COLOR[x],
                borderColor: `color-mix(in oklab, ${RARITY_COLOR[x]} 45%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${RARITY_COLOR[x]} 12%, transparent)`,
              }}
            >
              <IconGem size={13} />
              {RARITY_LABEL[x]}
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
