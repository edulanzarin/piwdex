import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import {
  Badge,
  ButtonLink,
  RuleTitle,
  DisplayTitle,
  Eyebrow,
  FeatureSection,
  IconChevronRight,
  MetricCell,
  MetricGrid,
  Parallax,
  Pokeball,
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

          {/* A manchete virou TITULO DE CENA: sobrelinha pequena, nome grande em
              itálico. O bloco passa a ser uma frase que começa miúda e termina em
              escala, em vez de um rótulo de 44px.

              O itálico é de verdade (família própria, ver `layout.tsx`): pedir
              itálico à Lexend faria o navegador inclinar a letra reta por
              transformação, e nesse corpo a haste torta se vê de longe. */}
          <div
            className="anim-in flex flex-col gap-2"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            <Eyebrow>A dex completa do</Eyebrow>
            <DisplayTitle as="h2" size="xl" className="text-text">
              Poke{" "}
              <span style={{ color: "var(--color-t-dex)" }}>Idle</span>{" "}
              <span style={{ color: "var(--color-t-meta)" }}>World</span>
            </DisplayTitle>
          </div>

          <p
            className="anim-in max-w-xl text-[17px] leading-relaxed text-text-dim"
            style={{ "--d": "150ms" } as CSSProperties}
          >
            Stats, moveset, evolução e a chance{" "}
            <span style={{ color: "var(--color-t-hunt)" }}>real</span> de cada drop. Onde
            farmar cada item, em que área cada pokémon aparece, e o filtro que leva você
            até ele em dois cliques.
          </p>

          {/* UM caminho, e nao dois.
              O herói tinha "abrir a pokédex" e "ver as ferramentas" lado a lado.
              Com as ferramentas virando cena logo abaixo — e a Pokédex sendo a
              PRIMEIRA delas, com botão próprio e arte grande —, o primeiro botão
              mandava pro mesmo lugar que a seção seguinte já entrega melhor. Dois
              caminhos pro mesmo destino não são escolha, são hesitação: quem lê
              para pra decidir entre opções que dão no mesmo. */}
          <div
            className="anim-in flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center"
            style={{ "--d": "210ms" } as CSSProperties}
          >
            <ButtonLink
              href="#ferramentas"
              variant="primary"
              size="lg"
              className="sheen group"
              iconRight={
                <IconChevronRight
                  size={16}
                  className="transition-transform duration-150 group-hover:translate-y-0.5 group-hover:rotate-90"
                />
              }
            >
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

      {/* ================= as ferramentas, em CENAS =================

          Era uma grade de seis cards. O card e a forma certa pra COMPARAR — seis
          caixas iguais deixam o olho varrer e escolher — e a forma errada pra
          APRESENTAR: na grade, cada ferramenta ganha um sexto da atenção e
          nenhuma ganha um argumento, e a página lê como menu de sistema.

          Agora cada uma ocupa uma faixa inteira que sangra até a borda da janela,
          com a arte grande de um lado e o argumento do outro, alternando o lado a
          cada faixa. A alternância é o que impede a página de virar um trilho de
          blocos idênticos descendo pela mesma coluna.

          A revelação entra no scroll, e não na carga: animar o que está abaixo da
          dobra no carregamento é pagar o custo da animação enquanto ninguém
          olha. */}
      {/* Titulo de CAPITULO, e nao de lista: fio dos dois lados, centralizado,
          com a pokébola de marca em cima. Ele para a página, e por isso é o
          ÚNICO da home — usado em toda seção, vira ritmo de slides e nada mais
          parece importante. */}
      <RuleTitle
        id="ferramentas"
        className="scroll-mt-24 pt-6"
        emblem={<Pokeball size={26} className="text-[var(--color-t-dex)]" />}
      >
        Ferramentas
      </RuleTitle>

      {FERRAMENTAS.map((t, i) => (
        <FeatureSection
          key={t.href}
          tint={t.cor}
          /* A alternância é o par/ímpar do índice, e não um campo no registro:
             de que lado a arte cai é decisão de LAYOUT desta página, e cravar
             isso na identidade da ferramenta faria a próxima tela herdar uma
             escolha que só faz sentido aqui. */
          flip={i % 2 === 1}
          eyebrow={t.chamada}
          title={t.nome}
          lead={t.desc}
          art={
            <Parallax forca={0.06}>
              <Sprite
                src={`/images/icons/${t.arte}.png`}
                alt=""
                size={340}
                /* A arte estoura a faixa: peça contida na própria caixa lê como
                   conteúdo, peça que vaza lê como cena. */
                /* A arte da cena e GRANDE: 220 no estreito, 340 no largo.
                   Ela estava saindo em 64px — o `[--sprite:...]` era ignorado
                   porque a primitiva escrevia a variavel no style inline do mesmo
                   elemento, e inline vence classe. Corrigido em `sprite.tsx`; o
                   tamanho pedido aqui agora acontece de fato. */
                className="[--sprite:220px] drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] sm:[--sprite:340px]"
                fallback={<t.Icone size={120} strokeWidth={1.2} style={{ color: t.cor }} />}
              />
            </Parallax>
          }
          actions={
            <ButtonLink
              href={t.href}
              size="lg"
              variant="solido"
              style={{ backgroundColor: t.cor }}
              iconRight={<IconChevronRight size={16} />}
            >
              Abrir {t.nome}
            </ButtonLink>
          }
        />
      ))}
    </div>
  );
}
