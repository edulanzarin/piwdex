import type { Metadata } from "next";
import Link from "next/link";
import { getData } from "@/lib/data";
import { dataLonga } from "@/lib/atualizacoes";
import { dia, PATCHES, pendente, ultimoPatch } from "@/lib/patches-data";
import {
  alvosTocados,
  combina,
  frase,
  naturezaLabel,
  porImpacto,
  resumo,
  semAcento,
  type Mudanca,
  type Patch,
} from "@/lib/patches";
import { JsonLd, trilha } from "@/lib/jsonld";
import {
  Badge,
  Button,
  Chip,
  Empty,
  IconChevronRight,
  Note,
  PageHeader,
  Panel,
  SearchInput,
} from "@/components/ui";
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
 * ## A busca é do SERVIDOR, e é decisão de peso
 *
 * A pergunta que mais vai chegar aqui não é "o que mudou em agosto" — é "já
 * mexeram no Ledian alguma vez?". Isso atravessa TODOS os patches, e cada patch
 * guarda até 1.200 mudanças (o de 20/08 sozinho ocupa 300 KB em disco).
 *
 * Filtrar isso no cliente exigiria embarcar o diário inteiro em toda visita, e o
 * custo cresceria a cada patch novo — a página ficaria mais pesada justamente
 * porque o projeto deu certo. Um `<form method="get">` resolve no servidor, sem
 * um byte de JavaScript, ainda deixa a busca funcionar com o JS desligado e
 * vira link compartilhável de graça.
 */
export default async function PatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [db, params] = await Promise.all([getData(), searchParams]);
  const q = (params.q ?? "").trim();

  const atrasado = pendente(db.generatedAt);
  const ultimo = ultimoPatch();
  const catalogoEm = dia(db.generatedAt);

  // Com busca, cada patch aparece só com as linhas que casam — e some da lista
  // quando não casa nenhuma. Sem busca, o cartão mostra o que mais mexeu.
  const achados = q
    ? PATCHES.map((p) => ({
        patch: p,
        linhas: p.mudancas.filter((m) => combina(m, q)).sort(porImpacto),
      })).filter((r) => r.linhas.length > 0)
    : PATCHES.map((p) => ({ patch: p, linhas: [] as Mudanca[] }));

  const totalAchado = achados.reduce((s, r) => s + r.linhas.length, 0);

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

      {PATCHES.length > 0 ? (
        <Panel bodyClassName="flex flex-col gap-2">
          {/* GET, e não ação de cliente: a busca atravessa o diário inteiro e o
              diário mora no servidor. Ver o cabeçalho do arquivo. */}
          <form action="/patches" method="get" className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <SearchInput
                name="q"
                defaultValue={q}
                placeholder="Procurar uma espécie, item ou drop em todos os patches…"
                aria-label="Procurar no diário"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              procurar
            </Button>
            {q ? (
              <Link
                href="/patches"
                className="pix tap text-[11px] text-text-mute transition-colors hover:text-accent"
              >
                limpar
              </Link>
            ) : null}
          </form>

          {q ? (
            <p className="pix text-[11px] text-text-mute">
              {totalAchado.toLocaleString("pt-BR")}{" "}
              {totalAchado === 1 ? "mudança" : "mudanças"} em {achados.length}{" "}
              {achados.length === 1 ? "patch" : "patches"} para “{q}”
            </p>
          ) : null}
        </Panel>
      ) : null}

      {PATCHES.length === 0 ? (
        <Empty
          title="O diário ainda não tem patch nenhum"
          hint="Ele começa a encher no primeiro patch depois de hoje: é preciso ter dois catálogos pra haver diferença entre eles."
          arte="espera"
        />
      ) : achados.length === 0 ? (
        <Empty
          title={`Nenhum patch mexeu em “${q}”`}
          hint="O diário procura por nome de espécie, de item, de drop e de golpe. Pode ser que o jogo nunca tenha tocado nisso — ou que tenha tocado antes de o diário existir."
          action={
            <Link href="/patches">
              <Button variant="outline" size="sm">
                ver todos os patches
              </Button>
            </Link>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {achados.map(({ patch, linhas }) => (
            <li key={patch.id}>
              <CartaoPatch patch={patch} termo={q} linhas={linhas} />
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

function CartaoPatch({
  patch,
  termo,
  linhas,
}: {
  patch: Patch;
  /** o que foi procurado; vazio = a lista normal */
  termo: string;
  /** as linhas que casaram com a busca, já ordenadas */
  linhas: Mudanca[];
}) {
  const especies = alvosTocados(patch, "especie");
  const itens = alvosTocados(patch, "item");
  const spots = alvosTocados(patch, "spot");
  const naturezas = resumo(patch).slice(0, 4);
  const total = patch.mudancas.length + patch.cortadas;

  const mostrar = termo ? linhas.slice(0, NA_CHAMADA) : patch.mudancas.slice(0, NA_CHAMADA);
  const sobrando = termo ? linhas.length - mostrar.length : 0;

  // Buscou: o link leva o termo junto, e a ficha abre já recortada. Sem isso, o
  // "ver o patch inteiro" jogaria a pessoa nas 1.200 linhas e ela procuraria de
  // novo — a segunda vez, na mão.
  const href = termo
    ? `/patches/${patch.id}?q=${encodeURIComponent(termo)}`
    : `/patches/${patch.id}`;

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

      {/* Sem busca, as frases de maior impacto — e não as primeiras: o cartão
          tem que abrir pela linha que troca a decisão de quem lê. Com busca, as
          que casaram, porque a pergunta já foi feita. */}
      <ul className="flex flex-col gap-1.5">
        {mostrar.map((m, i) => (
          <li
            key={`${m.alvo.familia}-${m.alvo.id}-${m.natureza}-${m.detalhe ?? i}`}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-text-dim"
          >
            <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
            <Realce texto={frase(m)} termo={termo} />
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className="pix inline-flex w-fit items-center gap-1.5 text-[11px] text-accent transition-opacity hover:opacity-80"
      >
        {sobrando > 0
          ? `VER AS OUTRAS ${sobrando.toLocaleString("pt-BR")} DESTE PATCH`
          : "VER O PATCH INTEIRO"}
        <IconChevronRight size={14} />
      </Link>
    </Panel>
  );
}

/**
 * Marca o termo procurado dentro da frase.
 *
 * Sem isto, uma busca por "Straw" devolve seis linhas quase idênticas e a pessoa
 * relê as seis pra achar onde a palavra dela está. O corte é feito na string SEM
 * ACENTO (é ela que casa com a busca) e aplicado por índice na original, senão
 * procurar "cocoon" não acharia nada num nome acentuado.
 */
function Realce({ texto, termo }: { texto: string; termo: string }) {
  const t = semAcento(termo.trim());
  if (!t) return <>{texto}</>;
  const alvo = semAcento(texto);
  const i = alvo.indexOf(t);
  if (i < 0) return <>{texto}</>;
  return (
    <span>
      {texto.slice(0, i)}
      <mark className="bg-accent/22 text-text">{texto.slice(i, i + t.length)}</mark>
      {texto.slice(i + t.length)}
    </span>
  );
}
