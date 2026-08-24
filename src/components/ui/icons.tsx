/**
 * Icones da interface.
 *
 * Sao os do **lucide** — traco fino, canto arredondado, desenho moderno. A
 * versao anterior era pixel art 8x8 desenhada a mao e o Eduardo reprovou
 * ("muito feios, quero moderno"). O pixel continua no site, mas onde ele e
 * verdade: nos sprites do jogo e no wallpaper.
 *
 * **A troca nao e so trocar o componente.** Glifo cheio de 8px e traco de 1,5px
 * nao vivem na mesma escala: o pixel preenchia a caixa inteira, o traco desenha
 * so a borda e some no mesmo tamanho. Por isso existe um PISO de tamanho aqui —
 * abaixo de 14px um icone de linha vira borrao — e a espessura sobe um pouco
 * nos tamanhos pequenos, pra o traco nao sumir.
 */
import {
  ArrowLeftRight,
  Check,
  Eraser,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DollarSign,
  MessageSquare,
  ScrollText,
  Filter,
  Info,
  LayoutGrid,
  Link2,
  Menu,
  Minus,
  Plus,
  Rows3,
  Search,
  Sparkles,
  Star,
  ArrowUpDown,
  Wand2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconProps {
  size?: number;
  className?: string;
}

/** Piso de 14px e espessura compensada — ver o comentario do topo. */
const MIN = 14;

/**
 * Glifo desenhado aqui, mesma API do `wrap`.
 *
 * Existe pra as duas pecas deste arquivo que NAO sao chrome: moeda e marcador de
 * lugar falam do jogo, e foram junto com os de dominio pro registro solido. O
 * resto — chevron, busca, fechar, grade — continua lucide de proposito: ninguem
 * olha uma seta e sente falta de personalidade, e desenhar quinze delas a mao
 * gasta uma tarde pra devolver as mesmas quinze setas.
 */
function glifo(nome: string, corpo: ReactNode) {
  const C = ({ size = 16, className }: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      width={Math.max(MIN, size)}
      height={Math.max(MIN, size)}
      fill="currentColor"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      {corpo}
    </svg>
  );
  C.displayName = nome;
  return C;
}

function wrap(Icon: LucideIcon, nome: string) {
  const C = ({ size = 16, className }: IconProps) => {
    const s = Math.max(MIN, size);
    return (
      <Icon
        size={s}
        strokeWidth={s <= 16 ? 2.25 : s <= 22 ? 2 : 1.75}
        absoluteStrokeWidth={false}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    );
  };
  C.displayName = nome;
  return C;
}

export const IconSearch = wrap(Search, "IconSearch");
export const IconClose = wrap(X, "IconClose");
export const IconCheck = wrap(Check, "IconCheck");
export const IconChevronDown = wrap(ChevronDown, "IconChevronDown");
export const IconChevronUp = wrap(ChevronUp, "IconChevronUp");
export const IconChevronLeft = wrap(ChevronLeft, "IconChevronLeft");
export const IconChevronRight = wrap(ChevronRight, "IconChevronRight");
export const IconFilter = wrap(Filter, "IconFilter");
export const IconGrid = wrap(LayoutGrid, "IconGrid");
export const IconRows = wrap(Rows3, "IconRows");
export const IconMenu = wrap(Menu, "IconMenu");
export const IconSort = wrap(ArrowUpDown, "IconSort");
export const IconStar = wrap(Star, "IconStar");
export const IconPlus = wrap(Plus, "IconPlus");
export const IconMinus = wrap(Minus, "IconMinus");
export const IconInfo = wrap(Info, "IconInfo");
export const IconLink = wrap(Link2, "IconLink");
export const IconSwap = wrap(ArrowLeftRight, "IconSwap");
export const IconBolt = wrap(Zap, "IconBolt");
export const IconCoin = glifo("IconCoin",
  <><path d="M12 2.2c5.4 0 9.8 2.2 9.8 4.9S17.4 12 12 12 2.2 9.8 2.2 7.1 6.6 2.2 12 2.2z"/>
    <path d="M2.2 10.3C4 11.8 7.7 12.8 12 12.8s8-1 9.8-2.5v2.5c0 2.7-4.4 4.9-9.8 4.9s-9.8-2.2-9.8-4.9z"/>
    <path d="M2.2 15.9c1.8 1.5 5.5 2.5 9.8 2.5s8-1 9.8-2.5v1.2c0 2.7-4.4 4.9-9.8 4.9s-9.8-2.2-9.8-4.9z"/></>,
);
/** A moeda do Poke Idle World e DOLAR, e nao ouro. O icone acompanha o nome:
 *  moeda generica ao lado do rotulo "dolares" faz o olho ler outra grandeza. */
export const IconDollar = wrap(DollarSign, "IconDollar");
export const IconChat = wrap(MessageSquare, "IconChat");
export const IconRegistro = wrap(ScrollText, "IconRegistro");
export const IconPin = glifo("IconPin",
  <><path d="M12 1.8a7.4 7.4 0 0 0-7.4 7.4c0 5.3 6.4 12.2 6.7 12.5a1 1 0 0 0 1.4 0c.3-.3 6.7-7.2 6.7-12.5A7.4 7.4 0 0 0 12 1.8zm0 4.6a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z"/></>,
);
export const IconEvolve = wrap(Sparkles, "IconEvolve");
/* As duas acoes que TODA ferramenta tem no cabecalho. Elas eram texto puro no
   meio de uma fila de botoes com glifo, e por isso liam como link solto em vez
   de acao. A varinha e a borracha sao o par que se le sem legenda: uma preenche
   sozinha, a outra apaga. */
export const IconExemplo = wrap(Wand2, "IconExemplo");
export const IconLimpar = wrap(Eraser, "IconLimpar");
