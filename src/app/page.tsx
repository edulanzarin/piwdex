import type { Metadata } from "next";
import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import { ButtonLink, Chip, IconChevronRight, Pokeball, Sprite } from "@/components/ui";
import { BookOpen, Calculator, Egg, Package, Radar, Swords } from "lucide-react";

// A home canonicaliza pra RAIZ. Ela e a unica pagina cujo canonical o layout
// poderia acertar por acidente — e "por acidente" nao e contrato.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Esta rota e DINAMICA de proposito, e a declaracao precisa dizer isso.
 *
 * Antes havia aqui um `export const revalidate = 3600` que nao fazia nada: o
 * `fetchSource` busca com `cache: "no-store"` (lib/source.ts), o que ja tira a rota
 * do prerender — o `.next/prerender-manifest.json` do build so lista /privacidade,
 * /robots.txt e os icones. Ou seja, a linha anunciava "cacheada por 1 hora" enquanto
 * a pagina renderizava a cada request.
 *
 * O frescor nao mora aqui: mora no `source.ts`, que segura o catalogo em memoria e
 * repergunta ao jogo por ETag (um HEAD, zero byte). Render por request custa quase
 * nada porque o dado ja esta na memoria do processo — o que ele NAO pode e mentir na
 * declaracao.
 */
export const dynamic = "force-dynamic";

/**
 * Pagina inicial.
 *
 * Ela NAO lista dado. A versao anterior abria com tres paineis de "top 5 do
 * catalogo" e o Eduardo cortou: o lugar do dado e a Pokedex, onde ele vem com
 * filtro, ordem e o card inteiro. Rank fixo na home e uma segunda fonte de
 * verdade que ninguem mantem — e ainda ensina o visitante a ler o catalogo por
 * uma janelinha de cinco linhas em vez de abrir a ferramenta.
 *
 * O que sobra e o que a home tem de fazer: dizer o que o site e, provar que o
 * catalogo esta vivo, e mandar pra ferramenta certa.
 */

/**
 * Cada ferramenta tem COR e ARTE propria.
 *
 * A cor sozinha ja tirava a home de "seis caixas cinza iguais". A arte fecha o
 * argumento: um icone de linha do lucide a 24px e vocabulario de dashboard, e
 * este site e ferramenta de JOGO — pixel art com contorno e halo neon fala a
 * mesma lingua dos sprites e do wallpaper.
 *
 * Os PNG vivem em `public/images/icons/<arte>.png`, num grid 32x32 com moldura
 * de 44 (a mesma proporcao do pokedex.png, senao um icone colado na borda
 * aparece MAIOR que os outros dentro da mesma caixa). O gerador esta em
 * `scripts/pixel-icons/`. O icone do lucide fica como reserva: arte que nao
 * carregou nao pode virar caixa vazia.
 */
const TOOLS = [
  {
    href: "/dex",
    name: "Pokédex",
    desc:
      "Todas as espécies com filtro por tipo, raridade, origem, estágio, fraqueza e " +
      "faixa de nível, valor, XP, stats e poder de golpe.",
    icon: BookOpen,
    arte: "pokedex",
    cor: "var(--color-t-dex)",
    ready: true,
  },
  {
    href: "/itens",
    name: "Itens",
    desc: "Catálogo de itens com o índice reverso: quem dropa cada um, e com que chance real.",
    icon: Package,
    arte: "itens",
    cor: "var(--color-t-itens)",
    ready: true,
  },
  {
    href: "/calc",
    name: "Calculadora",
    desc: "IV, Quality e Poder pela fórmula do jogo. Projeta os stats em qualquer nível.",
    icon: Calculator,
    arte: "calculadora",
    cor: "var(--color-t-calc)",
    ready: true,
  },
  {
    href: "/hunt",
    name: "Hunt",
    desc:
      "Todo alvo do jogo medido contra o SEU pokémon, pelos dois lados do combate: XP/h, " +
      "ouro/h e risco reais — e a rota de níveis até a meta.",
    icon: Radar,
    arte: "hunt",
    cor: "var(--color-t-hunt)",
    ready: true,
  },
  {
    href: "/breed",
    name: "Breeding",
    desc:
      "Valida o par, mostra o sorteio de Quality e o IV que o filho herda — e diz quantos " +
      "breeds faltam até a Quality alvo, com o melhor caso, o típico e o azarado.",
    icon: Egg,
    arte: "breeding",
    cor: "var(--color-t-breed)",
    ready: true,
  },
  {
    href: "/meta",
    name: "Meta",
    desc:
      "Tier list por nota — dano por segundo e HP efetivo, não poder de golpe —, duelo " +
      "entre dois pokémon com nível e quality, e o panorama ofensivo de cada tipo.",
    icon: Swords,
    arte: "meta",
    cor: "var(--color-t-meta)",
    ready: true,
  },
];

export default async function HomePage() {
  const t0 = agora();
  const { counts, catalog } = await getDexPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ================= topo ================= */}
      {/* O heroi NAO tem painel: texto direto sobre o wallpaper.
          Isso so passou a ser possivel depois que a arte foi escurecida
          (luminancia media 37, pico 67) — com a foto clara original era
          ilegivel. `.on-art` poe sombra na letra, que e o que segura o texto
          na parte mais clara da cena sem escurecer a foto inteira. */}
      {/* ================= topo =================

          O herói era uma pilha CENTRALIZADA de cinco blocos — marca, manchete,
          parágrafo, quatro números e selo —, cada um centrado no seu próprio
          eixo. Três problemas juntos: parágrafo longo centralizado é o pior caso
          de leitura (cada linha recomeça num ponto diferente), a pilha comia a
          tela inteira antes de aparecer uma ferramenta sequer, e os números
          ficavam soltos no fim parecendo enfeite em vez de argumento.

          O layout novo é ASSIMÉTRICO, e quem decidiu foi a arte. Medindo o
          wallpaper por célula (média e desvio de luminância), a coluna da
          ESQUERDA é a mais escura e calma em toda a altura (média 16-26, desvio
          10-15) e o centro-direita é o neon brilhante e agitado (até 77, desvio
          44). Então: texto à esquerda, direto sobre a parte calma; e o painel de
          vidro à direita, sobre a parte movimentada — que é exatamente onde o
          vidro tem função, e não enfeite.

          Os números viram CARD com moldura própria: deixam de ser rodapé do
          herói e passam a ser o que sempre foram, a prova de que o catálogo está
          vivo. */}
      <section className="grid items-center gap-8 py-10 lg:grid-cols-[1.15fr_minmax(0,0.85fr)] lg:gap-12 lg:py-16">
        <div className="on-art flex flex-col items-start gap-6">
          <div className="flex items-center gap-4">
            {/* Parada: a bola é a marca, não um indicador. */}
            <Pokeball size={72} className="w-[56px] shrink-0 text-[var(--color-t-dex)] sm:w-[72px]" />
            <div>
              {/* PIWdex, não PIWDEX: `normal-case` desliga a caixa alta do `.pix`
                  pra a marca sair como ela se escreve. */}
              <h1 className="pix text-[40px] leading-none normal-case text-text sm:text-[52px]">
                PIW<span className="text-accent">dex</span>
              </h1>
              <p className="pix mt-2 text-[12px] text-text-mute">
                dex e ferramentas de poke idle world
              </p>
            </div>
          </div>

          {/* Caixa alta e mais corpo: é a manchete da home, e em caixa baixa ela
              competia de igual pra igual com o parágrafo logo abaixo. O tracking
              desce em relação ao `.pix` padrão — caixa alta com tracking de
              rótulo, nesse corpo, vira uma linha larga demais pra ler de uma vez. */}
          {/* `text-balance` distribui as linhas em vez de encher a primeira e
              deixar a sobra sozinha embaixo — sem ele a manchete quebrava em
              "...POKE IDLE" / "WORLD", com uma palavra órfã. */}
          <h2 className="pix text-[32px] leading-[1.12] tracking-[0.03em] text-balance text-text sm:text-[44px]">
            A dex <span style={{ color: "var(--color-t-dex)" }}>completa</span> do{" "}
            <span style={{ color: "var(--color-t-meta)" }}>Poke Idle World</span>
          </h2>

          <p className="max-w-xl text-[17px] leading-relaxed text-text-dim">
            Stats, movesets, evoluções, a chance{" "}
            <span style={{ color: "var(--color-t-hunt)" }}>real</span> de cada drop, onde
            farmar cada item e em que área cada pokémon aparece — com filtro por tipo,
            raridade, estágio, fraqueza e faixa de nível, valor, XP e poder de golpe.
          </p>

          {/* O herói não tinha saída: a pessoa lia e precisava rolar pra achar a
              primeira ferramenta. Dois caminhos, na hierarquia certa — a Pokédex é
              o que a maioria vem buscar. */}
          {/* Largura cheia no estreito: lado a lado eles ficavam com larguras
              diferentes (o rótulo é que mandava), e dois botões de tamanhos
              distintos empilhados leem como hierarquia que não existe. */}
          <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            <ButtonLink
              href="/dex"
              variant="primary"
              size="lg"
              iconRight={<IconChevronRight size={16} />}
            >
              abrir a pokédex
            </ButtonLink>
            <ButtonLink href="#ferramentas" size="lg">
              ver as ferramentas
            </ButtonLink>
          </div>
        </div>

        {/* ---- o card do catálogo ----
            Vidro sobre a parte movimentada da arte: a superfície separa o número
            do neon atrás, coisa que sombra de texto sozinha não faria nesse
            trecho (desvio de luminância 44). */}
        <aside className="panel flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="pix text-[12px] text-text-dim">o catálogo agora</h3>
            <Chip
              size="xs"
              tone={catalog.live ? "ok" : "warn"}
              /* O selo é o argumento de credibilidade da home — "este número veio
                 do jogo agora" — e era só texto. A arte dá o sinal antes da
                 leitura: torre transmitindo contra cartucho salvo. */
              icon={
                <Sprite
                  src={catalog.live ? "/images/icons/ao-vivo.png" : "/images/icons/snapshot.png"}
                  alt=""
                  size={16}
                  fallback={null}
                />
              }
              title={
                catalog.live
                  ? `Catálogo do jogo, publicado em ${catalog.generatedAt}`
                  : `Fonte indisponível (${catalog.error ?? "motivo desconhecido"})`
              }
            >
              {catalog.live ? "AO VIVO" : "SNAPSHOT"}
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-px bg-line">
            {[
              { n: counts.creatures, label: "espécies", cor: "var(--color-t-dex)" },
              { n: counts.items, label: "itens", cor: "var(--color-t-itens)" },
              { n: counts.hunts, label: "locais de caça", cor: "var(--color-t-hunt)" },
              { n: counts.drops, label: "registros de drop", cor: "var(--color-t-meta)" },
            ].map((k) => (
              // O fio que separa as células é o `gap-px` sobre o fundo de linha —
              // uma borda por célula somaria duas no meio da grade.
              <span key={k.label} className="flex flex-col gap-1 bg-surface/70 px-3 py-4">
                <span
                  className="text-[28px] leading-none font-bold tabular sm:text-[32px]"
                  style={{ color: k.cor }}
                >
                  {k.n.toLocaleString("pt-BR")}
                </span>
                <span className="pix text-[11px] text-text-mute">{k.label}</span>
              </span>
            ))}
          </div>

          {/* Não falar no condicional sobre uma coisa que já aconteceu: com a
              fonte fora do ar, "se a fonte cair" soa como se estivesse tudo bem,
              logo abaixo de um selo que diz o contrário. */}
          <p className="text-[13px] leading-relaxed text-text-mute">
            {catalog.live ? (
              <>
                Direto do catálogo do jogo, conferido a cada visita. Se a fonte cair, o
                site continua de pé com o último catálogo salvo — e avisa aqui.
              </>
            ) : (
              <>
                A fonte do jogo não respondeu, então estes números são do último catálogo
                salvo, de {catalog.generatedAt}. As ferramentas continuam funcionando.
              </>
            )}
          </p>
        </aside>
      </section>

      {/* ================= ferramentas ================= */}
      <section id="ferramentas" className="flex flex-col gap-4 scroll-mt-20">
        <h2 className="pix text-[14px] text-text-dim">Ferramentas</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const body = (
              <>
                <div className="flex items-start gap-4 sm:gap-5">
                  {/* A arte carrega a identidade da ferramenta e e a primeira
                      coisa que o olho pega — entao ela tem tamanho de figura,
                      nao de bullet. O `Sprite` ja resolve carga e falha: sem o
                      PNG, entra o icone de linha no lugar. */}
                  <span
                    className="shrink-0 transition-transform duration-300 group-hover:scale-105"
                    style={{ opacity: t.ready ? 1 : 0.55 }}
                  >
                    <Sprite
                      src={`/images/icons/${t.arte}.png`}
                      alt=""
                      size={104}
                      priority
                      /* A 320px a arte de 104 mais o botao nao cabiam na linha e
                         o card empurrava a pagina 17px pra fora da tela. Aqui ela
                         encolhe em vez de o card vazar. */
                      className="[--sprite:76px] sm:[--sprite:104px]"
                      fallback={<Icon size={34} strokeWidth={1.8} style={{ color: t.cor }} />}
                    />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <h3
                        className="pix flex-1 text-[19px] leading-none"
                        style={{ color: t.cor, opacity: t.ready ? 1 : 0.6 }}
                      >
                        {t.name}
                      </h3>
                      {t.ready ? null : <Chip size="sm">em breve</Chip>}
                    </div>

                    <p
                      className={
                        t.ready
                          ? "text-[15px] leading-relaxed text-text-dim"
                          : "text-[15px] leading-relaxed text-text-mute/70"
                      }
                    >
                      {t.desc}
                    </p>

                    {/* O botao mora na COLUNA DO TEXTO, alinhado com a
                        descricao. Solto no rodape do card ele se descola da
                        frase que explica pra onde vai. */}
                    {t.ready ? (
                      <span
                        /* `h-10` fixo com rotulo em caixa alta ("ABRIR
                           CALCULADORA" passa de 180px) nao cabia em tela estreita:
                           a linha nao podia quebrar, entao ela vazava. Altura
                           MINIMA no lugar de fixa deixa o rotulo virar duas linhas
                           quando precisa, sem cortar. */
                        className="pix mt-1 inline-flex min-h-10 w-fit max-w-full items-center gap-2 border px-4 py-2 text-[13px] transition-all group-hover:brightness-125"
                        style={{
                          borderColor: `color-mix(in oklab, ${t.cor} 60%, transparent)`,
                          backgroundColor: `color-mix(in oklab, ${t.cor} 18%, transparent)`,
                          color: t.cor,
                        }}
                      >
                        abrir {t.name.toLowerCase()}
                        <IconChevronRight size={16} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            );

            const skin = {
              borderColor: `color-mix(in oklab, ${t.cor} ${t.ready ? 42 : 22}%, var(--color-line))`,
              boxShadow: `0 0 52px -26px ${t.cor}`,
            };

            return t.ready ? (
              <Link
                key={t.href}
                href={t.href}
                className="panel group flex min-w-0 flex-col p-4 transition-all hover:brightness-110 sm:p-5"
                style={skin}
              >
                {body}
              </Link>
            ) : (
              /* `opacity` no card inteiro tambem apagava o VIDRO — sobre a foto,
                 o texto ficava ilegivel. Quem esmaece e o conteudo, pela cor; a
                 superficie fica de pe. */
              <div key={t.href} className="panel flex min-w-0 flex-col p-4 sm:p-5" style={skin}>
                {body}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
