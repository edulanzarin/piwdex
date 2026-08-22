import type { ReactNode } from "react";
import { Sprite } from "@/components/ui";

/**
 * Cabecalho de ferramenta: arte + nome, na cor da ferramenta.
 *
 * As seis artes existiam desde sempre e apareciam num lugar so — os cards da
 * home. Ao ABRIR a ferramenta, a identidade sumia: as seis telas comecavam com
 * um `<h1>` de texto igual ao das outras cinco, e a unica pista de onde voce
 * estava era a palavra. Aqui a mesma arte que te trouxe confirma que voce
 * chegou.
 *
 * A arte tem tamanho de FIGURA (44px), nao de bullet, e encolhe no estreito em
 * vez de espremer o titulo. O `fallback` e obrigatorio pelo mesmo motivo de
 * sempre: arte que nao carregou nao pode virar caixa vazia.
 */
export function TituloFerramenta({
  arte,
  cor,
  children,
  reserva,
  acoes,
}: {
  /** nome do PNG em public/images/icons, sem extensao */
  arte: string;
  /** token de cor da ferramenta, ex.: "var(--color-t-dex)" */
  cor: string;
  children: ReactNode;
  /** icone de linha pra quando o PNG nao vem */
  reserva: ReactNode;
  /** o que vai na ponta direita da linha (opcional) */
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      <Sprite
        src={`/images/icons/${arte}.png`}
        alt=""
        size={44}
        priority
        className="[--sprite:36px] sm:[--sprite:44px]"
        fallback={reserva}
      />
      <h1 className="pix flex-1 text-[22px] leading-none sm:text-[26px]" style={{ color: cor }}>
        {children}
      </h1>
      {acoes}
    </div>
  );
}
