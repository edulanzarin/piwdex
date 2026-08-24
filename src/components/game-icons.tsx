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
  Sparkle,
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
/**
 * RARO — e por que nao e o `IconGem`.
 *
 * O losango do `Gem` ja carrega outro significado nesta interface: ele e a
 * RARIDADE do pokemon, a escada de seis degraus (comum ate mitico). Usa-lo
 * tambem pra "item raro" faz o mesmo simbolo dizer duas coisas em telas que
 * aparecem juntas — a ficha da especie mostra o losango da raridade no topo e o
 * losango de item raro na tabela de drops, a vinte centimetros um do outro.
 *
 * `Sparkle` (singular, diferente do `Sparkles` que marca ataque especial) diz
 * "isto aqui e incomum" sem disputar com a escada.
 */
export const IconRare = wrap(Sparkle, "IconRare");
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

/**
 * ARTE pixel por categoria de item — o caminho do PNG, nao o componente.
 *
 * Fica como dado (e nao como um componente que ja renderiza) porque este modulo
 * e de servidor e o `Sprite` e client: exportar o caminho deixa cada tela montar
 * a arte no tamanho que ela usa, sem arrastar a fronteira de cliente pra ca.
 *
 * REGRA DE TAMANHO: esta arte e de FIGURA, de 24px pra cima. Nos slots miudos
 * (chip de filtro, celula de tabela, 14-16px) o certo continua sendo o icone de
 * linha acima — pixel art nesse tamanho ja foi tentada neste projeto e reprovada,
 * e e por isso que o lucide entrou. Ver o cabecalho de scripts/pixel-icons/arte.py.
 */
export const ITEM_CATEGORY_ART: Record<ItemCategory, string> = {
  loot: "/images/icons/item-drop.png",
  stone: "/images/icons/item-pedra.png",
  heal: "/images/icons/item-cura.png",
  revive: "/images/icons/item-reviver.png",
  clan: "/images/icons/item-cla.png",
  tm: "/images/icons/item-tm.png",
  card: "/images/icons/item-carta.png",
  misc: "/images/icons/item-diverso.png",
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

/**
 * O SELO de item raro.
 *
 * Existia em TRES lugares com tres formas: chip com losango minusculo no card do
 * item, `<span>` de texto minusculo na linha da tabela de itens, e outro chip com
 * losango na tabela de drops da ficha. Tres desenhos pro mesmo fato — e o
 * terceiro so foi descoberto porque o Eduardo apontou o primeiro.
 *
 * Caixa ALTA, e nao "raro" em caixa baixa: a palavra e um SELO, e selo em caixa
 * baixa no meio de uma linha de texto le como parte da frase — na tabela de
 * drops, "Bulb raro" parecia o nome do item.
 */
export function SeloRaro({ size = "xs" }: { size?: "xs" | "sm" }) {
  return (
    <span
      className={[
        "pix inline-flex shrink-0 items-center gap-1 rounded-pill border",
        "border-accent/35 bg-accent/12 text-accent",
        size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
      ].join(" ")}
      title="Item raro"
    >
      <IconRare size={size === "xs" ? 11 : 13} />
      raro
    </span>
  );
}
