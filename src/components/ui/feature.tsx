import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./reveal";

/**
 * A SECAO DE CENA — o oposto do card, e de proposito.
 *
 * O card e a forma certa pra COMPARAR: seis caixas iguais lado a lado deixam o
 * olho varrer e escolher. Ele e a forma errada pra APRESENTAR — e era isso que a
 * home estava fazendo com ele. Numa grade de seis, cada ferramenta ganha um sexto
 * da atencao e nenhuma ganha um argumento; o resultado le como menu de sistema,
 * nao como convite.
 *
 * Aqui cada ferramenta ocupa uma faixa inteira, com a arte grande de um lado e o
 * argumento do outro, e as faixas ALTERNAM o lado. A alternancia nao e enfeite:
 * ela e o que impede a pagina de virar um trilho de blocos identicos, e e o que
 * faz o olho ter que atravessar a faixa em vez de descer pela mesma coluna.
 *
 * ## O que faz uma faixa parecer cena, e nao div grande
 *
 * 1. **Sangra pra fora do container.** Cena com margem dos dois lados e ilustracao
 *    de artigo. O fundo tem que encostar na borda da janela.
 * 2. **A arte estoura o limite.** O sprite passa por cima da borda da faixa; peca
 *    contida na propria caixa le como conteudo, peca que vaza le como cena.
 * 3. **Uma cor manda na faixa.** O brilho de fundo sai da cor da ferramenta, e e
 *    o que da identidade sem precisar de moldura.
 */

/**
 * Sai do container e vai de borda a borda da janela.
 *
 * A conta (`50%` menos `50vw`) e a saida padrao pra isso, e ela tem um detalhe
 * que sempre morde: `100vw` inclui a barra de rolagem em alguns navegadores, o
 * que cria um estouro horizontal de uns 15px. O `overflow-x-clip` no pai corta
 * isso sem criar contexto de rolagem novo — `hidden` criaria, e ai `position:
 * sticky` de dentro pararia de funcionar.
 */
export function FullBleed({
  children,
  className,
  style,
  id,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn("relative left-1/2 w-screen -translate-x-1/2", className)}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * A SOBRELINHA — a frase pequena que prepara o titulo grande.
 *
 * "Escolha seu" acima de "CAMPEAO". Ela existe porque titulo display sozinho e
 * uma palavra sem verbo: com a sobrelinha, o bloco vira uma frase que comeca
 * pequena e termina em escala. Sem ela, o mesmo titulo e so um rotulo enorme.
 */
export function Eyebrow({
  children,
  tint,
  className,
}: {
  children: ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <p
      className={cn("pix text-[13px] tracking-[0.18em] text-text-mute sm:text-[14px]", className)}
      style={tint ? { color: tint } : undefined}
    >
      {children}
    </p>
  );
}

/**
 * O TITULO DISPLAY: grande, italico, em caixa alta.
 *
 * Ele usa a terceira familia (`--font-display`) e nao a do texto, e a razao e a
 * inclinacao: a Lexend Deca nao tem italico de verdade. Pedir italico a ela faz o
 * navegador SINTETIZAR — inclinar a letra reta por transformacao — e o resultado
 * e uma haste torta com o contraste todo errado, que num corpo de 60px se ve de
 * longe.
 *
 * O `leading` desce pra 0.92 porque titulo grande herda entrelinha de paragrafo e
 * fica com um buraco entre as duas linhas. Em corpo display a medida certa e
 * menor que 1.
 */
export function DisplayTitle({
  children,
  tint,
  size = "lg",
  className,
  as: Tag = "h2",
}: {
  children: ReactNode;
  tint?: string;
  size?: "md" | "lg" | "xl";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        "display uppercase italic leading-[0.92] tracking-[-0.01em] text-balance",
        /* Tres degraus, e nao dois. O salto `sm` levava o titulo de cena pra
           62px em qualquer janela acima de 640 — inclusive nas que passaram a
           mostrar a faixa em DUAS colunas, onde a coluna tem ~450px e
           "CALCULADORA" em 62px pede 620. O degrau do meio segura o corpo
           enquanto a coluna e estreita e so solta em `lg`, quando ela cresce. */
        size === "md" && "text-[34px] sm:text-[40px] lg:text-[44px]",
        size === "lg" && "text-[42px] sm:text-[46px] lg:text-[62px]",
        size === "xl" && "text-[52px] sm:text-[64px] lg:text-[84px]",
        className,
      )}
      style={tint ? { color: tint } : undefined}
    >
      {children}
    </Tag>
  );
}

export interface FeatureSectionProps {
  eyebrow: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  actions?: ReactNode;
  /** a arte da faixa — sprite, ilustracao, o que for grande */
  art: ReactNode;
  /** a cor que manda na faixa: brilho de fundo, sobrelinha e titulo */
  tint: string;
  /** a arte vai pra ESQUERDA. Alternar isso entre faixas e o ponto do componente */
  flip?: boolean;
  /** conteudo extra abaixo das acoes (numeros, chips) */
  footer?: ReactNode;
  /** ancora da secao — a faixa e o alvo de link do menu quando ela abre a lista */
  id?: string;
  className?: string;
}

export function FeatureSection({
  eyebrow,
  title,
  lead,
  actions,
  art,
  tint,
  flip,
  footer,
  id,
  className,
}: FeatureSectionProps) {
  return (
    <FullBleed id={id} className={cn("scroll-mt-24 overflow-x-clip py-14 sm:py-20", className)}>
      {/* O brilho da faixa: um circulo enorme e muito diluido atras da arte. E o
          que da COR a cena sem pintar um retangulo — retangulo colorido volta a
          ser card, que e o que esta secao existe pra deixar de ser. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 70% at ${flip ? "26%" : "74%"} 50%, ` +
            `color-mix(in oklab, ${tint} 16%, transparent), transparent 70%)`,
        }}
      />
      {/* O fio de cima morre nas pontas: faixa sem separacao nenhuma vira rolagem
          infinita sem ritmo, e fio de ponta a ponta corta a pagina em fatias. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ` +
            `color-mix(in oklab, ${tint} 40%, transparent), transparent)`,
        }}
      />

      {/* ---- UMA revelacao pra faixa inteira, e nao uma por metade ----

          Eram duas: uma no texto, outra na arte, cada uma com seu observador. Em
          janela alta ninguem nota, porque a faixa inteira entra em cena junto. Em
          janela BAIXA e o defeito que apareceu na home: a faixa mede ~810px
          (texto 310 + arte 340 + respiro) contra ~470px de altura util, entao
          nenhuma ferramenta cabe na tela — e com dois gatilhos independentes
          havia posicao de rolagem em que a arte enchia a tela com o texto da
          MESMA faixa ainda em `opacity: 0`. A pagina lia como arte boiando sobre
          o wallpaper, sem uma palavra.

          Texto e arte sao uma composicao: o titulo nomeia a peca que esta do
          lado. Revelar as duas metades por conta propria e tratar como duas
          coisas o que so significa junto.

          A ALTERNANCIA nao se perdeu — ela subiu de nivel. Em vez de as metades
          entrarem por lados opostos, a faixa inteira entra pelo lado em que a
          arte dela mora, e faixas vizinhas continuam entrando por lados
          contrarios. */}
      <Reveal
        efeito={flip ? "esquerda" : "direita"}
        /* Duas colunas a partir de `md` (768px), e nao de `lg` (1024).
           Empilhada, a faixa mede ~810px — texto 310, arte 340 e o respiro — e
           janela de notebook tem ~470px de altura util: a ferramenta NUNCA cabia
           na tela, e o que se via era a arte sozinha com o titulo dela fora de
           quadro. Lado a lado a faixa cai pra ~380px e a cena volta a ser uma
           cena. Os 256px entre md e lg eram exatamente a faixa de janela em que
           a home se desmontava. */
        className={cn(
          "mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:gap-16",
          "md:grid-cols-2",
        )}
      >
        <div className={cn("flex flex-col items-start gap-5", flip && "md:order-2")}>
          <Eyebrow tint={`color-mix(in oklab, ${tint} 70%, white)`}>{eyebrow}</Eyebrow>
          <DisplayTitle tint={tint}>{title}</DisplayTitle>
          <p className="max-w-lg text-[16px] leading-relaxed text-text-dim sm:text-[17px]">
            {lead}
          </p>
          {actions && <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div>}
          {footer}
        </div>

        <div className={cn("flex items-center justify-center", flip && "md:order-1")}>
          {art}
        </div>
      </Reveal>
    </FullBleed>
  );
}
