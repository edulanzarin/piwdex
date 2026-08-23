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
        segments={compacto ? 10 : 16}
        max={max}
        value={valor}
      />
    </span>
  );
}

/**
 * Um painel de altura FIXA com corpo que rola.
 *
 * Os quatro cartões da caçada cresciam cada um por conta, e a coluna da direita
 * terminava um metro acima da esquerda. Altura fixa alinha; a rolagem interna é
 * o que permite fixá-la sem cortar conteúdo.
 */
export function Cartao({
  titulo,
  acao,
  altura = 320,
  children,
  className,
  bodyClassName,
}: {
  titulo: ReactNode;
  acao?: ReactNode;
  /** `0` = cresce com o conteúdo (use quando o máximo é conhecido e pequeno) */
  altura?: number;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel className={cn("flex flex-col p-4", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="pix text-[13px] text-text-dim">{titulo}</h2>
        {acao}
      </div>
      <div
        className={cn("mt-3 min-h-0 flex-1", altura ? "overflow-y-auto" : "", bodyClassName)}
        style={altura ? { height: altura } : undefined}
      >
        {children}
      </div>
    </Panel>
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
