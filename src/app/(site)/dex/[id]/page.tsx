import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cn } from "@/lib/cn";
import { chanceToPct, getData } from "@/lib/data";
import { getDexPayload } from "@/lib/dex-data";
import { buildEntry, rolesOf } from "@/lib/dex";
import { resumoDaEspecie } from "@/lib/prosa";
import { JsonLd, trilha } from "@/lib/jsonld";
import { assetIconUrl, officialArtUrl, spriteUrl } from "@/lib/sprites";
import { RARITY_COLOR, TYPE_COLOR, defensiveDetailed, offensiveDetailed } from "@/lib/typing";
import { projectAll } from "@/lib/stats";
import {
  Chip,
  IconChevronRight,
  IconCoin,
  IconEvolve,
  IconPin,
  Note,
  Panel,
  Sprite,
  StatBar,
  Tooltip,
} from "@/components/ui";
import { TypeBadge, TypeMultChip } from "@/components/type-icon";
import { caminhoDoTipo } from "@/lib/tipo-url";
import { caminhoDaRaridade } from "@/lib/raridade-url";
import { CategoryIcon, IconAtk, IconBag, IconDef as IconDefShield, IconGem, IconLevel, IconScale, IconTarget, IconTm, IconWeak, IconXp, STAT_ICONS, SeloRaro } from "@/components/game-icons";
import {
  CATEGORY_LABEL,
  RARITY_LABEL,
  ROLE_LABEL,
  STAT_LABEL,
  TYPE_LABEL,
  compact as gold,
  multWord,
  num,
} from "@/lib/labels";

// As ~910 fichas sao CACHEAVEIS, e isso e o maior ganho tecnico do site.
//
// Elas eram `force-dynamic`, entao todo rastreio batia na origem e renderizava do
// zero. O sitemap anuncia ~910 URLs: um rastreamento completo era ~910 renders
// para um conteudo que so muda quando o JOGO publica patch — talvez uma vez por
// semana. Isso queima orcamento de rastreio, que e a coisa que decide quantas das
// suas paginas o buscador se da ao trabalho de reler.
//
// `force-static` + `revalidate`: a pagina e gerada na primeira visita e servida do
// cache por uma hora. Nao ha selo de frescor nesta tela (so nas de catalogo), entao
// cachear nao faz nenhuma parte dela mentir — o que ela afirma sobre a especie
// continua verdade ate o proximo patch.
//
// **`dynamicParams` fica LIGADO** (o padrao) de proposito: sem `generateStaticParams`,
// nada e pre-renderizado no build. Pre-renderizar as 910 no build custaria o build
// inteiro e a maior parte delas nunca e visitada. Assim cada ficha paga um render na
// primeira visita e fica barata pra sempre depois.
//
// O piso de carregamento saiu junto, e tinha de sair por dois motivos. Ele le o
// User-Agent via `headers()`, que e API de request e sozinha ja impede o cache; e
// pagina cacheada nao tem tela de carregamento pra justificar o atraso.
export const dynamic = "force-static";
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = await getData();
  const c = db.getCreature(Number(id));
  // O ramo de erro NAO ganha canonical: pagina que nao existe nao pode declarar
  // ser a versao boa de nada.
  if (!c) return { title: "Pokémon não encontrado" };
  return {
    // O titulo carrega a PERGUNTA e o JOGO, nao so o nome.
    //
    // A pergunta ja estava aqui: quem procura digita "onde pegar", "stats",
    // "drop", e o nome sozinho nao encosta em nenhuma delas. O que faltava era o
    // nome do jogo — e ele estava no `og:title` logo abaixo, que e o lugar
    // errado. OpenGraph pinta card de rede social; quem o buscador casa com a
    // consulta e o `<title>`. Alguem que digita "bulbasaur poke idle world" via
    // uma pagina cujo titulo nao dizia "poke idle world" em lugar nenhum.
    //
    // `absolute` desliga o sufixo " · PIWdex" do layout de proposito: com o nome
    // do jogo dentro, o titulo ja bate em 56 caracteres, e o buscador corta perto
    // de 60. Entre gastar os ultimos caracteres com uma marca que ainda nao
    // significa nada pra ninguem ou com o termo que a pessoa digitou, e o termo.
    title: { absolute: `${c.name} no Poke Idle World — onde pegar, stats e drops` },
    description: resumoDaEspecie(c, db).descricao,
    alternates: { canonical: `/dex/${c.pokeId}` },
    openGraph: {
      type: "article",
      title: `${c.name} — Poke Idle World`,
      description: resumoDaEspecie(c, db).descricao,
      url: `/dex/${c.pokeId}`,
    },
  };
}

export default async function CreaturePage({ params }: Props) {
  const { id } = await params;
  const db = await getData();
  const c = db.getCreature(Number(id));
  if (!c) notFound();

  const resumo = resumoDaEspecie(c, db);
  // A mesma trilha que o `<nav>` logo abaixo desenha, dita no formato que o
  // rastreador le. As URLs saem da mesma string do canonical: duas verdades
  // sobre qual e a URL da pagina e pior que nenhuma.
  const migalhas = trilha([
    { nome: "PIWdex", caminho: "/" },
    { nome: "Pokédex", caminho: "/dex" },
    { nome: c.name, caminho: `/dex/${c.pokeId}` },
  ]);

  // Mesmo teto de barra do grid: um stat 65 tem de desenhar igual na ficha e no
  // card. Usar o proprio maximo da especie faria o Bulbasaur parecer no teto.
  const { bounds } = await getDexPayload();

  const e = buildEntry(c, {
    spotsOf: (x) => db.locationsOf(x).length,
    acquisitionOf: db.acquisitionOf,
    chainOf: (x) => db.evolutionChainOf(x).map((s) => ({ pokeId: s.creature.pokeId })),
  });

  const spots = db.locationsOf(c);
  const chain = db.evolutionChainOf(c);
  const { weak, resist, immune } = defensiveDetailed(c.type1, c.type2);
  const strong = offensiveDetailed(c.type1, c.type2);
  const roles = rolesOf(e);

  // Ordena golpes por poder, separando os dois pools. A separacao nao e detalhe:
  // TODO golpe de poder 600 do jogo e de TM, e misturar promete um DPS que quem
  // nao tem a maquina nao possui.
  const natural = c.attacks.filter((a) => !a.tm).sort((a, b) => b.power - a.power);
  const machine = c.attacks.filter((a) => a.tm).sort((a, b) => b.power - a.power);

  const drops = [...c.loot].sort((a, b) => b.chance - a.chance);

  // Projecao com IV perfeito (32) e Quality 1.0 — a referencia de teto que a
  // calculadora depois compara contra o pokemon real do jogador.
  const perfect = projectAll(e.stats, [32, 32, 32, 32, 32, 32], 100, 1);


  return (
    <div className="flex flex-col gap-4">
      <JsonLd dado={migalhas} />
      <nav className="flex items-center gap-1.5 text-[13px] text-text-mute">
        <Link href="/dex" className="tap transition-colors hover:text-accent">
          Pokedex
        </Link>
        <IconChevronRight size={14} />
        <span className="text-text-dim">{c.name}</span>
      </nav>

      {/* ---- identidade ---- */}
      {/* ---- a CHEGADA da ficha, no tratamento de pagina de campeao ----

          Era um cabeçalho em linha: arte de 128 à esquerda, e à direita um bloco
          de #número, nome de 24px, seis chips e um parágrafo — tudo alinhado à
          esquerda, tudo do mesmo peso. Lia como registro de catálogo.

          A referência resolve isso invertendo o eixo: a arte vira CENA (grande,
          centralizada, com a cor por trás), o nome vem em corpo de display com
          tracking largo, e o epíteto vem ABAIXO, pequeno, separado por um fio
          com ornamento. Não é mais denso — é a mesma informação com uma ordem de
          leitura declarada, e um lugar óbvio pra o olho pousar primeiro. */}
      <header className="panel relative flex flex-col items-center gap-5 px-4 py-8 text-center sm:px-8 sm:py-10">
        <div className="relative grid shrink-0 place-items-center">
          <span
            aria-hidden="true"
            className="anim-glow absolute h-28 w-28 rounded-full blur-2xl"
            style={{ backgroundColor: RARITY_COLOR[c.rarity] }}
          />
          {/* O gif animado do gen5 so existe ate ~id 649; acima disso o
              `Sprite` cai sozinho no estatico. Vale a tentativa: pokemon parado
              numa ficha e catalogo, pokemon que respira e jogo. */}
          {/* Na CHEGADA da ficha entra a arte OFICIAL em alta, e nao o sprite do
              jogo. Aqui nao ha nada a reconhecer — o nome esta escrito em 46px
              logo abaixo — e ha muito a mostrar, que e o oposto da situacao da
              grade. Ver `officialArtUrl` pro porque ela NAO vai pra grade.
              Quando nao ha render (variante de skin), cai na arte do jogo
              sozinho: melhor a arte menor e certa do que a maior e de outro
              bicho. */}
          <Sprite
            src={officialArtUrl(c.pokeId) ?? spriteUrl(c.pokeId)}
            alt={c.name}
            size={240}
            priority
            /* `pixel={false}`: render em alta escalado com `image-rendering:
               pixelated` fica serrilhado. A suavizacao e pra ele; o pixelado
               continua valendo pro sprite do jogo, que e pixel art de verdade. */
            pixel={!officialArtUrl(c.pokeId)}
            className="anim-float relative [--sprite:180px] sm:[--sprite:240px]"
          />
        </div>

        <div className="flex min-w-0 w-full flex-col items-center gap-3">
          <span className="pix text-[11px] tracking-[0.18em] text-text-mute">
            #{String(c.pokeId).padStart(3, "0")}
            {c.area ? ` · ${c.area}` : ""}
          </span>

          {/* O nome em corpo de CENA, com tracking largo. Ele nao usa o italico do
              `DisplayTitle` de proposito: nome proprio de pokemon nao e manchete,
              e inclinar um substantivo que a pessoa veio procurar atrapalha o
              reconhecimento. O que da a escala e o corpo e o espaco entre letras,
              nao a inclinacao. */}
          <h1 className="pix text-[34px] leading-none tracking-[0.14em] text-text sm:text-[46px]">
            {c.name}
          </h1>

          {/* O fio com ornamento, que e o que separa nome de epiteto na
              referencia. O losango no meio nao e enfeite solto: ele marca o eixo
              central e da ao fio um comeco e um fim, senao a linha parece uma
              borda mal cortada. */}
          <span aria-hidden="true" className="flex w-full max-w-md items-center gap-3">
            <span
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, transparent, ${RARITY_COLOR[c.rarity]})`,
              }}
            />
            <span
              className="h-1.5 w-1.5 rotate-45"
              style={{ backgroundColor: RARITY_COLOR[c.rarity] }}
            />
            <span
              className="h-px flex-1"
              style={{
                background: `linear-gradient(270deg, transparent, ${RARITY_COLOR[c.rarity]})`,
              }}
            />
          </span>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {/* O selo de tipo vira LINK pro hub daquele tipo.
                Nao e enfeite de navegacao: e o que liga esta folha as outras
                do mesmo tipo sem passar pela lista filtrada, e o que da ao
                rastreador um caminho curto entre as ~910 fichas. */}
            <Link href={caminhoDoTipo(c.type1)} aria-label={`Ver todos os pokémon de ${TYPE_LABEL[c.type1]}`}>
              <TypeBadge type={c.type1} />
            </Link>
            {c.type2 ? (
              <Link href={caminhoDoTipo(c.type2)} aria-label={`Ver todos os pokémon de ${TYPE_LABEL[c.type2]}`}>
                <TypeBadge type={c.type2} />
              </Link>
            ) : null}
            {/* Mesma logica do selo de tipo: o chip de raridade leva ao hub
                dela. Cada ficha passa a ter DUAS saidas pra outras fichas. */}
            <Link
              href={caminhoDaRaridade(c.rarity)}
              aria-label={`Ver todos os pokémon ${RARITY_LABEL[c.rarity].toLowerCase()}`}
            >
              <Chip tint={RARITY_COLOR[c.rarity]} icon={<IconGem size={14} />}>
                {RARITY_LABEL[c.rarity]}
              </Chip>
            </Link>
            {roles.map((r) => (
              <Chip key={r}>{ROLE_LABEL[r] ?? r}</Chip>
            ))}
            {e.hasTm ? (
              <Chip tone="neon" icon={<IconTm size={14} />}>
                aprende TM
              </Chip>
            ) : null}
          </div>

          {/* O catalogo do jogo entrega `description: "a bulbasaur"` — as 482 sao
              esse molde. No lugar dele entra a prosa DERIVADA do dado que esta
              nesta pagina: de onde ele vem, pra onde evolui, o drop mais
              frequente com a chance real, o que o abate paga. Ver `lib/prosa.ts`. */}
          <p className="mx-auto max-w-2xl text-[14px] leading-relaxed text-text-dim">
            {resumo.frases.join(" ")}
          </p>

          <dl className="mt-2 grid w-full grid-cols-2 gap-px overflow-hidden rounded-pix border border-line bg-line sm:grid-cols-4">
            {[
              { label: "nível de caça", value: c.huntLevel || "—", icon: <IconLevel size={15} /> },
              {
                // Declara qual grandeza esta na tela: `sellValue` (o que o jogo
                // paga por abate) e `priceNpc` (preco do cassino) nao se
                // comparam, e o rotulo unico faz a ficha se contradizer.
                label: e.valueFromNpc ? "preço de npc" : "venda por abate",
                value: e.value > 0 ? gold(e.value) : "—",
                icon: <IconCoin size={15} />,
                tone: e.valueFromNpc ? "text-text-dim" : "text-warn",
              },
              { label: "xp por abate", value: c.experience || "—", tone: "text-neon", icon: <IconXp size={15} /> },
              {
                label: "total de stats",
                value: e.statTotal,
                icon: <IconScale size={15} />,
                tone: "text-accent",
              },
            ].map((s) => (
              /* Numero e rotulo no MESMO eixo.
                 O rotulo herdou o `text-center` do cabeçalho novo e o número não
                 — ficou colado à esquerda com a palavra centralizada embaixo, e
                 duas âncoras diferentes na mesma célula fazem a grade parecer
                 desalinhada mesmo com as quatro células do mesmo tamanho. */
              <div key={s.label} className="flex flex-col items-center gap-1 bg-surface px-3 py-2.5">
                <dd
                  className={`num flex items-center gap-1.5 text-[19px] leading-none font-semibold ${s.tone ?? "text-text"}`}
                >
                  {s.icon}
                  {s.value}
                </dd>
                <dt className="pix text-[10px] tracking-[0.14em] text-text-mute">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* ---- stats ---- */}
        <Panel
          className="h-full"
          title={
            <span className="flex items-center gap-2">
              <IconScale size={16} />
              Stats base
            </span>
          }
          actions={<span className="text-[13px] text-text-mute tabular">{e.statTotal}</span>}
        >
          <div className="flex flex-col gap-1.5">
            {e.stats.map((v, i) => {
              const Icon = STAT_ICONS[i];
              return (
                <StatBar
                  key={i}
                  label={STAT_LABEL[i]}
                  icon={<Icon size={9} />}
                  value={v}
                  max={bounds.statCeiling}
                  tint={TYPE_COLOR[c.type1]}
                />
              );
            })}
          </div>
          {/* So o DADO. A frase que explicava "IV e Quality sao por individuo,
              o catalogo so define a base" saiu — quem joga ja sabe, e quem nao
              sabe nao aprende num rodape de painel. */}
          <Note flush icon={null} className="mt-3">
            Nível 100, IV perfeito:{" "}
            <span className="text-text-dim tabular">{perfect.sum}</span> de soma,{" "}
            <span className="text-accent tabular">{perfect.power}</span> de Poder.
          </Note>
        </Panel>

        {/* ---- defesa ---- */}
        <Panel className="h-full" title={<span className="flex items-center gap-2"><IconWeak size={16} />Como apanha</span>}>
          {weak.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[11px] text-danger"><IconWeak size={15} />fraco contra</p>
              <div className="flex flex-wrap gap-1">
                {weak.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-danger" />
                ))}
              </div>
            </div>
          ) : null}

          {resist.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[11px] text-ok"><IconDefShield size={15} />resiste a</p>
              <div className="flex flex-wrap gap-1">
                {resist.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-ok" />
                ))}
              </div>
            </div>
          ) : null}

          {immune.length ? (
            <div className="mb-3">
              <p className="pix mb-1.5 text-[11px] text-text-mute">imune a</p>
              <div className="flex flex-wrap gap-1">
                {immune.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-text-mute" />
                ))}
              </div>
            </div>
          ) : null}

          {strong.length ? (
            <div className="border-t border-line pt-3">
              {/* STAB (1.5x por golpe do proprio tipo) e coisa SEPARADA da
                  efetividade (x2/x0.5). Juntar os dois num numero so foi um erro
                  ja pago — aqui a lista e so cobertura de tipo. */}
              <p className="pix mb-1.5 flex items-center gap-1.5 text-[11px] text-accent"><IconTarget size={15} />bate forte em</p>
              <div className="flex flex-wrap gap-1">
                {strong.map((w) => (
                  <TypeMultChip key={w.type} m={w} tone="text-accent" />
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        {/* ---- evolucao ----
            O painel e SEMPRE renderizado, mesmo sem linha evolutiva. Antes ele
            sumia e o grid de duas colunas ficava com tres paineis: o "Onde
            caçar" pulava pra coluna da esquerda e a ficha do Mega Lucario nao
            tinha nada a ver com a do Bulbasaur. Estrutura de pagina nao pode
            depender do dado — o que muda e o CONTEUDO do painel. */}
        <Panel
          title={
            <span className="flex items-center gap-2">
              <IconEvolve size={16} />
              Linha evolutiva
            </span>
          }
          actions={
            chain.length > 1 ? (
              <span className="text-[13px] text-text-mute">{chain.length} estágios</span>
            ) : null
          }
          className="h-full"
        >
          {chain.length > 1 ? (
            /* A linha OCUPA o painel, e o CONECTOR tem coluna propria.
               Duas tentativas erradas antes desta, e as duas com o mesmo defeito
               por caminhos opostos:
               1. `flex-wrap` com caixa de largura fixa — tres estagios num painel
                  de 780px deixavam metade dele vazio a direita.
               2. Grade de fracoes iguais com a seta ancorada FORA do fluxo, na
                  borda entre celulas. Resolveu o vazio e criou outro: o "nv 40"
                  nao tinha largura reservada, entao ele cavalgava a borda do
                  cartao e saia cortado.
               O certo e a grade declarar as duas coisas: `1fr auto 1fr auto 1fr`
               — estagio elastico, conector do tamanho que ele precisa. Ninguem
               sai do fluxo, ninguem esmaga ninguem. */
            <ol
              className="grid items-stretch gap-y-3"
              style={{
                gridTemplateColumns: Array.from(
                  { length: chain.length * 2 - 1 },
                  (_, i) => (i % 2 === 0 ? "minmax(0, 1fr)" : "auto"),
                ).join(" "),
              }}
            >
              {chain.map((s, i) => (
                <Fragment key={s.creature.pokeId}>
                  {i > 0 ? (
                    <li
                      aria-hidden="true"
                      className="flex flex-col items-center justify-center gap-0.5 px-2 text-text-mute"
                    >
                      <IconChevronRight size={18} />
                      {s.evolveLevel ? (
                        <span className="num text-[10px] whitespace-nowrap">
                          nv {s.evolveLevel}
                        </span>
                      ) : null}
                    </li>
                  ) : null}
                  <li className="flex">
                    <Link
                      href={`/dex/${s.creature.pokeId}`}
                      title={s.creature.name}
                      className={cn(
                        "flex w-full flex-col items-center justify-center gap-2 rounded-pix border px-2 py-4",
                        "transition-[border-color,background-color,transform] duration-200",
                        "motion-safe:hover:-translate-y-0.5",
                        s.creature.pokeId === c.pokeId
                          ? "border-accent/60 bg-accent/10"
                          : "border-line hover:border-accent/40 hover:bg-surface-2",
                      )}
                    >
                      <Sprite
                        src={spriteUrl(s.creature.pokeId)}
                        alt={s.creature.name}
                        size={72}
                        className="[--sprite:56px] sm:[--sprite:72px]"
                      />
                      <span className="w-full truncate text-center text-[12px] text-text-dim">
                        {s.creature.name}
                      </span>
                    </Link>
                  </li>
                </Fragment>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] leading-relaxed text-text-mute">
              {c.name} não evolui e não vem de nenhuma evolução — é uma linha de um estágio só.
            </p>
          )}
        </Panel>

        {/* ---- onde cacar ---- */}
        <Panel
          className="h-full"
          title={<span className="flex items-center gap-2"><IconPin size={16} />Onde caçar</span>}
          actions={<span className="text-[13px] text-text-mute tabular">{spots.length}</span>}
        >
          {spots.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-text-mute">
              {e.acquisition === "evo"
                ? "Não aparece no mapa — só se consegue evoluindo."
                : "Não aparece no mapa nem por evolução: vem de loja, cassino, ovo ou evento."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {spots.map((h) => (
                <li
                  key={h.slug}
                  className="flex items-center gap-2 rounded-pix border border-line bg-bg-soft px-2 py-1.5"
                >
                  <IconPin size={16} className="shrink-0 text-ok" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-text">{h.name}</span>
                    <span className="text-[12px] text-text-mute">{h.area}</span>
                  </span>
                  <span className="pix shrink-0 text-[11px] text-text-dim tabular">nv {h.level}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- golpes ---- */}
      <Panel
        title={<span className="flex items-center gap-1.5"><IconAtk size={16} />Golpes</span>}
        actions={
          <span className="text-[13px] text-text-mute tabular">
            {natural.length} naturais{machine.length ? ` · ${machine.length} TM` : ""}
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line-strong">
                {["Golpe", "Tipo", "Categoria", "Poder", "Aprende"].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`pix px-3 py-2 text-[11px] text-text-mute ${i >= 3 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ...natural.map((a) => ({ a, tm: false })),
                ...machine.map((a) => ({ a, tm: true })),
              ].map(({ a, tm }) => (
                <tr key={`${a.name}-${a.learnLevel}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-[14px] text-text">
                    <span className="flex items-center gap-1.5">
                      {a.name}
                      {tm ? <Chip size="xs" tone="neon" icon={<IconTm size={14} />}>TM</Chip> : null}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <TypeBadge type={a.type} size="xs" />
                  </td>
                  <td className="px-3 py-1.5 text-[13px] text-text-mute">
                    <span className="flex items-center gap-1.5" title={CATEGORY_LABEL[a.category]}>
                      <CategoryIcon category={a.category} size={15} />
                      {CATEGORY_LABEL[a.category]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-[14px] text-accent tabular">{a.power}</td>
                  <td className="px-3 py-1.5 text-right text-[14px] text-text-dim tabular">
                    {tm ? "—" : a.learnLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Sem coluna de cooldown: o valor do catalogo e o cooldown BASE e a
            velocidade do pokemon o encurta no jogo, entao exibi-lo cru daria um
            numero errado. Fica so o comentario — o aviso na tela era ruido. */}
      </Panel>

      {/* ---- drops ---- */}
      <Panel
        title={<span className="flex items-center gap-1.5"><IconBag size={16} />Drops</span>}
        actions={<span className="text-[13px] text-text-mute tabular">{drops.length}</span>}
        bodyClassName="p-0"
      >
        {drops.length === 0 ? (
          <p className="p-3 text-[14px] text-text-mute">Não dropa nada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line-strong">
                  {["Item", "Chance", "Quantidade", "Valor NPC"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`pix px-3 py-2 text-[11px] text-text-mute ${i > 0 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drops.map((l) => {
                  const item = db.getItemByName(l.name);
                  // A fonte guarda `chance` na escala 0..100000 — a porcentagem
                  // real e /1000. E o numero exato que o piwtools nao mostra.
                  const pct = chanceToPct(l.chance);
                  return (
                    <tr key={l.name} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 text-[14px] text-text">
                        {/* A ponte de volta: daqui se chega em QUEM MAIS dropa o
                            mesmo item. A ficha da especie so sabe metade do par
                            — a outra metade e a pagina do item. */}
                        <span className="flex items-center gap-2">
                          {/* O ICONE do item, do proprio jogo.
                              A tabela listava seis nomes em texto puro enquanto a
                              grade de itens, o card e a ficha do item mostram a
                              arte — a mesma coisa aparecia com duas caras no
                              mesmo site. E aqui ela paga dobrado: quem le a lista
                              de drops esta decidindo o que farmar, e reconhecer
                              "Bag of Pollen" pela arte e mais rapido que ler.
                              Quando o item nao esta no catalogo (nome que a fonte
                              traz e a lista nao tem), nao ha icone nem reserva —
                              uma reserva generica afirmaria que o item existe e
                              que a arte falhou, e o caso e o contrario. */}
                          {item ? (
                            <Sprite
                              src={assetIconUrl(item.icon)}
                              alt=""
                              size={22}
                              fallback={null}
                              className="shrink-0"
                            />
                          ) : null}
                          {item ? (
                            <Link
                              href={`/itens/${item.id}`}
                              className="tap transition-colors hover:text-[var(--color-t-itens)]"
                            >
                              {l.name}
                            </Link>
                          ) : (
                            l.name
                          )}
                          {item?.rare ? <SeloRaro /> : null}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[14px] text-ok tabular">
                        <Tooltip content={`1 a cada ${Math.round(100 / pct).toLocaleString("pt-BR")} abates, na média`}>
                          <span>{pct < 0.01 ? num(pct, 4) : num(pct, 3)}%</span>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[14px] text-text-dim tabular">
                        {l.minCount === l.maxCount ? l.minCount : `${l.minCount}–${l.maxCount}`}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[14px] text-warn tabular">
                        {item?.npcPrice ? gold(item.npcPrice) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
