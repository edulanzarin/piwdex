import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A MOLDURA DE FIO — o recurso que faz uma placa parecer cara.
 *
 * A referencia (Universe) quase nao usa preenchimento pra dar hierarquia: o que
 * separa um bloco do fundo preto e uma linha de UM pixel, e as vezes duas
 * concentricas com uma folga miuda entre elas. E barato de desenhar e caro de
 * parecer, e a razao e contraintuitiva: fio fino so funciona quando TUDO em volta
 * respira. Numa tela apertada ele some; numa tela com folga, ele vira precisao.
 *
 * Por isso esta primitiva nao expoe padding curto. Moldura com pouco respiro le
 * como tabela, e ai o efeito inteiro se perde.
 *
 * ## Por que nao e o `Panel`
 *
 * `Panel` e SUPERFICIE: ele tem fundo, blur e elevacao, e serve pra separar
 * conteudo do que passa por tras. `Frame` e CONTORNO: ele quase nao tem fundo, e
 * serve pra emoldurar o que ja esta legivel. Um bloco de dado dentro de um painel
 * pede `Panel`; uma placa de titulo sobre arte pede `Frame`.
 */
export function Frame({
  children,
  tint,
  /** a segunda linha, concentrica. E ela que faz a moldura virar placa */
  dupla,
  /** os quatro cantos ganham um traco curto na cor */
  cantos,
  className,
  style,
}: {
  children: ReactNode;
  tint?: string;
  dupla?: boolean;
  cantos?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const cor = tint ?? "var(--color-accent)";
  return (
    <div
      className={cn("relative", className)}
      style={
        {
          ...style,
          "--fio": `color-mix(in oklab, ${cor} 42%, transparent)`,
        } as CSSProperties
      }
    >
      {/* A moldura e um PSEUDO-BLOCO absoluto, e nao a borda do proprio elemento.
          Duas razoes: a linha interna precisa de um segundo retangulo, e assim o
          conteudo nao herda nem o raio nem a borda — o que evita a lista de dentro
          ficar com o canto cortado no meio de uma linha. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-pix border"
        style={{ borderColor: "var(--fio)" }}
      />
      {dupla && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[5px] rounded-[calc(var(--radius-pix)-4px)] border"
          style={{ borderColor: `color-mix(in oklab, ${cor} 18%, transparent)` }}
        />
      )}
      {cantos &&
        (
          [
            "top-0 left-0 border-t-2 border-l-2 rounded-tl-pix",
            "top-0 right-0 border-t-2 border-r-2 rounded-tr-pix",
            "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-pix",
            "right-0 bottom-0 border-r-2 border-b-2 rounded-br-pix",
          ] as const
        ).map((c) => (
          <span
            key={c}
            aria-hidden="true"
            className={cn("pointer-events-none absolute h-4 w-4", c)}
            style={{ borderColor: cor }}
          />
        ))}
      {children}
    </div>
  );
}

/**
 * O TITULO CENTRALIZADO com fio dos dois lados.
 *
 * A assinatura mais reconhecivel da referencia. Ele difere do `SectionTitle`
 * comum em mais do que alinhamento, e vale dizer qual e a diferenca de FUNCAO:
 *
 * - `SectionTitle` (a esquerda, fio correndo pra direita) e um marcador de LISTA.
 *   Ele diz "o que vem abaixo pertence a este grupo" e sai da frente.
 * - `RuleTitle` (centralizado, fio pros dois lados) e um marcador de CAPITULO. Ele
 *   para a pagina, e por isso custa caro: usado em toda secao, vira ritmo de
 *   apresentacao de slides e nada mais parece importante.
 *
 * Um por tela costuma ser o certo. Dois ja e muito.
 */
export function RuleTitle({
  children,
  emblem,
  tint,
  className,
  id,
}: {
  children: ReactNode;
  /** a marca acima do titulo — pequena, e opcional */
  emblem?: ReactNode;
  tint?: string;
  className?: string;
  id?: string;
}) {
  const cor = tint ?? "var(--color-accent-soft)";
  return (
    <div className={cn("flex flex-col items-center gap-3", className)} id={id}>
      {emblem && <span className="opacity-80">{emblem}</span>}
      <div className="flex w-full items-center gap-4 sm:gap-6">
        <span
          aria-hidden="true"
          className="h-px flex-1"
          style={{ background: `linear-gradient(90deg, transparent, ${cor})` }}
        />
        {/* O tracking e MUITO largo — 0.28em contra os 0.045 do rotulo comum.
            Em titulo de capitulo, o espaco entre letras e o que transforma uma
            palavra em inscricao: apertado, ela le como rotulo de campo. */}
        <h2 className="pix text-center text-[13px] tracking-[0.28em] whitespace-nowrap text-text-dim sm:text-[15px]">
          {children}
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1"
          style={{ background: `linear-gradient(270deg, transparent, ${cor})` }}
        />
      </div>
    </div>
  );
}
