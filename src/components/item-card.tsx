import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ItemEntry } from "@/lib/items";
import { killsPerUnit } from "@/lib/items";
import { assetIconUrl, spriteUrl } from "@/lib/sprites";
import { Chip, IconCoin, Sprite, Tooltip } from "@/components/ui";
import {
  IconChance,
  IconGem,
  IconLevel,
  IconLoot,
  IconShop,
  ItemCategoryIcon,
} from "@/components/game-icons";
import { ITEM_CATEGORY_LABEL, ITEM_ORIGIN_LABEL, compact } from "@/lib/labels";

/**
 * Card de item.
 *
 * O que ele responde sem clique: o que e o item, quanto o Mark paga, **de onde
 * vem** e quao dificil e tirar um. As duas ultimas sao a razao da pagina
 * existir — o catalogo do jogo diz "o Bulbasaur dropa Bulb" e nunca o
 * contrario, entao "quem dropa isso?" nao tem resposta em lugar nenhum.
 *
 * A linha de baixo e sempre a MESMA pergunta ("de onde vem"), respondida no
 * nivel que o dado permite: a melhor fonte farmavel com nome e nivel; ou o
 * aviso de que so cai de quem nao se caca; ou a origem (loja/exclusivo).
 */

/**
 * Chance formatada.
 *
 * Duas armadilhas do dado real, e as duas viram regra aqui:
 *
 * 1. **Chance minuscula nao pode virar "0%".** 44 linhas do catalogo caem
 *    abaixo de 0,01% — o Corsola dropa Air Tank a 0,00001%. Arredondar isso
 *    pra zero AFIRMA que nao cai, que e falso, e apaga justamente o numero que
 *    so o piwdex mostra. Por isso as casas crescem conforme o valor encolhe, e
 *    abaixo da resolucao a resposta e "<0,0001%", nunca "0%".
 * 2. **Zero LITERAL fica zero.** 346 linhas (todas de Strange Pheromone) vem
 *    com `chance: 0` na fonte. Isso e o que o catalogo diz, entao e o que a
 *    tela mostra — quem explica o caso e a ficha do item, nao um numero
 *    inventado aqui.
 */
export function pctText(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.0001) return "<0,0001%";
  const s = p < 0.01 ? p.toFixed(4) : p < 1 ? p.toFixed(3) : p.toFixed(2);
  return `${s.replace(".", ",").replace(/,?0+$/, "")}%`;
}

/**
 * "1 a cada N abates" — a chance traduzida pro gesto de quem farma.
 *
 * O topo da escala precisa de tres frases, nao de duas: 100% e "todo abate",
 * 95% arredonda pra um abate mas NAO e todo abate, e o resto e a contagem. Com
 * duas frases so, ou 95% vira a promessa falsa de "todo abate", ou vira o
 * "1 a cada 1 abates" que nao e portugues.
 */
export function killsText(e: ItemEntry): string | null {
  const s = e.bestFarm ?? e.best;
  if (!s) return null;
  const n = killsPerUnit(s);
  if (!Number.isFinite(n)) return null;
  if (s.chancePct >= 100) return "cai em todo abate";
  const r = Math.max(1, Math.round(n));
  return r === 1
    ? "cai em quase todo abate"
    : `1 a cada ${r.toLocaleString("pt-BR")} abates`;
}

/** A linha "de onde vem", no melhor nivel de detalhe que o dado permite. */
function Origem({ e }: { e: ItemEntry }) {
  if (e.bestFarm) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Sprite src={spriteUrl(e.bestFarm.id)} alt={e.bestFarm.name} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text-dim">{e.bestFarm.name}</span>
          <span className="pix text-[11px] text-text-mute">
            nv {e.bestFarm.level || "—"} · {pctText(e.bestFarm.chancePct)}
          </span>
        </span>
      </span>
    );
  }
  if (e.best) {
    // Cai de alguem, mas de ninguem que apareca no mapa: farmar isso e esperar
    // a evolucao ou o cassino, nao escolher uma cacada.
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Sprite src={spriteUrl(e.best.id)} alt={e.best.name} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text-mute">{e.best.name}</span>
          <span className="pix text-[11px] text-warn">sem ponto no mapa</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-text-mute">
      {e.origin === "shop" ? <IconShop size={15} /> : <IconLoot size={15} />}
      {ITEM_ORIGIN_LABEL[e.origin]}
    </span>
  );
}

export function ItemCard({
  e,
  index = 0,
  priority,
}: {
  e: ItemEntry;
  /** posicao no grid — vira o atraso da entrada em cascata */
  index?: number;
  priority?: boolean;
}) {
  const kills = killsText(e);

  return (
    <Link
      href={`/itens/${e.id}`}
      style={{ ["--i" as string]: index }}
      className={cn(
        "panel-card sheen anim-enter group relative flex flex-col gap-3 p-3.5",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-[var(--color-t-itens)]/55",
        "hover:shadow-[0_0_34px_-12px_var(--color-t-itens)]",
        "focus-visible:border-[var(--color-t-itens)]",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="pix flex items-center gap-1.5 text-[11px] text-text-mute">
          <ItemCategoryIcon category={e.category} size={15} />
          {ITEM_CATEGORY_LABEL[e.category]}
        </span>
        {e.rare ? (
          <Chip size="xs" tone="accent" icon={<IconGem size={14} />}>
            raro
          </Chip>
        ) : null}
      </header>

      <div className="relative grid place-items-center py-1">
        <span
          aria-hidden="true"
          className="absolute h-20 w-20 rounded-full bg-[var(--color-t-itens)] opacity-15 blur-2xl transition-all duration-300 group-hover:h-24 group-hover:w-24"
        />
        {/* O icone vem do proprio jogo. Quando ele nao vem, o marcador e a
            categoria — uma pokebola diria que faltou um POKEMON, que e outra
            coisa. */}
        <Sprite
          src={assetIconUrl(e.icon)}
          alt={e.name}
          size={72}
          priority={priority}
          fallback={<ItemCategoryIcon category={e.category} size={30} />}
          className="relative transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110"
        />
      </div>

      <h3
        className="truncate text-[17px] leading-tight font-bold text-text transition-colors group-hover:text-[var(--color-t-itens)]"
        title={e.name}
      >
        {e.name}
      </h3>

      <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-center">
        <div className="flex flex-col gap-1">
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconCoin size={15} />
            {e.goldPrice > 0 ? "Ouro" : "NPC"}
          </dt>
          <dd
            className={cn(
              "text-[17px] leading-none font-bold",
              e.goldPrice > 0 ? "text-neon" : e.npcPrice > 0 ? "text-warn" : "text-text-mute",
            )}
          >
            {e.goldPrice > 0 ? compact(e.goldPrice) : e.npcPrice > 0 ? compact(e.npcPrice) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 border-l border-line">
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconChance size={15} />
            Fontes
          </dt>
          <dd className="text-[17px] leading-none font-bold text-text">
            {e.sources || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
        <Origem e={e} />
        {kills ? (
          <span className="pix text-[11px] text-text-mute">{kills}</span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Linha da tabela — o mesmo dado, mas COMPARAVEL.
 *
 * Aqui aparece a coluna que o card nao tem espaco pra abrir: ouro por abate. E
 * o numero que decide se vale parar pra pegar o item, e ele so faz sentido lado
 * a lado com os outros.
 */
export function ItemRow({ e }: { e: ItemEntry }) {
  return (
    <tr className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/70">
      <td className="px-3 py-2">
        <Link href={`/itens/${e.id}`} className="flex items-center gap-2">
          <Sprite
            src={assetIconUrl(e.icon)}
            alt={e.name}
            size={32}
            fallback={<ItemCategoryIcon category={e.category} size={16} />}
          />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-text group-hover:text-[var(--color-t-itens)]">
              {e.name}
            </span>
            {e.rare ? <span className="pix text-[11px] text-accent">raro</span> : null}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2">
        <span className="pix flex items-center gap-1.5 text-[11px] text-text-dim">
          <ItemCategoryIcon category={e.category} size={14} />
          {ITEM_CATEGORY_LABEL[e.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] tabular">
        <span className={e.npcPrice > 0 ? "text-warn" : "text-text-mute"}>
          {e.npcPrice > 0 ? compact(e.npcPrice) : "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-neon tabular">
        {e.goldPrice > 0 ? compact(e.goldPrice) : "—"}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">
        {e.sources || "—"}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-ok tabular">
        {e.best ? pctText(e.best.chancePct) : "—"}
      </td>
      <td className="px-3 py-2">
        {e.bestFarm ? (
          /* O nivel vai JUNTO do nome, e nao so na coluna de nivel minimo: as
             duas colunas falam de bichos diferentes (a melhor fonte de Wool
             Ball e um Zangoose de 470; o nivel minimo, um Meowth de 20) e lidas
             lado a lado afirmam um "Zangoose nivel 20" que nao existe. */
          <Link
            href={`/dex/${e.bestFarm.id}`}
            className="flex items-center gap-1.5 text-[13px] text-text-dim hover:text-accent"
          >
            <Sprite src={spriteUrl(e.bestFarm.id)} alt={e.bestFarm.name} size={26} />
            <span className="min-w-0">
              <span className="block truncate">{e.bestFarm.name}</span>
              <span className="pix text-[11px] text-text-mute">nv {e.bestFarm.level || "—"}</span>
            </span>
          </Link>
        ) : (
          <span className="text-[13px] text-text-mute">
            {e.sources ? "não se caça" : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">
        <span className="flex items-center justify-end gap-1">
          {e.minFarmLevel != null ? <IconLevel size={14} /> : null}
          {e.minFarmLevel ?? "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] tabular">
        {e.goldPerKill > 0 ? (
          <Tooltip
            content={`Na melhor fonte farmável (${e.bestFarm?.name}), este item soma ~${compact(
              Math.round(e.goldPerKill),
            )} de ouro a cada abate.`}
          >
            <span className="text-warn">{compact(Math.round(e.goldPerKill))}</span>
          </Tooltip>
        ) : (
          <span className="text-text-mute">—</span>
        )}
      </td>
    </tr>
  );
}
