import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DexEntry } from "@/lib/dex";
import { rolesOf } from "@/lib/dex";
import { RARITY_COLOR, TYPE_COLOR } from "@/lib/typing";
import { spriteUrl } from "@/lib/sprites";
import { Chip, IconCoin, IconPin, Sprite, Tooltip } from "@/components/ui";
import { TypeBadge, TypeIcon } from "@/components/type-icon";
import { IconBag, IconLevel, IconScale, IconTm, IconXp, STAT_ICONS } from "@/components/game-icons";
import { ACQ_LABEL, RARITY_LABEL, ROLE_LABEL, STAT_LABEL, TYPE_LABEL, compact } from "@/lib/labels";

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
            {/* A coluna virou pilula: `rounded-[1px]` era o canto reto do tema
                antigo sobrevivendo em seis barras por card, sessenta cards por
                tela. Numa coluna de 5px de largura, um raio cheio custa nada e e
                a diferenca entre "grafico" e "riscos". */}
            <span className="relative flex h-10 w-full items-end overflow-hidden rounded-pill bg-surface-2">
              <span
                className="w-full rounded-pill"
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
              {ratio > 1 ? <span className="absolute inset-x-0 top-0 h-[2px] rounded-pill bg-text" /> : null}
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
  index = 0,
}: {
  e: DexEntry;
  /** posicao no grid — vira o atraso da entrada em cascata */
  index?: number;
  /** teto das barras — vem do CATALOGO, nao da pagina atual, senao o mesmo
   *  pokemon ganha barra de tamanho diferente conforme o filtro */
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
      ? { label: `${e.spots} ${e.spots > 1 ? "locais" : "local"}`, tone: "ok" as const, icon: <IconPin size={15} /> }
      : { label: ACQ_LABEL[e.acquisition], tone: "warn" as const, icon: undefined },
    roles[0]
      ? { label: ROLE_LABEL[roles[0]] ?? roles[0], tone: "neutral" as const, icon: undefined }
      : null,
  ].filter(Boolean) as { label: string; tone: "ok" | "warn" | "neutral"; icon?: React.ReactNode }[];

  return (
    <Link
      href={`/dex/${e.id}`}
      style={{ ["--i" as string]: index, ["--tint" as string]: tint }}
      className={cn(
        // O card perdeu o padding EXTERNO e virou uma pilha de faixas: painel de
        // arte, placa de identidade, bloco de numeros, rodape. E a silhueta do
        // cartao de personagem da referencia, e ela nao e so estetica — com a arte
        // encostando nas bordas, a peca que o olho procura primeiro para de
        // flutuar num quadrado de respiro e passa a MANDAR no card.
        //
        // O dado nao encolheu: os oito campos continuam todos aqui. Trocar a
        // grade densa por cartao so de arte seria copiar a referencia no ponto em
        // que ela NAO se aplica — a dela apresenta, a nossa e ferramenta de
        // consulta, e quem filtra 900 especies quer os numeros na grade.
        "panel-card anim-enter group relative flex flex-col overflow-hidden",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:border-[color:var(--tint)]",
        "hover:shadow-elev-3 focus-visible:border-accent",
      )}
    >
      {/* ---- o painel de ARTE ----
          Fundo proprio, mais escuro que o card. O numero e a raridade flutuam
          nos cantos DELE em vez de ocuparem uma linha antes: linha de cabecalho
          custava 28px de altura em cada um dos 60 cards da tela pra dizer duas
          coisas que cabem no canto de uma area que ja existe. */}
      <div className="relative grid aspect-[5/4] w-full place-items-center overflow-hidden bg-bg-soft">
        <span
          aria-hidden="true"
          /* Caixa FIXA no tamanho MAIOR, e so `transform` anima. Animar h/w num
             elemento com `blur-2xl` obriga o navegador a rasterizar o desfoque de
             novo a cada quadro, e o grid tem ate 60 destes na tela — era a
             animacao mais cara da pagina, e ela e enfeite de hover. */
          className="absolute h-28 w-28 origin-center scale-[0.857] rounded-full blur-2xl transition-transform duration-300 ease-out group-hover:scale-100"
          style={{ backgroundColor: tint, opacity: 0.22 }}
        />
        <Sprite
          src={spriteUrl(e.id)}
          alt={e.name}
          size={104}
          priority={priority}
          className="relative transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:scale-110"
        />

        <span className="pix absolute top-2 left-2.5 text-[11px] text-text-mute">
          #{String(e.id).padStart(3, "0")}
        </span>
      </div>

      {/* ---- a PLACA de identidade ----
          Superficie propria e fio em cima, separando da arte. Ela nao flutua
          sobre a imagem com gradiente: nome sobre sprite depende do que o sprite
          tem naquele trecho, e numa grade de 60 artes diferentes ele some em boa
          parte delas. A placa solida custa altura e nunca falha. */}
      {/* ---- a PLACA, no arranjo do cartao de campeao ----

          Tres coisas foram copiadas da referencia, e cada uma resolve algo que a
          versao anterior fazia pior:

          1. **O medalhao montado na COSTURA.** Ele fica metade sobre a arte,
             metade sobre a placa, e e o que costura as duas faixas numa peca so —
             sem ele, arte e placa sao dois retangulos empilhados que por acaso
             tem a mesma largura. Aqui ele carrega o TIPO, que e a identidade que
             o jogador procura primeiro depois do nome.

          2. **A raridade virou EPITETO**, acima do nome, na cor dela. Ela era um
             chip no canto da arte — e chip no canto e um selo administrativo,
             enquanto epiteto e identidade. "Mitico" dito acima do nome pertence
             ao bicho; dito num cantinho, pertence ao sistema.

          3. **Centralizado.** A placa tem duas linhas curtas e um medalhao no
             eixo do meio; alinhar a esquerda deixaria o medalhao sozinho no
             centro brigando com o texto encostado na margem. */}
      <div className="relative flex flex-col items-center gap-1 border-t border-line bg-surface-2/70 px-3.5 pt-6 pb-3.5 text-center transition-colors duration-200 group-hover:bg-surface-3/70">
        {/* Os DISCOS de tipo, montados na costura.
            Eles substituem a fila de selos com a palavra escrita que ficava
            abaixo do nome. A palavra custava caro: "Venenoso" ao lado de "Planta"
            gastava a linha inteira da placa, e o tipo e a informacao que se
            reconhece por COR e SIMBOLO antes de qualquer leitura — quem usa a dex
            sabe o que e o disco roxo. Escrever era ensinar de novo, todo card,
            uma coisa que a pessoa ja sabe na terceira tela.
            Bitipo desenha dois discos; o segundo entra um pouco menor e atras,
            porque a ORDEM importa (o primeiro tipo manda no STAB). */}
        <span
          aria-hidden="true"
          className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center"
        >
          {[e.type1, e.type2].filter(Boolean).map((t, i) => (
            <span
              key={t as string}
              className={cn(
                "grid place-items-center rounded-pill border-2 bg-surface shadow-elev-2",
                "transition-transform duration-300 ease-out",
                i === 0 ? "h-10 w-10" : "-ml-2.5 h-8 w-8",
                i === 0 ? "z-10 motion-safe:group-hover:scale-110" : "motion-safe:group-hover:scale-105",
              )}
              style={{ borderColor: TYPE_COLOR[t!], color: TYPE_COLOR[t!] }}
              title={TYPE_LABEL[t!]}
            >
              <TypeIcon type={t!} size={i === 0 ? 20 : 16} />
            </span>
          ))}
        </span>

        <span
          className="pix text-[9px] tracking-[0.18em]"
          style={{ color: tint }}
        >
          {RARITY_LABEL[e.rarity]}
        </span>
        <h3
          className="w-full truncate text-[16px] leading-tight font-bold text-text transition-colors group-hover:text-[color:var(--tint)]"
          title={e.name}
        >
          {e.name}
        </h3>
      </div>

      {/* ---- o bloco de DADO, que e o motivo de esta grade existir ---- */}
      <div className="flex flex-col gap-3 px-3.5 pt-3">
        <StatSpine stats={e.stats} ceiling={ceiling} tint={TYPE_COLOR[e.type1]} />

        {/* ---- os tres numeros que decidem se vale caçar ---- */}
        <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div className="flex flex-col gap-1">
            <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
              <IconLevel size={15} />
              Nível
            </dt>
            <dd className="text-[17px] leading-none font-bold text-text">{e.level || "—"}</dd>
          </div>
          <div className="flex flex-col gap-1 border-x border-line">
            {/* O rotulo muda com a GRANDEZA: "venda" e o que o jogo paga por
                abate, "npc" e o preço do cassino. Sao eixos diferentes, e o mesmo
                rotulo pros dois faz o card se contradizer entre especies. */}
            <dt className="pix flex items-center justify-center gap-1 text-[11px] text-text-mute">
              <IconCoin size={15} />
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
              <IconXp size={15} />
              XP
            </dt>
            <dd className="text-[17px] leading-none font-bold text-neon">{e.xp || "—"}</dd>
          </div>
        </dl>
      </div>

      {/* ---- rodape de contexto ----
          `mt-auto` cola o rodape no fundo: sem ele, um card com um chip a mais
          empurra o proprio rodape pra baixo e a linha inteira do grid perde o
          alinhamento. E a contagem de drops fica FORA do container que quebra
          linha, senao ela cai sozinha numa segunda linha e estica o card. */}
      <div className="mt-auto flex items-start justify-between gap-2 border-t border-line px-3.5 py-3">
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
              <Chip size="sm" tone="neon" icon={<IconTm size={14} />}>
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
            <IconBag size={16} />
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
