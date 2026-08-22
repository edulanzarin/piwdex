/**
 * Icones de DOMINIO — stat, categoria de golpe, raridade, marcador.
 *
 * Separados dos de interface porque falam do JOGO: um chevron serve qualquer
 * app, "ataque especial" nao. Mesmo set (lucide) e mesmo piso de tamanho.
 *
 * Cada um foi escolhido pela SILHUETA, nao pela metafora bonita: a 16px o que
 * se le e a forma geral, e dois icones de contorno parecido no mesmo card viram
 * a mesma mancha. Por isso coracao / espada / escudo / faiscas / meio-escudo /
 * ponteiro — seis contornos que nao se confundem.
 */
import {
  Award,
  HandCoins,
  CreditCard,
  Diamond,
  Disc3,
  Gauge,
  Gem,
  Heart,
  HeartPulse,
  Package,
  Percent,
  Pill,
  Shapes,
  Store,
  Scale,
  ShieldAlert,
  ShieldHalf,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sword,
  Swords,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AttackCategory } from "@/lib/types";
import type { ItemCategory } from "@/lib/items";
import { cn } from "@/lib/cn";

export interface GameIconProps {
  size?: number;
  className?: string;
}

const MIN = 14;

function wrap(Icon: LucideIcon, nome: string) {
  const C = ({ size = 16, className }: GameIconProps) => {
    const s = Math.max(MIN, size);
    return (
      <Icon
        size={s}
        strokeWidth={s <= 16 ? 2.25 : s <= 22 ? 2 : 1.75}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    );
  };
  C.displayName = nome;
  return C;
}

// ---- stats, na ordem canonica ----
export const IconHp = wrap(Heart, "IconHp");
export const IconAtk = wrap(Sword, "IconAtk");
export const IconDef = wrap(Shield, "IconDef");
export const IconSpAtk = wrap(Sparkles, "IconSpAtk");
export const IconSpDef = wrap(ShieldHalf, "IconSpDef");
export const IconSpeed = wrap(Gauge, "IconSpeed");

export const STAT_ICONS = [IconHp, IconAtk, IconDef, IconSpAtk, IconSpDef, IconSpeed] as const;

// ---- categoria do golpe ----
export const IconPhysical = wrap(Swords, "IconPhysical");
export const IconSpecial = wrap(Sparkles, "IconSpecial");
export const IconStatus = wrap(SlidersHorizontal, "IconStatus");

const CATEGORY_ICON: Record<AttackCategory, ReturnType<typeof wrap>> = {
  PHYSICAL: IconPhysical,
  SPECIAL: IconSpecial,
  STATUS: IconStatus,
};

export function CategoryIcon({
  category,
  size = 16,
  className,
}: {
  category: AttackCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  return Icon ? <Icon size={size} className={className} /> : null;
}

// ---- marcadores ----
export const IconGem = wrap(Gem, "IconGem");
export const IconTm = wrap(Disc3, "IconTm");
export const IconBag = wrap(Package, "IconBag");
export const IconLevel = wrap(TrendingUp, "IconLevel");
export const IconXp = wrap(Star, "IconXp");
export const IconWeak = wrap(ShieldAlert, "IconWeak");
export const IconTarget = wrap(Target, "IconTarget");
export const IconScale = wrap(Scale, "IconScale");
export const IconAward = wrap(Award, "IconAward");
// Apoio: mao com moeda. Nao e coracao — `Heart` ja e VIDA na espinha de stats, e
// dois coracoes com significados diferentes na mesma pagina viram a mesma mancha.
export const IconApoio = wrap(HandCoins, "IconApoio");

// ---- categoria do item ----
// Um contorno por categoria, escolhido pra NAO colidir com os de cima: a pedra
// e losango (o `Gem` ja e raridade), a cura e comprimido e o reviver e
// batimento (o `Heart` ja e vida), o cla e gente. Duas manchas iguais no mesmo
// card e o mesmo que nao ter icone.
export const IconLoot = wrap(Package, "IconLoot");
export const IconStone = wrap(Diamond, "IconStone");
export const IconHeal = wrap(Pill, "IconHeal");
export const IconRevive = wrap(HeartPulse, "IconRevive");
export const IconClan = wrap(Users, "IconClan");
export const IconCard = wrap(CreditCard, "IconCard");
export const IconMisc = wrap(Shapes, "IconMisc");
export const IconShop = wrap(Store, "IconShop");
export const IconChance = wrap(Percent, "IconChance");

const ITEM_CATEGORY_ICON: Record<ItemCategory, ReturnType<typeof wrap>> = {
  loot: IconLoot,
  stone: IconStone,
  heal: IconHeal,
  revive: IconRevive,
  clan: IconClan,
  tm: IconTm,
  card: IconCard,
  misc: IconMisc,
};

export function ItemCategoryIcon({
  category,
  size = 16,
  className,
}: {
  category: ItemCategory;
  size?: number;
  className?: string;
}) {
  const Icon = ITEM_CATEGORY_ICON[category] ?? IconMisc;
  return <Icon size={size} className={className} />;
}
