import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import {
  Badge,
  ButtonLink,
  IconChevronRight,
  MetricCell,
  MetricGrid,
  Pokeball,
  SectionTitle,
  Sprite,
} from "@/components/ui";
import { FERRAMENTAS } from "@/lib/ferramentas";

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
 *
 * As seis ferramentas (nome, cor, arte, icone e texto) saem de
 * `lib/ferramentas.ts`, o mesmo registro que abastece a navegacao e a faixa de
 * topo de cada tela. Elas moravam aqui numa constante local, e o custo disso
 * aparecia toda vez que uma ferramenta mudava de nome: tres arquivos pra
 * alterar, e dois deles seriam esquecidos.
 */
export default async function HomePage() {
  const t0 = agora();
  const { counts, catalog } = await getDexPayload();

  await fecharPiso(t0);

  return (
    <div className="flex flex-col gap-8 pb-10">
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
        {/* Cada bloco entra no seu tempo, na ordem em que se lê: marca, manchete,
            frase, botões. O atraso vem de `--d` e não de quatro classes
            diferentes — é a mesma animação, deslocada. */}
        <div className="on-art flex flex-col items-start gap-6">
          <div className="anim-in flex items-center gap-4" style={{ "--d": "0ms" } as CSSProperties}>
            {/* A bola é a marca. Ela flutua, não gira: girar é o que a pokebola
                faz quando o site está CARREGANDO (o `Sprite` usa isso), e repetir
                o mesmo gesto aqui diria que a home está esperando alguma coisa. */}
            <Pokeball
              size={72}
              className="anim-float w-[56px] shrink-0 text-[var(--color-t-dex)] sm:w-[72px]"
            />
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
              rótulo, nesse corpo, vira uma linha larga demais pra ler de uma vez.
              `text-balance` distribui as linhas em vez de encher a primeira e
              deixar a sobra sozinha embaixo. */}
          <h2
            className="anim-in pix text-[32px] leading-[1.12] tracking-[0.03em] text-balance text-text sm:text-[44px]"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            A dex <span style={{ color: "var(--color-t-dex)" }}>completa</span> do{" "}
            <span style={{ color: "var(--color-t-meta)" }}>Poke Idle World</span>
          </h2>

          <p
            className="anim-in max-w-xl text-[17px] leading-relaxed text-text-dim"
            style={{ "--d": "150ms" } as CSSProperties}
          >
            Stats, moveset, evolução e a chance{" "}
            <span style={{ color: "var(--color-t-hunt)" }}>real</span> de cada drop. Onde
            farmar cada item, em que área cada pokémon aparece, e o filtro que leva você
            até ele em dois cliques.
          </p>

          {/* O herói não tinha saída: a pessoa lia e precisava rolar pra achar a
              primeira ferramenta. Dois caminhos, na hierarquia certa — a Pokédex é
              o que a maioria vem buscar. Largura cheia no estreito: lado a lado
              eles ficavam com larguras diferentes (o rótulo é que mandava), e dois
              botões de tamanhos distintos empilhados leem como hierarquia que não
              existe. */}
          <div
            className="anim-in flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center"
            style={{ "--d": "210ms" } as CSSProperties}
          >
            <ButtonLink
              href="/dex"
              variant="primary"
              size="lg"
              className="sheen group"
              iconRight={
                <IconChevronRight
                  size={16}
                  className="transition-transform duration-150 group-hover:translate-x-0.5"
                />
              }
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
        <aside
          className="panel anim-in flex flex-col gap-5 p-5 sm:p-6"
          style={{ "--d": "260ms" } as CSSProperties}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="pix text-[12px] text-text-dim">o catálogo agora</h3>
            {/* Selo de ESTADO do sistema, e nao categoria: por isso `Badge` e nao
                `Chip`. O ponto pulsa quando esta ao vivo — o estado se le de canto
                de olho, antes da palavra. */}
            <Badge
              tone={catalog.live ? "ok" : "warn"}
              pulse={catalog.live}
              icon={
                <Sprite
                  src={catalog.live ? "/images/icons/ao-vivo.png" : "/images/icons/snapshot.png"}
                  alt=""
                  size={14}
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
            </Badge>
          </div>

          {/* A grade saiu daqui e virou primitiva. Ela ja existia duas vezes (aqui e
              no painel do robo) com CSS diferente, e o fio entre celulas — que e
              `gap-px` sobre fundo de linha, e nao borda por celula — e o tipo de
              detalhe que a segunda copia nunca herda. */}
          <MetricGrid>
            {[
              { n: counts.creatures, label: "espécies", cor: "var(--color-t-dex)" },
              { n: counts.items, label: "itens", cor: "var(--color-t-itens)" },
              { n: counts.hunts, label: "locais de caça", cor: "var(--color-t-hunt)" },
              { n: counts.drops, label: "registros de drop", cor: "var(--color-t-meta)" },
            ].map((k, i) => (
              // As quatro células entram em cascata, uma a cada 60ms: o card se
              // preenche, e preencher é o gesto que combina com "o catálogo agora".
              <MetricCell
                key={k.label}
                value={k.n.toLocaleString("pt-BR")}
                label={k.label}
                tint={k.cor}
                className="anim-in"
                style={{ "--d": `${320 + i * 60}ms` } as CSSProperties}
              />
            ))}
          </MetricGrid>

          {/* Não falar no condicional sobre uma coisa que já aconteceu: com a
              fonte fora do ar, "se a fonte cair" soa como se estivesse tudo bem,
              logo abaixo de um selo que diz o contrário. */}
          <p className="text-[13px] leading-relaxed text-text-mute">
            {catalog.live ? (
              <>
                Números direto do catálogo do jogo, conferidos a cada visita. Se a fonte
                cair, o site continua de pé com o último catálogo salvo e avisa aqui em
                cima.
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
        <SectionTitle>Ferramentas</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {FERRAMENTAS.map((t, i) => {
            const Icone = t.Icone;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="panel anim-in group relative flex min-w-0 flex-col overflow-hidden p-4 transition-all duration-200 hover:brightness-110 sm:p-5"
                style={
                  {
                    "--tint": t.cor,
                    "--d": `${i * 55}ms`,
                    borderColor: `color-mix(in oklab, ${t.cor} 40%, var(--color-line))`,
                    boxShadow: `0 0 52px -26px ${t.cor}`,
                  } as CSSProperties
                }
              >
                {/* O wash da cor da ferramenta só acende no hover: em repouso os
                    seis cards têm o mesmo peso, e é o ponteiro que escolhe qual
                    deles está sob atenção. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(420px 180px at 0% 0%, color-mix(in oklab, ${t.cor} 16%, transparent), transparent 70%)`,
                  }}
                />

                <div className="relative flex items-start gap-4 sm:gap-5">
                  {/* A arte carrega a identidade da ferramenta e é a primeira
                      coisa que o olho pega — então ela tem tamanho de figura,
                      não de bullet. O `Sprite` já resolve carga e falha: sem o
                      PNG, entra o ícone de linha no lugar. */}
                  <span className="shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-105">
                    <Sprite
                      src={`/images/icons/${t.arte}.png`}
                      alt=""
                      size={104}
                      priority
                      /* A 320px a arte de 104 mais o botão não cabiam na linha e
                         o card empurrava a página 17px pra fora da tela. Aqui ela
                         encolhe em vez de o card vazar. */
                      className="[--sprite:76px] sm:[--sprite:104px]"
                      fallback={<Icone size={34} strokeWidth={1.8} style={{ color: t.cor }} />}
                    />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {/* SEM glifo de linha ao lado do nome.
                        Ele existia pra ensinar que o ícone da navegação é esta
                        tela, e o preço disso era alto demais: traço fino de 16px
                        encostado num sprite pixelado de 104px são duas linguagens
                        de desenho na mesma linha, e a que perde é sempre a arte —
                        o glifo lê como ícone de sistema e faz a peça feita à mão
                        parecer enfeite. A arte já identifica a ferramenta, e ela
                        identifica melhor. */}
                    <h3 className="pix text-[19px] leading-none" style={{ color: t.cor }}>
                      {t.nome}
                    </h3>

                    <p className="text-[15px] leading-relaxed text-text-dim">{t.desc}</p>

                    {/* O botão mora na COLUNA DO TEXTO, alinhado com a descrição.
                        Solto no rodapé do card ele se descola da frase que explica
                        pra onde vai. `min-h` no lugar de `h` fixo: o rótulo em
                        caixa alta passa de 180px e não podia quebrar, então
                        vazava. */}
                    <span
                      className="pix mt-1 inline-flex min-h-10 w-fit max-w-full items-center gap-2 border px-4 py-2 text-[13px] transition-all duration-200 group-hover:brightness-125"
                      style={{
                        borderColor: `color-mix(in oklab, ${t.cor} 60%, transparent)`,
                        backgroundColor: `color-mix(in oklab, ${t.cor} 18%, transparent)`,
                        color: t.cor,
                      }}
                    >
                      abrir {t.nome.toLowerCase()}
                      <IconChevronRight
                        size={16}
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
