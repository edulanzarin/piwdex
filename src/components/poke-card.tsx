import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DexEntry } from "@/lib/dex";
import { rolesOf } from "@/lib/dex";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { spriteUrl } from "@/lib/sprites";
import { Chip, IconCoin, IconPin, Sprite, Tooltip } from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";
import { IconBag, IconGem, IconLevel, IconScale, IconTm, IconXp, STAT_ICONS } from "@/components/game-icons";
import { ACQ_LABEL, RARITY_LABEL, ROLE_LABEL, STAT_LABEL, compact } from "@/lib/labels";

/**
 * Card de especie da Pokedex.
 *
 * O que ele responde de relance, sem clique: quem e, de que tipo, quao raro, o
 * FORMATO dos stats, onde se consegue, quanto vale e quanto rende. A versao
 * anterior mostrava sprite + nome + tipo e obrigava a abrir a ficha pra todo o
 * resto — era o que fazia a dex parecer galeria em vez de ferramenta.
 *
 * O truque de densidade e a **espinha de stats**: seis barrinhas verticais no
 * lugar de seis linhas rotuladas. Ali nao se le o numero exato (o numero mora
 * na ficha e na tabela), mas se le o PERFIL — um Onix e visivelmente um muro,
 * um Electrode e visivelmente uma flecha — e o perfil e o que faz escolher.
 */

export const gold = compact;

/**
 * Espinha de stats: seis colunas contra um teto FIXO do catalogo.
 *
 * O teto e percentil (p98 = 130), nao o maximo (255): com o maximo, 99,3% das
 * barras ficariam no primeiro terco e a espinha viraria uma faixa chapada — sem
 * distinguir um muro de uma flecha, que e a unica coisa que ela precisa fazer.
 *
 * Quem passa do teto satura, e satura MARCADO: uma tampa clara no topo diz
 * "estourou a regua". Sem a marca, um stat 140 e um 255 desenham a mesma barra
 * cheia e o card afirma que sao iguais.
 */
function StatSpine({
  stats,
  ceiling,
  tint,
}: {
  stats: readonly number[];
  ceiling: number;
  tint: string;
}) {
  return (
    <div className="flex items-end gap-1">
      {stats.map((v, i) => {
        const ratio = v / ceiling;
        const Icon = STAT_ICONS[i];
        return (
          <span
            key={i}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={`${STAT_LABEL[i]}: ${v}`}
          >
            <span className="relative flex h-10 w-full items-end rounded-[1px] bg-surface-2">
              <span
                className="w-full rounded-[1px]"
                style={{
                  // piso de 8%: stat baixissimo nao pode virar barra invisivel,
                  // que se confunde com "nao carregou"
                  height: `${Math.max(8, Math.min(100, ratio * 100))}%`,
                  backgroundColor: tint,
                  opacity: 0.6 + Math.min(1, ratio) * 0.4,
                }}
              />
              {/* tampa: quem passa do teto satura MARCADO, senao 140 e 255
                  desenham a mesma barra cheia e o card diz que sao iguais */}
              {ratio > 1 ? <span className="absolute inset-x-0 top-0 h-[2px] bg-text" /> : null}
            </span>
            {/* o icone no lugar da abreviacao: "AES" nao diz nada, o escudo com
                nucleo diz "defesa especial" sem precisar de legenda */}
            <Icon size={10} className="text-text-mute" />
          </span>
        );
      })}
    </div>
  );
}

export function PokeCard({
  e,
  ceiling,
  priority,
}: {
  e: DexEntry;
  /** teto das barras — vem do CATALOGO, nao da pagina atual, senao o mesmo
   *  bicho ganha barra de tamanho diferente conforme o filtro */
  ceiling: number;
  priority?: boolean;
}) {
  const tint = RARITY_COLOR[e.rarity];
  const roles = rolesOf(e);

  // Os selos de contexto sao MUITOS (origem, estagio, papel, TM, drops) e
  // empilhados viram parede. Aqui so os dois que decidem se vale caçar; o resto
  // esta na ficha, a um clique. Card cheio de chip nao informa mais — informa
  // menos, porque nada se destaca.
  const contexto = [
    e.acquisition === "hunt"
      ? { label: `${e.spots} ${e.spots > 1 ? "locais" : "local"}`, tone: "ok" as const, icon: <IconPin size={9} /> }
      : { label: ACQ_LABEL[e.acquisition], tone: "warn" as const, icon: undefined },
    roles[0]
      ? { label: ROLE_LABEL[roles[0]] ?? roles[0], tone: "neutral" as const, icon: undefined }
      : null,
  ].filter(Boolean) as { label: string; tone: "ok" | "warn" | "neutral"; icon?: React.ReactNode }[];

  return (
    <Link
      href={`/dex/${e.id}`}
      className={cn(
        "panel group relative flex flex-col gap-3 p-3.5 transition-all",
        "hover:border-accent/55 hover:shadow-[0_0_30px_-12px_var(--color-accent)]",
        "focus-visible:border-accent",
      )}
    >
      {/* ---- cabecalho: identidade e raridade ---- */}
      <header className="flex items-center justify-between gap-2">
        <span className="pix text-[12px] text-text-mute">#{String(e.id).padStart(3, "0")}</span>
        <Chip size="sm" tint={tint} icon={<IconGem size={8} />}>
          {RARITY_LABEL[e.rarity]}
        </Chip>
      </header>

      {/* ---- sprite: a peca que o olho procura primeiro, entao ganha espaco ---- */}
      <div className="relative grid place-items-center py-1">
        <span
          aria-hidden="true"
          className="absolute h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-100"
          style={{ backgroundColor: tint, opacity: 0.2 }}
        />
        <Sprite
          src={spriteUrl(e.id)}
          alt={e.name}
          size={96}
          priority={priority}
          className="relative transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      {/* ---- nome e tipo ---- */}
      <div className="flex flex-col gap-2">
        <h3
          className="truncate text-[18px] leading-tight font-bold text-text transition-colors group-hover:text-accent"
          title={e.name}
        >
          {e.name}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <TypeBadge type={e.type1} />
          {e.type2 ? <TypeBadge type={e.type2} /> : null}
        </div>
      </div>

      {/* ---- perfil de stats ---- */}
      <StatSpine stats={e.stats} ceiling={ceiling} tint={TYPE_COLOR[e.type1]} />

      {/* ---- os tres numeros que decidem se vale caçar ---- */}
      <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        <div className="flex flex-col gap-1">
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconLevel size={9} />
            Nível
          </dt>
          <dd className="text-[17px] leading-none font-bold text-text">{e.level || "—"}</dd>
        </div>
        <div className="flex flex-col gap-1 border-x border-line">
          {/* O rotulo muda com a GRANDEZA: "venda" e o que o jogo paga por
              abate, "npc" e o preço do cassino. Sao eixos diferentes, e o mesmo
              rotulo pros dois faz o card se contradizer entre especies. */}
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconCoin size={9} />
            {e.valueFromNpc ? "NPC" : "Venda"}
          </dt>
          <dd
            className={cn(
              "text-[17px] leading-none font-bold",
              e.valueFromNpc ? "text-text-mute" : "text-warn",
            )}
          >
            {e.value > 0 ? gold(e.value) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
            <IconXp size={9} />
            XP
          </dt>
          <dd className="text-[17px] leading-none font-bold text-neon">{e.xp || "—"}</dd>
        </div>
      </dl>

      {/* ---- rodape de contexto ----
          `mt-auto` cola o rodape no fundo: sem ele, um card com um chip a mais
          empurra o proprio rodape pra baixo e a linha inteira do grid perde o
          alinhamento. E a contagem de drops fica FORA do container que quebra
          linha, senao ela cai sozinha numa segunda linha e estica o card. */}
      <div className="mt-auto flex items-start justify-between gap-2 border-t border-line pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {contexto.map((c) => (
            <Chip key={c.label} size="sm" tone={c.tone} icon={c.icon}>
              {c.label}
            </Chip>
          ))}
          {/* A variante nao some mais atras de uma chave — ela aparece na lista
              e se IDENTIFICA. Esconder metade do catalogo por padrao fazia a
              busca por "Brave Blastoise" devolver nada, sem explicar por que. */}
          {e.variant ? (
            <Tooltip content="Variante de skin: mesma espécie do catálogo, outro visual.">
              <Chip size="sm" tone="accent">
                variante
              </Chip>
            </Tooltip>
          ) : null}
          {e.hasTm ? (
            <Tooltip
              content={`Aprende TM: o melhor golpe sobe de ${e.bestNatural} para ${e.bestWithTm} de poder.`}
            >
              <Chip size="sm" tone="neon" icon={<IconTm size={8} />}>
                TM
              </Chip>
            </Tooltip>
          ) : null}
        </div>
        {e.dropCount ? (
          <span
            className="pix flex h-6 shrink-0 items-center gap-1 text-[11px] text-text-mute"
            title={`${e.dropCount} ${e.dropCount > 1 ? "itens diferentes" : "item"} no loot`}
          >
            <IconBag size={10} />
            {e.dropCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Linha da tabela — o mesmo dado do card, mas COMPARAVEL.
 *
 * Grid e tabela nao sao gosto, sao tarefas diferentes: o grid serve pra
 * reconhecer (o olho procura a silhueta), a tabela serve pra comparar numero
 * contra numero. Por isso as duas existem, e a tabela abre as seis colunas de
 * stat que o card resume em barra.
 */
export function PokeRow({ e }: { e: DexEntry }) {
  return (
    <tr className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2/70">
      <td className="px-3 py-2">
        <Link href={`/dex/${e.id}`} className="flex items-center gap-2">
          <Sprite src={spriteUrl(e.id)} alt={e.name} size={38} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-text group-hover:text-accent">
              {e.name}
            </span>
            <span className="pix text-[11px] text-text-mute">#{String(e.id).padStart(3, "0")}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2">
        <span className="flex gap-1">
          <TypeBadge type={e.type1} size="xs" showLabel={false} />
          {e.type2 ? <TypeBadge type={e.type2} size="xs" showLabel={false} /> : null}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="pix text-[11px]" style={{ color: RARITY_COLOR[e.rarity] }}>
          {RARITY_LABEL[e.rarity]}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-text-dim tabular">{e.level || "—"}</td>
      {e.stats.map((s, i) => (
        <td key={i} className="px-2 py-2 text-right text-[14px] text-text-dim tabular">
          {s}
        </td>
      ))}
      <td className="px-3 py-2 text-right text-[14px] font-semibold text-text tabular">
        {e.statTotal}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-accent tabular">
        {e.bestWithTm}
        {e.hasTm ? <span className="ml-0.5 text-[11px] text-neon">tm</span> : null}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right text-[14px] tabular",
          e.valueFromNpc ? "text-text-mute" : "text-warn",
        )}
        title={e.valueFromNpc ? "Preco de NPC — esta especie nao tem valor de venda" : undefined}
      >
        {e.value > 0 ? gold(e.value) : "—"}
        {e.valueFromNpc && e.value > 0 ? <span className="ml-0.5 text-[11px]">npc</span> : null}
      </td>
      <td className="px-3 py-2 text-right text-[14px] text-neon tabular">{e.xp || "—"}</td>
      <td className="px-3 py-2 text-right text-[14px] text-text-mute tabular">{e.spots || "—"}</td>
    </tr>
  );
}
