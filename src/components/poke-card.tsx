import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DexEntry } from "@/lib/dex";
import { rolesOf } from "@/lib/dex";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { spriteUrl } from "@/lib/sprites";
import { Chip, IconBolt, IconCoin, IconPin, Sprite, Tooltip } from "@/components/ui";
import { TypeBadge } from "@/components/type-icon";

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

const STAT_SHORT = ["HP", "AT", "DF", "SA", "SD", "VL"] as const;

const ACQ_LABEL: Record<DexEntry["acquisition"], string> = {
  hunt: "Cacavel",
  evo: "Evolucao",
  special: "Especial",
};

const STAGE_LABEL: Record<DexEntry["stage"], string> = {
  solo: "Sem evolucao",
  base: "Estagio 1",
  mid: "Estagio 2",
  final: "Final",
};

/**
 * Numero compacto do jogo. Precisa das faixas altas: o preco do Aerodactyl e
 * 6.500.000.000, e sem degrau de bilhao a versao anterior imprimia "6500000k",
 * que nao se le nem se compara.
 */
export function gold(n: number): string {
  const abs = Math.abs(n);
  const cut = (div: number, suf: string) => {
    const v = n / div;
    // uma casa so ate 100, nenhuma acima — "6.5B" e legivel, "6.50B" e ruido
    return `${v.toFixed(Math.abs(v) < 100 ? 1 : 0).replace(/\.0$/, "")}${suf}`;
  };
  if (abs >= 1e9) return cut(1e9, "B");
  if (abs >= 1e6) return cut(1e6, "M");
  if (abs >= 1000) return cut(1000, "k");
  return String(n);
}

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
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {stats.map((s, i) => {
        const ratio = s / ceiling;
        const over = ratio > 1;
        return (
          <span key={i} className="flex flex-1 flex-col items-center gap-[3px]">
            <span className="relative flex h-8 w-full items-end rounded-[1px] bg-surface-2">
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
              {over ? (
                <span className="absolute inset-x-0 top-0 h-[2px] bg-text" />
              ) : null}
            </span>
            <span className="pix text-[10px] leading-none text-text-mute">{STAT_SHORT[i]}</span>
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

  return (
    <Link
      href={`/dex/${e.id}`}
      className={cn(
        "panel group relative flex flex-col gap-2 p-2 transition-all",
        "hover:border-accent/55 hover:shadow-[0_0_24px_-10px_var(--color-accent)]",
        "focus-visible:border-accent",
      )}
    >
      <header className="flex items-center justify-between gap-1">
        <span className="pix text-[10px] text-text-mute">#{String(e.id).padStart(3, "0")}</span>
        <span className="flex items-center gap-1" title={`Total de stats base: ${e.statTotal}`}>
          <IconBolt size={8} className="text-text-mute" />
          <span className="text-[12px] text-text-dim tabular">{e.statTotal}</span>
        </span>
      </header>

      {/* halo da cor da RARIDADE atras do sprite — a raridade se le antes do nome */}
      <div className="relative grid place-items-center py-1">
        <span
          aria-hidden="true"
          className="absolute h-16 w-16 rounded-full blur-xl transition-opacity group-hover:opacity-90"
          style={{ backgroundColor: tint, opacity: 0.18 }}
        />
        <Sprite
          src={spriteUrl(e.id)}
          alt={e.name}
          size={72}
          priority={priority}
          className="relative transition-transform duration-200 group-hover:scale-110"
        />
      </div>

      <h3 className="truncate text-[14px] leading-tight font-semibold text-text" title={e.name}>
        {e.name}
      </h3>

      <div className="flex flex-wrap items-center gap-1">
        <TypeBadge type={e.type1} size="xs" />
        {e.type2 ? <TypeBadge type={e.type2} size="xs" /> : null}
        <Chip size="xs" tint={tint} className="ml-auto">
          {e.rarity}
        </Chip>
      </div>

      <StatSpine stats={e.stats} ceiling={ceiling} tint={TYPE_COLOR[e.type1]} />

      {/* os tres numeros que decidem se vale cacar */}
      <dl className="grid grid-cols-3 gap-1 border-t border-line pt-1.5 text-center">
        <div>
          <dt className="pix text-[10px] text-text-mute">NIVEL</dt>
          <dd className="text-[13px] text-text tabular">{e.level || "—"}</dd>
        </div>
        <div>
          {/* O rotulo muda com a GRANDEZA: "venda" e o que o jogo te paga por
              abate, "npc" e o preco do cassino. Sao eixos diferentes e o mesmo
              rotulo pros dois faz o card se contradizer entre especies. */}
          <dt className="pix text-[10px] text-text-mute">{e.valueFromNpc ? "PRECO NPC" : "VENDA"}</dt>
          <dd
            className={cn(
              "flex items-center justify-center gap-0.5 text-[13px] tabular",
              e.valueFromNpc ? "text-text-mute" : "text-warn",
            )}
          >
            {e.value > 0 ? (
              <>
                <IconCoin size={8} />
                {gold(e.value)}
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="pix text-[10px] text-text-mute">XP</dt>
          <dd className="text-[13px] text-neon tabular">{e.xp || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-1">
        <Chip
          size="xs"
          tone={e.acquisition === "hunt" ? "ok" : e.acquisition === "evo" ? "accent" : "warn"}
          icon={e.acquisition === "hunt" ? <IconPin size={6} /> : undefined}
        >
          {e.acquisition === "hunt"
            ? `${e.spots} SPOT${e.spots > 1 ? "S" : ""}`
            : ACQ_LABEL[e.acquisition]}
        </Chip>
        {e.stage !== "solo" ? <Chip size="xs">{STAGE_LABEL[e.stage]}</Chip> : null}
        {roles[0] ? <Chip size="xs">{roles[0]}</Chip> : null}
        {e.hasTm ? (
          <Tooltip
            content={`Aprende TM: o melhor golpe sobe de ${e.bestNatural} para ${e.bestWithTm} de poder.`}
          >
            <Chip size="xs" tone="neon">TM</Chip>
          </Tooltip>
        ) : null}
        {e.dropCount ? (
          <Chip size="xs" className="ml-auto">
            {e.dropCount} DROP{e.dropCount > 1 ? "S" : ""}
          </Chip>
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
      <td className="px-2 py-1">
        <Link href={`/dex/${e.id}`} className="flex items-center gap-2">
          <Sprite src={spriteUrl(e.id)} alt={e.name} size={30} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-text group-hover:text-accent">
              {e.name}
            </span>
            <span className="pix text-[10px] text-text-mute">#{String(e.id).padStart(3, "0")}</span>
          </span>
        </Link>
      </td>
      <td className="px-2 py-1">
        <span className="flex gap-1">
          <TypeBadge type={e.type1} size="xs" showLabel={false} />
          {e.type2 ? <TypeBadge type={e.type2} size="xs" showLabel={false} /> : null}
        </span>
      </td>
      <td className="px-2 py-1">
        <span className="pix text-[10px]" style={{ color: RARITY_COLOR[e.rarity] }}>
          {e.rarity}
        </span>
      </td>
      <td className="px-2 py-1 text-right text-[13px] text-text-dim tabular">{e.level || "—"}</td>
      {e.stats.map((s, i) => (
        <td key={i} className="px-1.5 py-1 text-right text-[13px] text-text-dim tabular">
          {s}
        </td>
      ))}
      <td className="px-2 py-1 text-right text-[13px] font-semibold text-text tabular">
        {e.statTotal}
      </td>
      <td className="px-2 py-1 text-right text-[13px] text-accent tabular">
        {e.bestWithTm}
        {e.hasTm ? <span className="ml-0.5 text-[10px] text-neon">tm</span> : null}
      </td>
      <td
        className={cn(
          "px-2 py-1 text-right text-[13px] tabular",
          e.valueFromNpc ? "text-text-mute" : "text-warn",
        )}
        title={e.valueFromNpc ? "Preco de NPC — esta especie nao tem valor de venda" : undefined}
      >
        {e.value > 0 ? gold(e.value) : "—"}
        {e.valueFromNpc && e.value > 0 ? <span className="ml-0.5 text-[10px]">npc</span> : null}
      </td>
      <td className="px-2 py-1 text-right text-[13px] text-neon tabular">{e.xp || "—"}</td>
      <td className="px-2 py-1 text-right text-[13px] text-text-mute tabular">{e.spots || "—"}</td>
    </tr>
  );
}
