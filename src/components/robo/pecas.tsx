"use client";

import type { ReactNode } from "react";
import { Panel, Segments, Sprite } from "@/components/ui";
import { IconDollar } from "@/components/ui/icons";
import { IconGem, IconLevel, IconTarget, IconXp } from "@/components/game-icons";
import { Pokeball } from "@/components/ui/pokeball";
import { cn } from "@/lib/cn";
import { compact } from "@/lib/labels";

/**
 * As peças do cockpit.
 *
 * Existem porque o painel repetia a mesma caixa de número em quatro arquivos, e
 * cada cópia foi divergindo um pouco: uma com ícone, outra sem, outra com o
 * rótulo em outro tamanho. Grandeza é coisa que se compara — e comparar exige
 * que todas se pareçam.
 *
 * A regra que elas carregam: **todo número tem um ícone e uma cor de família.**
 * Ouro é sempre âmbar com moeda, diamante é sempre neon com gema, XP é sempre
 * roxo. Assim o olho encontra a grandeza antes de ler o rótulo.
 */

export const TOM = {
  ouro: "var(--color-warn)",
  diamante: "var(--color-neon)",
  xp: "var(--color-t-robo)",
  vida: "var(--color-ok)",
  perigo: "var(--color-danger)",
  neutro: "var(--color-text)",
  fraco: "var(--color-text-mute)",
} as const;

export type Tom = keyof typeof TOM;

/** O ícone de cada grandeza, num lugar só: trocar aqui troca no painel inteiro. */
export const ICONE = {
  ouro: IconDollar,
  diamante: IconGem,
  xp: IconXp,
  nivel: IconLevel,
  abates: IconTarget,
} as const;

export function Valor({
  rotulo,
  valor,
  sufixo,
  icone,
  tom = "neutro",
  bruto,
  className,
}: {
  rotulo: string;
  valor: number | string | null | undefined;
  sufixo?: ReactNode;
  icone?: ReactNode;
  tom?: Tom;
  /** número grande demais para `compact` mentir: mostra inteiro */
  bruto?: boolean;
  className?: string;
}) {
  const vazio = valor == null || valor === "";
  const texto = vazio
    ? "—"
    : typeof valor === "number"
      ? bruto
        ? valor.toLocaleString("pt-BR")
        : compact(valor)
      : valor;
  return (
    <div className={cn("border border-line bg-bg-soft p-2.5", className)}>
      <p className="pix flex items-center gap-1.5 text-[11px] text-text-mute">
        {icone}
        {rotulo}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className="text-[20px] leading-none font-bold tabular"
          style={{ color: vazio ? TOM.fraco : TOM[tom] }}
        >
          {texto}
        </span>
        {sufixo ? <span className="pix text-[10px] text-text-mute">{sufixo}</span> : null}
      </p>
    </div>
  );
}

/**
 * Uma barra com nome e operandos.
 *
 * O desenho NÃO é daqui: ela embrulha `Segments`, o medidor em blocos que a dex
 * e a calculadora já usam. Eu tinha escrito uma barra lisa própria aqui, e o
 * resultado foi o painel do robô medindo as coisas de um jeito e o resto do site
 * de outro — a mesma grandeza com duas aparências.
 *
 * "91%" sozinho é placar sem jogo: o rótulo diz de quê, a barra dá a proporção e
 * o número diz de quanto. Tirar qualquer um dos três obriga quem lê a adivinhar
 * os outros dois.
 */
export function Medidor({
  rotulo,
  valor,
  max,
  tom = "vida",
  cor,
  compacto,
  sufixo,
  className,
}: {
  rotulo?: ReactNode;
  valor: number;
  max: number;
  tom?: Tom;
  /** cor crua, quando ela é dado (faixa de raridade, tipo) e não decisão de UI */
  cor?: string;
  /** menos blocos, para caber em linha apertada */
  compacto?: boolean;
  sufixo?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-1", className)}>
      {rotulo || sufixo ? (
        <span className="flex items-baseline justify-between gap-2">
          {rotulo ? <span className="pix text-[10px] text-text-mute">{rotulo}</span> : null}
          {sufixo ? <span className="text-[11px] tabular text-text-mute">{sufixo}</span> : null}
        </span>
      ) : null}
      <Segments
        ratio={max > 0 ? valor / max : 0}
        tint={cor ?? TOM[tom]}
        fino={compacto}
        max={max}
        value={valor}
      />
    </span>
  );
}

/**
 * Um painel de altura FIXA com corpo que rola.
 *
 * Ele NÃO desenha o próprio cabeçalho: usa o `title`/`actions` do `Panel`, que é
 * o que dá a barra com a linha divisória e o vidro do resto do site. Eu vinha
 * escrevendo um `<h2>` solto dentro do corpo — o painel do robô ficava liso ao
 * lado das fichas da dex, e a diferença era eu não usar o que a primitiva já
 * fazia.
 *
 * O que ele acrescenta ao `Panel` é a altura: os cartões da caçada cresciam cada
 * um por conta e as duas colunas terminavam em alturas diferentes.
 */
export function Cartao({
  titulo,
  icone,
  acao,
  altura = 320,
  children,
  className,
  bodyClassName,
}: {
  titulo: ReactNode;
  /** o marcador da grandeza, do lado do nome — como nas fichas da dex */
  icone?: ReactNode;
  acao?: ReactNode;
  /** `0` = cresce com o conteúdo (quando o máximo é conhecido e pequeno) */
  altura?: number;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel
      className={cn("flex flex-col", className)}
      title={
        <span className="flex items-center gap-2">
          {icone}
          {titulo}
        </span>
      }
      actions={acao}
      bodyClassName={cn("min-h-0 flex-1", altura ? "overflow-y-auto" : "", bodyClassName)}
    >
      <div style={altura ? { height: altura } : undefined}>{children}</div>
    </Panel>
  );
}

/**
 * Uma linha de item: arte, nome, e um número à direita.
 *
 * O detalhe que ela existe para resolver é o **espaço reservado da arte**. Item
 * sem ícone (a Master Ball do catálogo não tem) renderizava sem a caixa de
 * 22px, e o nome dele começava 30px à esquerda dos vizinhos — uma lista de dez
 * linhas alinhadas e uma torta. Slot vazio ocupa o mesmo lugar que slot cheio.
 *
 * Altura fixa pelo mesmo motivo: nome de duas linhas não pode empurrar a linha
 * seguinte, senão duas listas lado a lado deixam de casar.
 */
export function LinhaItem({
  icone,
  nome,
  detalhe,
  valor,
  abaixo,
  tom,
  className,
}: {
  icone?: string | null;
  nome: ReactNode;
  /** rótulo miúdo sob o nome (categoria, origem) */
  detalhe?: ReactNode;
  valor: ReactNode;
  /** segunda linha do número, alinhada à direita */
  abaixo?: ReactNode;
  tom?: string;
  className?: string;
}) {
  return (
    <li className={cn("flex h-12 items-center gap-2 border border-line bg-bg-soft px-2", className)}>
      {icone ? (
        <Sprite src={icone} alt="" size={22} />
      ) : (
        <span className="h-[22px] w-[22px] shrink-0 border border-line/70" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-text">{nome}</span>
        {detalhe ? <span className="pix block text-[10px] text-text-mute">{detalhe}</span> : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13px] tabular" style={{ color: tom ?? "var(--color-text-dim)" }}>
          {valor}
        </span>
        {abaixo ? <span className="block text-[11px] tabular text-text-mute">{abaixo}</span> : null}
      </span>
    </li>
  );
}

/** Uma bola do jogo com a contagem — some quando o estoque zera pra sobrar
 *  espaço, mas fica em vermelho quando a bola é a que o auto-catch usa. */
export function BolaChip({
  nome,
  icone,
  quantidade,
  infinita,
  ativa,
}: {
  nome: string;
  icone: string;
  quantidade: number;
  infinita?: boolean;
  ativa?: boolean;
}) {
  const vazia = !infinita && quantidade <= 0;
  return (
    <span
      className="flex items-center gap-1.5 border px-2 py-1"
      style={{
        borderColor: ativa
          ? "color-mix(in srgb, var(--color-t-robo) 55%, transparent)"
          : "var(--color-line)",
      }}
      title={nome}
    >
      {icone ? <Sprite src={icone} alt="" size={16} /> : <Pokeball size={16} />}
      <span
        className="text-[11px] tabular"
        style={{ color: infinita ? TOM.diamante : vazia ? TOM.perigo : "var(--color-text-dim)" }}
      >
        {infinita ? "∞" : compact(quantidade)}
      </span>
    </span>
  );
}

/**
 * Uma seção de configuração.
 *
 * Usa o cabeçalho do `Panel`, como as fichas da dex — o `<h2>` solto dentro do
 * corpo deixava o painel do robô liso ao lado delas. Mora aqui, e não na aba que
 * a inventou, porque automação e loja desenham a mesma caixa: a cópia começaria
 * igual e terminaria com dois títulos de tamanhos diferentes.
 */
export function Secao({
  titulo,
  icone,
  hint,
  children,
  acao,
}: {
  titulo: string;
  icone?: ReactNode;
  hint?: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {icone}
          {titulo}
        </span>
      }
      actions={acao}
    >
      {hint ? <p className="mb-3 max-w-prose text-[12px] text-text-mute">{hint}</p> : null}
      <div className="flex flex-col gap-3">{children}</div>
    </Panel>
  );
}
