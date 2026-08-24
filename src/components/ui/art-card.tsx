import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * O CARTAO DE ARTE: imagem em cima, placa escura embaixo.
 *
 * E a forma da grade de campeoes da referencia, e ela resolve um problema que o
 * card comum nao resolve: quando a ARTE e o argumento, qualquer moldura, padding
 * ou fundo em volta dela rouba area do argumento. Aqui a arte encosta nas tres
 * bordas e a unica chrome e uma placa fina embaixo com o nome.
 *
 * ## A placa nao flutua sobre a arte
 *
 * Poe-la por cima, com gradiente, e a tentacao obvia — parece mais integrado. Mas
 * nome sobre imagem depende do que a imagem tem naquele trecho, e uma grade tem
 * dezenas de imagens diferentes: em metade delas o texto cai sobre area clara e
 * some. A placa SOLIDA abaixo custa uns pixels de altura e nunca falha.
 *
 * ## O hover
 *
 * A arte cresce um tico DENTRO da caixa (a caixa nao muda de tamanho, senao a
 * grade inteira reflui) e a placa acende na cor. E a leitura de "esta peca e
 * clicavel" sem precisar de botao dentro do card — botao dentro de card clicavel
 * cria dois alvos concorrentes pra mesma acao.
 */

export interface ArtCardProps {
  href: string;
  /** a arte: um `<Sprite>`, um `<img>`, o que for. Ela preenche o topo */
  art: ReactNode;
  /** a linha pequena acima do nome — funcao, tipo, categoria */
  eyebrow?: ReactNode;
  name: ReactNode;
  /** a cor que acende no hover e pinta o fio */
  tint?: string;
  /** proporcao da area de arte. `alta` e retrato (grade de personagem) */
  shape?: "alta" | "quadrada" | "larga";
  className?: string;
  style?: CSSProperties;
}

const FORMA = {
  alta: "aspect-[3/4]",
  quadrada: "aspect-square",
  larga: "aspect-[4/3]",
} as const;

export function ArtCard({
  href,
  art,
  eyebrow,
  name,
  tint,
  shape = "alta",
  className,
  style,
}: ArtCardProps) {
  const cor = tint ?? "var(--color-accent)";
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-pix-lg",
        "border border-line bg-surface transition-[border-color,box-shadow,transform] duration-200",
        "hover:border-[color:var(--cor)] hover:shadow-elev-3",
        "motion-safe:hover:-translate-y-1",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      style={{ ...style, "--cor": cor } as CSSProperties}
    >
      <span
        className={cn(
          "relative grid w-full place-items-center overflow-hidden bg-bg-soft",
          FORMA[shape],
        )}
      >
        {/* O brilho da cor por tras da arte, so no hover: e o que faz a peca
            "acender" sem mexer na propria imagem. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(70% 70% at 50% 60%, color-mix(in oklab, ${cor} 26%, transparent), transparent 72%)`,
          }}
        />
        <span
          className={cn(
            "relative grid h-full w-full place-items-center p-4",
            "transition-transform duration-300 ease-out",
            "motion-safe:group-hover:scale-105",
          )}
        >
          {art}
        </span>
      </span>

      {/* A placa. `border-t` e nao sombra: a separacao entre arte e nome tem que
          ser uma linha limpa, e sombra sobre imagem varia com o que a imagem tem
          ali embaixo. */}
      <span className="flex flex-col gap-0.5 border-t border-line bg-surface-2/80 px-3.5 py-3 transition-colors duration-200 group-hover:bg-surface-3/80">
        {eyebrow && (
          <span className="pix text-[9px] tracking-[0.16em] text-text-mute">{eyebrow}</span>
        )}
        <span
          className="pix text-[13px] transition-colors duration-200 text-text-dim group-hover:text-[color:var(--cor)]"
        >
          {name}
        </span>
      </span>
    </Link>
  );
}

/**
 * O LINK DE EXPLORAR: caixa alta miuda, tracking largo, seta que anda.
 *
 * Ele existe pra um caso especifico e vale marcar a fronteira: quando a acao ja
 * esta obvia pelo contexto (o card inteiro e clicavel, a secao inteira e sobre
 * aquilo), um BOTAO seria peso demais — ele promete uma decisao onde so ha
 * continuidade. Este link diz "tem mais por aqui" sem pedir escolha.
 *
 * A seta anda no hover, e e so ela que anda: mover o texto junto faz a linha
 * inteira tremer e o olho perde a palavra que estava lendo.
 */
export function ExploreLink({
  href,
  children,
  tint,
  className,
}: {
  href: string;
  children: ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "pix group inline-flex items-center gap-2.5 text-[11px] tracking-[0.2em]",
        "text-text-mute transition-colors duration-200 hover:text-[color:var(--cor)]",
        className,
      )}
      style={{ "--cor": tint ?? "var(--color-accent)" } as CSSProperties}
    >
      {children}
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="h-px w-4 bg-current opacity-50 transition-all duration-200 group-hover:w-6 group-hover:opacity-100" />
        <span className="text-[13px] leading-none">›</span>
      </span>
    </Link>
  );
}
