import type { Metadata } from "next";
import Link from "next/link";
import { getData } from "@/lib/data";
import { dataLonga } from "@/lib/atualizacoes";
import { dia, PATCHES, pendente, ultimoPatch } from "@/lib/patches-data";
import { alvosTocados, frase, naturezaLabel, resumo, type Patch } from "@/lib/patches";
import { JsonLd, trilha } from "@/lib/jsonld";
import { Badge, Chip, Empty, IconChevronRight, Note, PageHeader, Panel } from "@/components/ui";
import { Newspaper as IconPatch } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: "/patches" },
  // "poke idle world patch notes" e "o que mudou no poke idle world" sao buscas
  // de intencao clara, e o jogo nao publica changelog nenhum — esta pagina e a
  // unica resposta que existe pra elas.
  title: "Patches do Poke Idle World — o que o jogo mudou, e quando",
  description:
    "O diário do catálogo: cada vez que o Poke Idle World mexeu em stat, drop, XP ou ouro " +
    "por abate, com a data e o número de antes e o de depois. Gerado da fonte do jogo, " +
    "não escrito à mão.",
};

// Dinamica porque a pagina compara o diario com o carimbo AO VIVO do catalogo —
// e esse carimbo e a unica coisa aqui que muda sem eu escrever nada.
export const dynamic = "force-dynamic";

/**
 * O DIÁRIO DO CATÁLOGO.
 *
 * A `/atualizacoes` conta o que eu mudei; esta conta o que o JOGO mudou. São
 * páginas separadas porque são naturezas separadas, e misturá-las custaria a
 * única coisa que cada uma tem de bom: "consertei um cálculo" e "o jogo nerfou o
 * Ledian em 13x" pedem confianças diferentes de quem lê. Uma é minha culpa, a
 * outra não é minha nem culpa de ninguém — é o jogo andando.
 *
 * O jogo não publica changelog. Então isto aqui não concorre com nada: ou o
 * jogador percebe sozinho que a caçada rendeu menos, ou não percebe.
 */
export default async function PatchesPage() {
  const db = await getData();
  const atrasado = pendente(db.generatedAt);
  const ultimo = ultimoPatch();
  const catalogoEm = dia(db.generatedAt);

  return (
    <div className="flex flex-col gap-4">
      <JsonLd dado={trilha([{ nome: "Patches", caminho: "/patches" }])} />

      <PageHeader
        title="Patches do jogo"
        icon={<IconPatch size={22} />}
        lead={
          ultimo
            ? `Toda vez que o Poke Idle World mexe no catálogo, o que mudou entra aqui. O último foi em ${dataLonga(ultimo.data)}.`
            : "Toda vez que o Poke Idle World mexer no catálogo, o que mudou entra aqui."
        }
        actions={
          <Badge tone={db.live ? "ok" : "warn"} pulse={db.live}>
            {db.live ? "CATÁLOGO AO VIVO" : "SNAPSHOT"}
          </Badge>
        }
      />

      <Note>
        Isto não é escrito à mão: o site compara o catálogo do jogo com o que
        tinha antes e conta a diferença. Ele só enxerga o que a fonte publica —
        se o jogo mudar uma regra sem mudar um número, não há o que comparar, e
        esta página fica quieta.
      </Note>

      {atrasado ? (
        <Note tone="warn">
          O jogo publicou catálogo
          {catalogoEm ? ` em ${dataLonga(catalogoEm)}` : " depois do último registro"},
          e essa passada ainda não entrou no diário. Ou a rotina que registra
          ainda não rodou, ou o que mudou não é comparável — em nenhum dos dois
          casos a lista abaixo está completa.
        </Note>
      ) : null}

      {PATCHES.length === 0 ? (
        <Empty
          title="O diário ainda não tem patch nenhum"
          hint="Ele começa a encher no primeiro patch depois de hoje: é preciso ter dois catálogos pra haver diferença entre eles."
          arte="espera"
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {PATCHES.map((p) => (
            <li key={p.id}>
              <CartaoPatch patch={p} />
            </li>
          ))}
        </ol>
      )}

      <Link
        href="/atualizacoes"
        className="pix inline-flex w-fit items-center gap-1.5 rounded-pill border border-line px-3 py-2 text-[10px] tracking-[0.1em] text-text-dim transition-colors hover:border-accent hover:text-text"
      >
        O QUE MUDOU NO SITE
        <IconChevronRight size={14} />
      </Link>
    </div>
  );
}

/** Quantas frases do patch cabem no cartão antes de ele virar a própria ficha. */
const NA_CHAMADA = 4;

function CartaoPatch({ patch }: { patch: Patch }) {
  const especies = alvosTocados(patch, "especie");
  const itens = alvosTocados(patch, "item");
  const spots = alvosTocados(patch, "spot");
  const naturezas = resumo(patch).slice(0, 4);
  const total = patch.mudancas.length + patch.cortadas;

  return (
    <Panel
      className="border-l-2 border-l-accent"
      title={<time dateTime={patch.data}>{dataLonga(patch.data)}</time>}
      actions={
        patch.avisos.length ? (
          <Badge tone="warn">EM CONFERÊNCIA</Badge>
        ) : (
          <span className="num text-[12px] text-text-mute">
            {total.toLocaleString("pt-BR")} mudanças
          </span>
        )
      }
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {especies ? <Chip>{especies} espécies</Chip> : null}
        {itens ? <Chip>{itens} itens</Chip> : null}
        {spots ? <Chip>{spots} pontos de caça</Chip> : null}
        {naturezas.map((n) => (
          <Chip key={n.natureza} className="text-text-mute">
            {naturezaLabel(n.natureza)} ({n.n})
          </Chip>
        ))}
      </div>

      {/* As frases de maior impacto, e não as primeiras: o cartão tem que abrir
          pela linha que troca a decisão de quem lê, não pela espécie de menor
          pokeId que por acaso mudou 1 de XP. A ordem já vem do arquivo. */}
      <ul className="flex flex-col gap-1.5">
        {patch.mudancas.slice(0, NA_CHAMADA).map((m, i) => (
          <li
            key={`${m.alvo.familia}-${m.alvo.id}-${m.natureza}-${m.detalhe ?? i}`}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-text-dim"
          >
            <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
            {frase(m)}
          </li>
        ))}
      </ul>

      <Link
        href={`/patches/${patch.id}`}
        className="pix inline-flex w-fit items-center gap-1.5 text-[11px] text-accent transition-opacity hover:opacity-80"
      >
        VER O PATCH INTEIRO
        <IconChevronRight size={14} />
      </Link>
    </Panel>
  );
}
