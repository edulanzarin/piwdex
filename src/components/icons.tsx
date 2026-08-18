// Icones da UI: lucide (linha, currentColor), embrulhados pra manter a MESMA API
// (size/className) dos antigos icones pixel — os ~48 consumidores nao mudam.
// Decisao do Eduardo (ago/2026): icone normal/moderno; o pixel fica nos sprites do jogo.

import type { LucideIcon } from "lucide-react";
import {
  Coins, Gem, Star as LStar, Bell as LBell, Heart as LHeart, Zap, Skull as LSkull,
  Clock as LClock, ChevronDown, Check as LCheck, X, ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight, Plus as LPlus, Minus as LMinus, Infinity as LInfinity,
  ArrowDown as LArrowDown, User, Bot, Signal as LSignal, Target as LTarget,
  Flag as LFlag, Brain as LBrain, ChartColumn, Sword as LSword, Backpack as LBackpack,
  Settings, MessageCircle, DollarSign, ShoppingBag,
} from "lucide-react";

type IconProps = { size?: number; className?: string };

const wrap = (Icon: LucideIcon, defSize = 12) =>
  function Wrapped({ size = defSize, className = "" }: IconProps) {
    return <Icon size={size} className={className} aria-hidden />;
  };

export const Coin = wrap(Coins, 14);
export const Diamond = wrap(Gem, 12);
export const Star = wrap(LStar, 12);
export const Bell = wrap(LBell, 20);
export const Heart = wrap(LHeart, 12);
export const Xp = wrap(Zap, 12);
export const Skull = wrap(LSkull, 12);
export const Clock = wrap(LClock, 12);
export const Caret = wrap(ChevronDown, 12);
export const Check = wrap(LCheck, 12);
export const Close = wrap(X, 12);
export const ChevronLeft = wrap(LChevronLeft, 12);
export const ChevronRight = wrap(LChevronRight, 12);
export const Plus = wrap(LPlus, 12);
export const Minus = wrap(LMinus, 12);
export const Infinity_ = wrap(LInfinity, 14);
export const ArrowDown = wrap(LArrowDown, 12);
export const Trainer = wrap(User, 14);
export const Robot = wrap(Bot, 14);
export const Signal = wrap(LSignal, 12);
export const Target = wrap(LTarget, 12);
export const Flag = wrap(LFlag, 12);
export const Brain = wrap(LBrain, 12);
export const Chart = wrap(ChartColumn, 12);
export const Sword = wrap(LSword, 12);
export const Backpack = wrap(LBackpack, 12);
export const Gear = wrap(Settings, 12);
export const Bubble = wrap(MessageCircle, 12);
export const Dollar = wrap(DollarSign, 12);
/** Saco de loot (ITENS: coletados, vendidos, comprados). Dinheiro usa Coin/Dollar;
 *  item usa Loot — nao misturar os dois conceitos. */
export const Loot = wrap(ShoppingBag, 12);

/** Preco em dolares do jogo: moeda + valor. */
export function Gold({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Coin />
      {value.toLocaleString("pt-BR")}
    </span>
  );
}
