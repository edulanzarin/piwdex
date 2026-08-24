import type { CSSProperties, ReactNode } from "react";
import { DisplayTitle, Eyebrow, Sprite } from "@/components/ui";
import { ferramentaDe } from "@/lib/ferramentas";

/**
 * A faixa de topo de uma ferramenta.
 *
 * ## O que ela responde
 *
 * As tres perguntas de quem acabou de chegar, na ordem em que aparecem: onde eu
 * estou (a arte grande, com a cor pintando a faixa), como isso se chama (o nome
 * em corpo de cena) e o que isso faz (uma frase, a `linha` da ferramenta). O
 * quarto slot, `marcas`, e opcional e diz o TAMANHO do que a tela tem — "482
 * especies" prova o catalogo antes de qualquer rolagem.
 *
 * ## O que saiu, e por que
 *
 * A versao anterior vestia o dialeto de console-terminal: quatro cantoneiras de
 * mira, um facho atravessando a faixa, LED quadrado piscando, grade de fundo. Era
 * coerente enquanto o site inteiro tinha canto reto e brilho neon como unico
 * recurso de profundidade.
 *
 * Com a home virando CENA — faixa que sangra, arte grande, titulo display — essa
 * faixa passou a ser a peca que denuncia a passada antiga: a pessoa vinha de uma
 * apresentacao e chegava numa mira de jogo de tiro. Enfeite que nao pertence nao
 * le como "estilo diferente", le como tela que ninguem terminou.
 *
 * O que ficou e o que carrega significado: a cor da ferramenta pintando o
 * ambiente, e a arte. Tudo sai de `--tint`, escrita uma vez — trocar a cor em
 * `lib/ferramentas.ts` repinta a faixa, e nao ha um hex sequer aqui.
 */
export function HeroFerramenta({
  href,
  marcas,
  acoes,
}: {
  /** a rota da ferramenta; nome, arte, cor e frase saem do registro */
  href: string;
  /** pilulas de escala ("482 espécies"), na direita */
  marcas?: ReactNode;
  /** botao ou controle na ponta direita */
  acoes?: ReactNode;
}) {
  const f = ferramentaDe(href);
  const Icone = f.Icone;

  return (
    <header
      className="panel relative overflow-hidden px-5 py-6 sm:px-8 sm:py-9"
      style={
        {
          "--tint": f.cor,
          borderColor: `color-mix(in oklab, ${f.cor} 22%, var(--color-line))`,
        } as CSSProperties
      }
    >
      {/* O brilho de ambiente, atras da arte. E o mesmo recurso da faixa de cena
          da home: circulo enorme e muito diluido em vez de retangulo colorido —
          retangulo pintado volta a ser card com cor, que e o que saiu. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            `radial-gradient(52% 120% at 12% 50%, color-mix(in oklab, ${f.cor} 18%, transparent), transparent 72%)`,
        }}
      />

      <div className="flex flex-wrap items-center gap-5 sm:gap-8">
        <span className="anim-in shrink-0" style={{ "--d": "40ms" } as CSSProperties}>
          <Sprite
            src={`/images/icons/${f.arte}.png`}
            alt=""
            size={104}
            priority
            /* A arte cresceu (88 -> 128 no largo). Ela e o "onde eu estou", e num
               topo que agora tem titulo de cena ao lado, arte de 88 vira selo. */
            className="[--sprite:84px] drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] sm:[--sprite:128px]"
            fallback={<Icone size={56} strokeWidth={1.5} style={{ color: f.cor }} />}
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="anim-in" style={{ "--d": "90ms" } as CSSProperties}>
            <Eyebrow tint={`color-mix(in oklab, ${f.cor} 72%, white)`}>{f.chamada}</Eyebrow>
          </span>

          <span className="anim-in" style={{ "--d": "150ms" } as CSSProperties}>
            {/* Mesmo tratamento do titulo da cena na home, um degrau menor: e a
                mesma peca, e a pessoa acabou de vir de la. Corpo diferente pra
                mesma coisa faz a segunda tela parecer outro site. */}
            <DisplayTitle as="h1" size="md" tint={f.cor}>
              {f.nome}
            </DisplayTitle>
          </span>

          <p
            className="anim-in max-w-2xl text-[14px] leading-relaxed text-text-dim sm:text-[15px]"
            style={{ "--d": "215ms" } as CSSProperties}
          >
            {f.linha}
          </p>
        </div>

        {marcas || acoes ? (
          <div
            className="anim-in flex shrink-0 items-center gap-3"
            style={{ "--d": "270ms" } as CSSProperties}
          >
            {marcas}
            {acoes}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * A pilula de escala da faixa.
 *
 * Numero grande em cima, o que ele conta embaixo — o mesmo argumento do bloco de
 * catalogo da home, no tamanho de um selo.
 *
 * O numero vai no MONO (`.num`), como toda coluna de numero do site depois da
 * troca de familia: a Lexend nao tem digito de largura fixa, e duas marcas lado
 * a lado com larguras diferentes desalinham a base do rotulo embaixo.
 */
export function HeroMarca({
  n,
  children,
  cor,
}: {
  n: number;
  children: ReactNode;
  /** quando dado, o numero sai na cor da ferramenta em vez da neutra */
  cor?: string;
}) {
  return (
    <span className="flex flex-col items-end gap-1 border-l border-line/70 py-1 pl-4">
      <span
        className="num text-[22px] leading-none font-bold sm:text-[26px]"
        style={cor ? { color: cor } : undefined}
      >
        {n.toLocaleString("pt-BR")}
      </span>
      <span className="pix text-[10px] whitespace-nowrap text-text-mute">{children}</span>
    </span>
  );
}
