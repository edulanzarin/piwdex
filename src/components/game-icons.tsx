/**
 * Icones de DOMINIO — stat, categoria de golpe, raridade, marcador.
 *
 * Separados dos de interface porque falam do JOGO: um chevron serve qualquer
 * app, "ataque especial" nao.
 *
 * ## Os principais sao DESENHADOS aqui, e cheios
 *
 * Eles eram lucide embrulhado. O Eduardo pediu um traco que combinasse mais com
 * um site de jogo, e a resposta nao foi trocar de biblioteca — foi trocar de
 * REGISTRO. Os de dominio agora sao caminhos proprios, solidos, desenhados num
 * `viewBox` de 24 pra serem lidos a 14px, que e onde 16 dos 21 usos vivem.
 *
 * Cheio e nao de traco de proposito: contorno de 2px a 14px perde metade da
 * forma pro antisserrilhado, e o que sobra e cinza. Massa se le. E vale o aviso
 * que vem com a troca — glifo cheio pesa MAIS que traco no mesmo tamanho, entao
 * quem trocar outros depois tem de conferir no tamanho de uso, e nao no editor.
 *
 * ## A silhueta continua sendo o criterio
 *
 * Cada forma foi escolhida pra nao virar a mesma mancha do vizinho: coracao /
 * espada / escudo / estouro / escudo-com-estouro / seta. Os dois "especiais"
 * (AES e DES) carregam o mesmo estouro que o ataque especial usa sozinho — e o
 * par escudo/escudo-com-estouro diz "defesa" e "defesa contra o especial" sem
 * pedir legenda.
 *
 * O que continua lucide e o que nao ganharia nada: pacote, loja, balanca,
 * pessoas. Redesenhar um pacote a mao gasta uma tarde e devolve o mesmo pacote.
 */
import {
  Award,
  HandCoins,
  CreditCard,
  Diamond,
  HeartPulse,
  Package,
  Pill,
  Shapes,
  Store,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Sparkle,
  Sparkles,
  Swords,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AttackCategory } from "@/lib/types";
import type { ItemCategory } from "@/lib/items";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { iconeUrl } from "@/lib/ferramentas";

export interface GameIconProps {
  size?: number;
  className?: string;
}

const MIN = 14;

/**
 * O glifo desenhado aqui. Mesma API do `wrap` — `{ size, className }` — pra a
 * troca nao tocar em nenhuma das ~200 chamadas espalhadas pelo site.
 *
 * `fill="currentColor"` e o que faz o icone herdar a cor do texto ao redor, como
 * o lucide fazia: as chamadas passam `text-warn`, `text-ok` e afins, e nada
 * disso pode parar de funcionar.
 */
function glifo(nome: string, corpo: ReactNode) {
  const C = ({ size = 16, className }: GameIconProps) => (
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
export const IconHp = glifo("IconHp",
  <><path d="M12 21.2 3.9 13c-2.3-2.4-2.3-6.2 0-8.5a5.7 5.7 0 0 1 8.1 0 5.7 5.7 0 0 1 8.1 0c2.3 2.3 2.3 6.1 0 8.5z"/></>,
);

export const IconAtk = glifo("IconAtk",
  <><path d="M12 1.2 14.6 5v8.6H9.4V5z"/>
    <path d="M6.6 13.6h10.8a1.1 1.1 0 0 1 1.1 1.1v1.1a1.1 1.1 0 0 1-1.1 1.1H6.6a1.1 1.1 0 0 1-1.1-1.1v-1.1a1.1 1.1 0 0 1 1.1-1.1z"/>
    <path d="M10.7 17.4h2.6v2.4h-2.6z"/>
    <path d="M12 19.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z"/></>,
);

export const IconDef = glifo("IconDef",
  <><path d="M12 1.8 3.4 5v6.4c0 5.3 3.6 9.4 8.6 10.8 5-1.4 8.6-5.5 8.6-10.8V5z"/></>,
);

export const IconSpAtk = glifo("IconSpAtk",
  <><path d="M12 1.2c.5 0 .9.3 1 .8l1.4 6.4a2 2 0 0 0 1.2 1.2l6.4 1.4a1 1 0 0 1 0 2l-6.4 1.4a2 2 0 0 0-1.2 1.2L13 22a1 1 0 0 1-2 0l-1.4-6.4a2 2 0 0 0-1.2-1.2L2 13a1 1 0 0 1 0-2l6.4-1.4a2 2 0 0 0 1.2-1.2L11 2a1 1 0 0 1 1-.8z"/></>,
);

export const IconSpDef = glifo("IconSpDef",
  <><path d="M12 1.8 3.4 5v6.4c0 5.3 3.6 9.4 8.6 10.8 5-1.4 8.6-5.5 8.6-10.8V5zm0 4.6 1.4 3.4 3.4 1.4-3.4 1.4L12 16l-1.4-3.4-3.4-1.4 3.4-1.4z"/></>,
);

export const IconSpeed = glifo("IconSpeed",
  <><path d="M1.6 8.2h6a1.4 1.4 0 0 1 0 2.8h-6a1.4 1.4 0 0 1 0-2.8z"/>
    <path d="M1.6 13h4a1.4 1.4 0 0 1 0 2.8h-4a1.4 1.4 0 0 1 0-2.8z"/>
    <path d="M13.8 2.2 22 11a1.4 1.4 0 0 1 0 2l-8.2 8.8a1.4 1.4 0 0 1-2.4-1V15H10a1.4 1.4 0 0 1 0-2.8h1.4V4.2a1.4 1.4 0 0 1 2.4-1z"/></>,
);


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
export const IconGem = glifo("IconGem",
  <><path d="M7.6 2.4h8.8l4.8 5.6-9.2 13.6L2.8 8z"/></>,
);
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
export const IconTm = glifo("IconTm",
  <><path d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6zm0 6.4a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z"/>
    <path d="M12 4.6a1.2 1.2 0 0 1 1.2 1.2A1.2 1.2 0 0 1 12 7a1.2 1.2 0 0 1 0-2.4z" fill="none"/></>,
);
export const IconBag = glifo("IconBag",
  <><path d="M8.4 6V5a3.6 3.6 0 0 1 7.2 0v1h2.2a1 1 0 0 1 1 .9l1.1 12.4a2 2 0 0 1-2 2.2H6.1a2 2 0 0 1-2-2.2L5.2 6.9a1 1 0 0 1 1-.9zm2.4 0h2.4V5a1.2 1.2 0 0 0-2.4 0z"/></>,
);
export const IconLevel = glifo("IconLevel",
  <><path d="M3 19.6h3.6a1 1 0 0 0 1-1v-4.9a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4.9a1 1 0 0 0 1 1z"/>
    <path d="M10.2 19.6h3.6a1 1 0 0 0 1-1V9.4a1 1 0 0 0-1-1h-3.6a1 1 0 0 0-1 1v9.2a1 1 0 0 0 1 1z"/>
    <path d="M17.4 19.6H21a1 1 0 0 0 1-1V4.4a1 1 0 0 0-1-1h-3.6a1 1 0 0 0-1 1v14.2a1 1 0 0 0 1 1z"/></>,
);
export const IconXp = glifo("IconXp",
  <><path d="m12 1.6 3.1 6.4 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1z"/></>,
);
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
export const IconChance = glifo("IconChance",
  <><path d="M6.2 3.4a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>
    <path d="M17.8 15a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>
    <path d="M18.4 3.1a1.3 1.3 0 0 1 1.9 1.8L6.6 20.9a1.3 1.3 0 0 1-1.9-1.8z"/></>,
);

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
/**
 * A arte de RESERVA de cada categoria de item.
 *
 * Ela entra quando o icone do proprio item nao vem — o catalogo aponta pra um
 * arquivo no host do jogo, e quando ele falha o card ficaria com um buraco. Sao
 * slots de 56px no card e 128px na ficha: tamanho de ILUSTRACAO, e nao de glifo,
 * entao aqui vale arte com sombra de contato e rampa de tres tons, como os
 * icones das seis ferramentas.
 *
 * Eram PNG, e passaram a SVG pelo mesmo motivo dos outros: nitidez em qualquer
 * escala e paleta que acompanha o tema. Servidas pelo `iconeUrl` pra levarem a
 * versao — arquivo em `public/` nao e invalidado por republicar.
 */
export const ITEM_CATEGORY_ART: Record<ItemCategory, string> = {
  loot: iconeUrl("item-drop"),
  stone: iconeUrl("item-pedra"),
  heal: iconeUrl("item-cura"),
  revive: iconeUrl("item-reviver"),
  clan: iconeUrl("item-cla"),
  tm: iconeUrl("item-tm"),
  card: iconeUrl("item-carta"),
  misc: iconeUrl("item-diverso"),
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
