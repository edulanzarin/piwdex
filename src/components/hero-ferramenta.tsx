import type { CSSProperties, ReactNode } from "react";
import { Sprite } from "@/components/ui";
import { ferramentaDe } from "@/lib/ferramentas";

/**
 * A faixa de topo de uma ferramenta.
 *
 * O que existia antes era um ROTULO: arte de 44px, a palavra na cor da
 * ferramenta, e o resto da linha vazio. Abrir a Hunt e abrir a Meta davam a
 * mesma imagem com uma palavra trocada, e a tela que faz a conta mais pesada do
 * site comecava parecendo o cabecalho de um documento.
 *
 * A faixa agora responde as tres perguntas de quem acabou de chegar, na ordem
 * em que elas aparecem: onde eu estou (arte grande, com a cor pintando a faixa
 * inteira), como isso se chama (o titulo aceso) e o que isso faz (uma frase, a
 * `linha` da ferramenta). O quarto slot, `marcas`, e opcional e serve pra tela
 * dizer o TAMANHO do que ela tem — "482 espécies" prova o catalogo antes de
 * qualquer rolagem.
 *
 * A decoracao toda sai de `--tint`, escrita aqui uma vez. Wash, grade, facho,
 * cantoneira, halo, titulo e o fio de baixo leem essa variavel — trocar a cor da
 * ferramenta em `lib/ferramentas.ts` repinta a faixa inteira, e nao ha um hex
 * sequer neste arquivo.
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
      className="hero panel px-4 py-5 sm:px-6 sm:py-7"
      style={
        {
          "--tint": f.cor,
          // A borda do painel entra na cor da ferramenta, senao a faixa fica
          // pintada por dentro e cinza na moldura.
          borderColor: `color-mix(in oklab, ${f.cor} 30%, var(--color-line))`,
        } as CSSProperties
      }
    >
      {/* O facho que atravessa: "console ligado". */}
      <span className="hero-facho" aria-hidden="true" />

      {/* As quatro cantoneiras. Cada uma so desenha os DOIS lados do seu canto —
          quatro cantos marcados leem como mira; quatro caixinhas, como erro. */}
      <span aria-hidden="true" className="pix-canto top-0 left-0 border-t-2 border-l-2" />
      <span aria-hidden="true" className="pix-canto top-0 right-0 border-t-2 border-r-2" />
      <span aria-hidden="true" className="pix-canto bottom-0 left-0 border-b-2 border-l-2" />
      <span aria-hidden="true" className="pix-canto right-0 bottom-0 border-r-2 border-b-2" />

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* A arte tem tamanho de FIGURA e e o primeiro degrau da entrada. O
            `anim-in` fica no involucro e o `anim-float` na arte: sao duas
            animacoes, e duas animacoes no mesmo elemento significam uma so —
            a ultima classe vence e a outra some sem aviso. */}
        <span className="anim-in shrink-0" style={{ "--d": "40ms" } as CSSProperties}>
          <span className="hero-halo anim-float grid place-items-center">
            <Sprite
              src={`/images/icons/${f.arte}.png`}
              alt=""
              size={88}
              priority
              className="[--sprite:64px] sm:[--sprite:88px]"
              fallback={<Icone size={42} strokeWidth={1.6} style={{ color: f.cor }} />}
            />
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span
            className="anim-in pix flex items-center gap-2 text-[10px] text-text-mute"
            style={{ "--d": "90ms" } as CSSProperties}
          >
            {/* O LED e quadrado porque tudo aqui e: canto reto e a regra do tema,
                e um circulo no meio de uma faixa de cantos retos chama atencao
                pelo motivo errado. */}
            <span
              aria-hidden="true"
              className="anim-led h-[6px] w-[6px] shrink-0"
              style={{
                backgroundColor: f.cor,
                boxShadow: `0 0 8px 0 ${f.cor}`,
              }}
            />
            ferramenta
          </span>

          <h1
            className="anim-in pix tint-glow text-[27px] leading-none sm:text-[35px]"
            style={{ color: f.cor, "--d": "150ms" } as CSSProperties}
          >
            {f.nome}
          </h1>

          <p
            className="anim-in max-w-2xl text-[14px] leading-relaxed text-text-dim sm:text-[15px]"
            style={{ "--d": "215ms" } as CSSProperties}
          >
            {f.linha}
          </p>
        </div>

        {marcas || acoes ? (
          <div
            className="anim-in flex shrink-0 items-center gap-2"
            style={{ "--d": "270ms" } as CSSProperties}
          >
            {marcas}
            {acoes}
          </div>
        ) : null}
      </div>

      {/* O fio de baixo na cor, esmaecendo pra direita: fecha a faixa sem uma
          borda inteira, que competiria com as cantoneiras. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: `linear-gradient(90deg, ${f.cor}, transparent 62%)` }}
      />
    </header>
  );
}

/**
 * A pilula de escala do heroi.
 *
 * Numero grande em cima, o que ele conta embaixo. E o mesmo argumento do card
 * de catalogo da home, no tamanho de um selo: prova que a ferramenta tem
 * conteudo antes de a pessoa rolar pra ver.
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
    <span className="flex flex-col items-end gap-0.5 border-l border-line/80 py-1 pl-3">
      <span
        className="text-[20px] leading-none font-bold tabular sm:text-[24px]"
        style={cor ? { color: cor } : undefined}
      >
        {n.toLocaleString("pt-BR")}
      </span>
      <span className="pix text-[10px] whitespace-nowrap text-text-mute">{children}</span>
    </span>
  );
}
