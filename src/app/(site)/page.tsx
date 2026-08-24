import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDexPayload } from "@/lib/dex-data";
import { agora, fecharPiso } from "@/lib/pacing";
import {
  ButtonLink,
  DisplayTitle,
  Eyebrow,
  FeatureSection,
  IconChevronRight,
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
      {/* Uma coluna só, agora que o painel do catálogo saiu. A grade de duas
          existia pra equilibrar o card da direita; com um filho só ela deixaria o
          texto esticar por toda a largura, e linha de 1400px não se lê.
          O `max-w-3xl` segura a medida e o resto da faixa fica pra ARTE, que é a
          troca inteira desta passada: o wallpaper deixa de disputar a metade
          direita com um widget e volta a ser cenário. */}
      <section className="flex min-h-[62vh] flex-col justify-center py-12 lg:py-20">
        {/* Cada bloco entra no seu tempo, na ordem em que se lê: marca, manchete,
            frase, botões. O atraso vem de `--d` e não de quatro classes
            diferentes — é a mesma animação, deslocada. */}
        <div className="on-art flex max-w-3xl flex-col items-start gap-6">
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
            Stats, drops, evolução e onde caçar cada espécie do jogo.
          </p>
        </div>
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
      {/* Sem título de capítulo antes das cenas.

          O "FERRAMENTAS" com fio dos dois lados anunciava o que a primeira cena
          já diz sozinha: ela chega com arte de 340px, nome em corpo display e
          botão próprio. Um rótulo antes disso é a página explicando o que vem a
          seguir para quem já está vendo o que vem a seguir.

          A âncora `#ferramentas` continua existindo — ela desceu pra primeira
          cena, porque é pra lá que o link do menu tem que levar. */}

      {FERRAMENTAS.map((t, i) => (
        <FeatureSection
          key={t.href}
          id={i === 0 ? "ferramentas" : undefined}
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
