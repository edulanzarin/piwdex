import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getMetaPayload, unpackMon } from "@/lib/meta-data";
import { metaTable, TIER_COLOR } from "@/lib/meta";
import { RARITY_COLOR } from "@/lib/typing";
import { officialArtUrl, spriteUrl } from "@/lib/sprites";
import { agora, fecharPiso } from "@/lib/pacing";
import {
  ArtCard,
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

  /**
   * O DESTAQUE — o número 1 da tier list, e não um sorteio.
   *
   * A primeira versão sorteava pelo dia. Dava capa nova todo dia, e dava também
   * um Ludicolo na chegada de um site que se apresenta como ferramenta de meta:
   * a home mostrava um pokémon qualquer no lugar mais nobre da página, sem nada
   * dizendo por que aquele.
   *
   * Agora vem do `metaTable`, que é o mesmo motor da ferramenta de Meta — a nota
   * sai de combate (DPS efetivo e HP efetivo), não de soma de stat. O destaque
   * passa a AFIRMAR alguma coisa: "este é o mais forte do jogo", com a nota do
   * lado provando.
   *
   * `pool: "natural"` de propósito, que é o que o Eduardo pediu: sem TM. O
   * ranking com TM mede o teto de quem já investiu numa máquina; o natural mede
   * a espécie como ela sai do campo, e é essa a pergunta de quem está chegando.
   *
   * Escrever uma segunda regra de "quem é o mais forte" aqui daria duas respostas
   * pra mesma pergunta no mesmo site, e a da home seria a que ninguém revisa.
   */
  const { mons } = await getMetaPayload();
  const ranking = metaTable(mons.map(unpackMon), "natural");
  const topo = ranking.find((e) => e.creature.pokeId < 1e4) ?? ranking[0];
  const destaque = topo
    ? {
        id: topo.creature.pokeId,
        name: topo.creature.name,
        rarity: topo.creature.rarity,
        nota: topo.score,
        tier: topo.tier,
      }
    : null;

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
      <section className="grid min-h-[62vh] items-center gap-10 py-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:py-20">
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
            {/* UMA cor, e não três.
                "POKE" branco, "IDLE" vermelho e "WORLD" ciano davam três acentos
                de peso igual num nome de três palavras — nenhuma ganhava, e o
                título lia como logotipo de outra coisa. Pior: as três eram cores
                de FERRAMENTA (dex, meta), que nesta paleta significam "esta seção
                é a Pokédex", e ali não significavam nada.
                Branco no todo, com o acento da marca só em "IDLE" — que é a
                palavra que diz o gênero do jogo e a única que merecia destaque. */}
            <DisplayTitle as="h2" size="xl" className="text-text">
              Poke <span style={{ color: "var(--color-t-dex)" }}>Idle</span> World
            </DisplayTitle>
          </div>

          <p
            className="anim-in max-w-xl text-[17px] leading-relaxed text-text-dim"
            style={{ "--d": "150ms" } as CSSProperties}
          >
            Stats, drops, evolução e onde caçar cada espécie do jogo.
          </p>

          {/* A pista de rolagem. Uma home que abre com meia tela de arte precisa
              dizer que há mais embaixo — sem isso, quem chega em monitor grande
              lê o herói como a página inteira. */}
          <Link
            href="#ferramentas"
            className="anim-in pix group mt-2 inline-flex items-center gap-2.5 text-[10px] tracking-[0.2em] text-text-mute transition-colors hover:text-text-dim"
            style={{ "--d": "260ms" } as CSSProperties}
          >
            <span className="grid h-8 w-8 place-items-center rounded-pill border border-line-strong transition-transform duration-300 motion-safe:group-hover:translate-y-0.5">
              <IconChevronRight size={14} className="rotate-90" />
            </span>
            as ferramentas
          </Link>
        </div>

        {/* ---- o DESTAQUE DO DIA ----

            Ele voltou pra dentro de um CARD, e isso desfaz a escolha anterior de
            proposito. A versao passada tirou o painel e ficou so com a arte e um
            halo — "luz em vez de caixa". A ideia era boa e a execucao nao pagou:
            sem superficie, o destaque nao lia como PECA. Ele ficava pousado sobre
            o wallpaper como se tivesse escorregado pra ali, e o halo, que era pra
            separar arte de fundo, so dizia que havia luz atras de alguma coisa —
            nao onde aquela coisa comecava e terminava.

            E o card e o que ele sempre foi: o `ArtCard`, a forma de arte em cima
            e placa embaixo que ja existia em `ui/` e so aparecia na pagina de
            estilo. O destaque e o caso exato pra que ela foi escrita — a arte e o
            argumento, e a unica chrome que ela aceita e uma placa fina com o
            nome.

            `max-w-sm` porque a coluna da direita passa dos 600px no `xl`, e um
            painel de arte quadrado nessa largura vira poster: o heroi da esquerda
            perderia a disputa dentro da propria primeira dobra. */}
        {destaque ? (
          <ArtCard
            href={`/dex/${destaque.id}`}
            shape="quadrada"
            tint={RARITY_COLOR[destaque.rarity]}
            className="anim-in mx-auto hidden w-full max-w-sm lg:block"
            style={{ "--d": "320ms" } as CSSProperties}
            art={
              <>
                {/* O HALO fica — ele so trocou de patrao.
                    Solto sobre o wallpaper ele tinha de fazer dois trabalhos e so
                    dava conta de um: separar a arte do fundo (nao dava) e dar
                    vida a peca (dava). Dentro do card, a borda ja separa, e ele
                    volta a fazer so o que sabe. Por isso ele encolheu e baixou a
                    opacidade: 26rem a 55% existiam pra vencer uma cena inteira
                    atras; aqui atras ha uma superficie de uma cor so. */}
                <span
                  aria-hidden="true"
                  className="absolute h-52 w-52 rounded-pill blur-[64px] transition-opacity duration-500 group-hover:opacity-90"
                  style={{ backgroundColor: RARITY_COLOR[destaque.rarity], opacity: 0.4 }}
                />
                <Sprite
                  src={spriteUrl(destaque.id)}
                  alt={destaque.name}
                  size={300}
                  priority
                  className="anim-float relative [--sprite:240px] xl:[--sprite:300px]"
                />
              </>
            }
            eyebrow={
              <span className="flex items-center gap-2">
                <span
                  className="rounded-pill border px-2 py-0.5 tracking-[0.14em]"
                  style={{
                    color: TIER_COLOR[destaque.tier],
                    borderColor: `color-mix(in oklab, ${TIER_COLOR[destaque.tier]} 45%, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${TIER_COLOR[destaque.tier]} 14%, transparent)`,
                  }}
                >
                  tier {destaque.tier}
                </span>
                Pokémon em destaque
              </span>
            }
            name={
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[17px] tracking-[0.08em]">
                  {destaque.name}
                </span>
                {/* O numero na MESMA linha do nome, e nao numa terceira.
                    Ele e identificacao, nao afirmacao: gastar uma linha inteira
                    da placa com ele daria a "#145" o mesmo peso de "tier S". */}
                <span className="num shrink-0 text-[11px] text-text-mute">
                  #{String(destaque.id).padStart(3, "0")}
                </span>
              </span>
            }
          />
        ) : null}
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
                src={`/images/icons/${t.arte}.svg`}
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
