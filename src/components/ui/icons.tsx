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
  Coins,
  DollarSign,
  MessageSquare,
  ScrollText,
  Filter,
  Info,
  LayoutGrid,
  Link2,
  MapPin,
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
import { cn } from "@/lib/cn";

export interface IconProps {
  size?: number;
  className?: string;
}

/** Piso de 14px e espessura compensada — ver o comentario do topo. */
const MIN = 14;

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
export const IconCoin = wrap(Coins, "IconCoin");
/** A moeda do Poke Idle World e DOLAR, e nao ouro. O icone acompanha o nome:
 *  moeda generica ao lado do rotulo "dolares" faz o olho ler outra grandeza. */
export const IconDollar = wrap(DollarSign, "IconDollar");
export const IconChat = wrap(MessageSquare, "IconChat");
export const IconRegistro = wrap(ScrollText, "IconRegistro");
export const IconPin = wrap(MapPin, "IconPin");
export const IconEvolve = wrap(Sparkles, "IconEvolve");
/* As duas acoes que TODA ferramenta tem no cabecalho. Elas eram texto puro no
   meio de uma fila de botoes com glifo, e por isso liam como link solto em vez
   de acao. A varinha e a borracha sao o par que se le sem legenda: uma preenche
   sozinha, a outra apaga. */
export const IconExemplo = wrap(Wand2, "IconExemplo");
export const IconLimpar = wrap(Eraser, "IconLimpar");
