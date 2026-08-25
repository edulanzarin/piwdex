import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataLonga } from "@/lib/atualizacoes";
import { PATCHES, patchPorId } from "@/lib/patches-data";
import {
  alvosTocados,
  frase,
  naturezaLabel,
  porAlvo,
  resumo,
  type Alvo,
  type Mudanca,
  type Patch,
} from "@/lib/patches";
import { spriteUrl } from "@/lib/sprites";
import { JsonLd, trilha } from "@/lib/jsonld";
import { Badge, Chip, IconChevronRight, Note, PageHeader, Panel, Sprite } from "@/components/ui";
import { Newspaper as IconPatch } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

// A ficha de um patch nao muda depois de escrita — o passado nao recebe patch —,
// e por isso ela e das poucas telas do site que podem ser estaticas de verdade.
// `generateStaticParams` vale aqui (ao contrario das ~910 fichas de especie):
// sao poucas, e todas nascem do arquivo que ja esta no build.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ id: string }> {
  return PATCHES.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const patch = patchPorId(id);
  if (!patch) return { title: "Patch não encontrado" };

  const especies = alvosTocados(patch, "especie");
  const manchete = patch.mudancas[0] ? frase(patch.mudancas[0]) : "";
  return {
    alternates: { canonical: `/patches/${patch.id}` },
    title: `Patch de ${dataLonga(patch.data)} no Poke Idle World`,
    description:
      `O que o jogo mudou em ${dataLonga(patch.data)}: ${especies} espécies tocadas. ` + manchete,
  };
}

/**
 * A ficha de um patch.
 *
 * Ela se lê POR ALVO, e não por campo. "Todas as mudanças de ouro, depois todas
 * as de XP" é a organização natural do diff e a errada pra quem lê: ninguém abre
 * esta página perguntando "o que mudou de ouro", e sim "mexeram no bicho que eu
 * caço". Agrupado por espécie, a resposta é uma busca de página.
 */
export default async function PatchPage({ params }: Props) {
  const { id } = await params;
  const patch = patchPorId(id);
  if (!patch) notFound();

  const grupos = porAlvo(patch);
  const especies = alvosTocados(patch, "especie");
  const itens = alvosTocados(patch, "item");
  const spots = alvosTocados(patch, "spot");

  return (
    <div className="flex flex-col gap-4">
      <JsonLd
        dado={trilha([
          { nome: "Patches", caminho: "/patches" },
          { nome: dataLonga(patch.data), caminho: `/patches/${patch.id}` },
        ])}
      />

      <PageHeader
        title={`Patch de ${dataLonga(patch.data)}`}
        icon={<IconPatch size={22} />}
        lead={<Intervalo patch={patch} />}
        actions={
          patch.avisos.length ? <Badge tone="warn">EM CONFERÊNCIA</Badge> : null
        }
      />

      {/* Os avisos vêm ANTES do conteúdo, e não num rodapé. Um bloco que pode
          não ser patch do jogo tem que ser lido como duvidoso desde a primeira
          linha — ressalva depois da tabela chega tarde. */}
      {patch.avisos.map((a) => (
        <Note key={a} tone="warn">
          {a}
        </Note>
      ))}

      <Panel title="O tamanho do patch" bodyClassName="flex flex-wrap items-center gap-1.5">
        {especies ? <Chip tone="accent">{especies} espécies</Chip> : null}
        {itens ? <Chip tone="accent">{itens} itens</Chip> : null}
        {spots ? <Chip tone="accent">{spots} pontos de caça</Chip> : null}
        {resumo(patch).map((n) => (
          <Chip key={n.natureza}>
            {naturezaLabel(n.natureza)} ({n.n})
          </Chip>
        ))}
      </Panel>

      {patch.cortadas ? (
        <Note>
          Esta entrada guarda as {patch.mudancas.length.toLocaleString("pt-BR")}{" "}
          mudanças de maior efeito. Outras {patch.cortadas.toLocaleString("pt-BR")}{" "}
          ficaram de fora por teto de tamanho — todas de efeito menor que as
          listadas, e nenhuma delas some sem esta linha dizer que sumiu.
        </Note>
      ) : null}

      <ol className="flex flex-col gap-2">
        {grupos.map((g) => (
          <li key={`${g.alvo.familia}-${g.alvo.id}`}>
            <BlocoAlvo alvo={g.alvo} mudancas={g.mudancas} />
          </li>
        ))}
      </ol>

      <Link
        href="/patches"
        className="pix inline-flex w-fit items-center gap-1.5 rounded-pill border border-line px-3 py-2 text-[10px] tracking-[0.1em] text-text-dim transition-colors hover:border-accent hover:text-text"
      >
        TODOS OS PATCHES
        <IconChevronRight size={14} />
      </Link>
    </div>
  );
}

/** O intervalo que a entrada cobre. É a ressalva mais importante da página: o
 *  diário compara duas fotos, então tudo que aconteceu ENTRE elas aparece com a
 *  data da segunda. Esconder isso faria a página afirmar um dia que ela não sabe. */
function Intervalo({ patch }: { patch: Patch }) {
  if (!patch.desde) return <>O que o jogo mudou nesta passada.</>;
  const de = patch.desde.slice(0, 10);
  const ate = patch.quando.slice(0, 10);
  return (
    <>
      Tudo que o jogo mudou entre {dataLonga(de)} e {dataLonga(ate)}
      {de === ate ? " (as duas leituras são do mesmo dia)" : ""}.
    </>
  );
}

function rotaDo(alvo: Alvo): string | null {
  if (alvo.familia === "especie") return `/dex/${alvo.id}`;
  if (alvo.familia === "item") return `/itens/${alvo.id}`;
  return null;
}

function BlocoAlvo({ alvo, mudancas }: { alvo: Alvo; mudancas: Mudanca[] }) {
  const rota = rotaDo(alvo);
  const sprite = alvo.familia === "especie" ? spriteUrl(Number(alvo.id)) : null;

  const cabeca = (
    <span className="flex items-center gap-2">
      {sprite ? <Sprite src={sprite} alt="" size={28} className="[--sprite:28px]" /> : null}
      <span className="text-[14px] text-text">{alvo.nome}</span>
    </span>
  );

  return (
    <Panel
      title={
        rota ? (
          <Link href={rota} className="transition-colors hover:text-accent">
            {cabeca}
          </Link>
        ) : (
          cabeca
        )
      }
      bodyClassName="flex flex-col gap-1.5"
    >
      {mudancas.map((m, i) => (
        <p
          key={`${m.natureza}-${m.detalhe ?? i}`}
          className="flex items-start gap-2 text-[13px] leading-relaxed text-text-dim"
        >
          <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
          {frase(m)}
        </p>
      ))}
    </Panel>
  );
}
