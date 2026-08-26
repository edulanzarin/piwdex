import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dataLonga } from "@/lib/atualizacoes";
import { PATCHES, patchPorId } from "@/lib/patches-data";
import { alvosTocados, frase, type Patch } from "@/lib/patches";
import { PatchBrowser } from "@/components/patch-browser";
import { JsonLd, trilha } from "@/lib/jsonld";
import { Badge, IconChevronRight, Note, PageHeader, SkeletonForm } from "@/components/ui";
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
 * A página é a casca — data, ressalvas e o que a entrada não conta. O corpo é
 * `PatchBrowser`, que é cliente porque a pergunta de quem chega aqui é quase
 * sempre um recorte ("mexeram no meu bicho?", "quais drops sumiram?"), e recorte
 * que não se faz na tela se faz no Ctrl+F.
 */
export default async function PatchPage({ params }: Props) {
  const { id } = await params;
  const patch = patchPorId(id);
  if (!patch) notFound();

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
        actions={patch.avisos.length ? <Badge tone="warn">EM CONFERÊNCIA</Badge> : null}
      />

      {/* Os avisos vêm ANTES do conteúdo, e não num rodapé. Um bloco que pode
          não ser patch do jogo tem que ser lido como duvidoso desde a primeira
          linha — ressalva depois da tabela chega tarde. */}
      {patch.avisos.map((a) => (
        <Note key={a} tone="warn">
          {a}
        </Note>
      ))}

      {patch.cortadas ? (
        <Note>
          Esta entrada guarda as {patch.mudancas.length.toLocaleString("pt-BR")}{" "}
          mudanças de maior efeito. Outras {patch.cortadas.toLocaleString("pt-BR")}{" "}
          ficaram de fora por teto de tamanho — todas de efeito menor que as
          listadas, e nenhuma delas some sem esta linha dizer que sumiu.
        </Note>
      ) : null}

      {/* `useSearchParams` numa página estática precisa de fronteira: sem ela o
          build inteiro cai pra dinâmico, e esta é justamente a tela que podia
          ser servida pronta. */}
      <Suspense fallback={<SkeletonForm />}>
        <PatchBrowser patch={patch} />
      </Suspense>

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

/**
 * O intervalo que a entrada cobre — a ressalva mais importante da página: o
 * diário compara duas fotos, então tudo que aconteceu ENTRE elas aparece com a
 * data da segunda.
 *
 * Quando as duas leituras caem no mesmo dia, a frase passa a falar em HORA. A
 * primeira versão dizia "entre 20 de agosto de 2026 e 20 de agosto de 2026 (as
 * duas leituras são do mesmo dia)", que gasta duas linhas pra admitir que não
 * disse nada — e o intervalo real (03h47 até 04h16) estava ali o tempo todo.
 */
function Intervalo({ patch }: { patch: Patch }) {
  if (!patch.desde) return <>O que o jogo mudou nesta passada.</>;

  const de = local(patch.desde);
  const ate = local(patch.quando);
  if (!de || !ate) return <>O que o jogo mudou nesta passada.</>;

  if (de.dia === ate.dia) {
    return (
      <>
        Tudo que o jogo mudou entre {de.hora} e {ate.hora} de {dataLonga(ate.dia)}.
      </>
    );
  }
  return (
    <>
      Tudo que o jogo mudou entre {dataLonga(de.dia)} e {dataLonga(ate.dia)}.
    </>
  );
}

/**
 * Dia e hora de um instante, os dois no MESMO fuso.
 *
 * A primeira versão comparava os dias pelo recorte do ISO (que é UTC) e
 * imprimia a hora em São Paulo. As duas leituras do patch de 20/08 caem em
 * 00h47 e 04h16 UTC, ou seja, 21h47 do dia 19 e 01h16 do dia 20 aqui — e a
 * frase saía "entre 21:47 e 01:16 de 20 de agosto", carimbando no dia 20 uma
 * hora que é do dia 19. Misturar fuso numa frase que fala de tempo é o jeito
 * mais barato de a página mentir sem errar nenhum número.
 */
function local(iso: string): { dia: string; hora: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const FUSO = "America/Sao_Paulo";
  // `en-CA` devolve AAAA-MM-DD, que é o formato que o `dataLonga` espera.
  return {
    dia: d.toLocaleDateString("en-CA", { timeZone: FUSO }),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }),
  };
}

