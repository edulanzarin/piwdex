"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { FichaMembro, ResultadoArena } from "@/lib/stadium";
import { spriteUrl } from "@/lib/sprites";
import { compact, num, pct } from "@/lib/labels";
import { Metric, MetricGrid, Note, Panel, Segments, Sprite } from "@/components/ui";

const TINT = "var(--color-t-stadium)";

/**
 * O COMBATE: o que aconteceu quando os seis entraram.
 *
 * A tela responde em três alturas, e a ordem é a da pergunta que a pessoa faz:
 *
 *  1. **Derrubou?** — a manchete, com quanto sobrou do boss.
 *  2. **A que preço?** — tempo, quedas, quem carregou.
 *  3. **Onde quebrou?** — a fila das passagens, que é a única parte que diz o
 *     que TROCAR. "Perdeu" não é conselho; "o terceiro caiu com o boss em 60%"
 *     é.
 *
 * A barra de cada passagem mostra o trecho do HP do boss que aquele membro
 * levou, no lugar em que ele levou. Seis barras de "quanto cada um tirou" todas
 * começando do zero diriam a mesma soma e esconderiam a ordem, que é justamente
 * o que a arena tem de diferente do duelo.
 */
export function StadiumCombate({
  resultado,
  fichas,
  melhor,
  alvoNome,
}: {
  resultado: ResultadoArena;
  fichas: Map<number, FichaMembro>;
  melhor: FichaMembro | null;
  alvoNome: string;
}) {
  const { vitoria, travou, segundos, passagens, quedas, hpAlvoRestante, danoTotal } = resultado;
  // O time INTEIRO, e não só quem entrou: "3 de 4 caíram" num time de seis conta
  // uma derrota pior do que a que aconteceu, porque esconde os dois que o combate
  // nem chegou a precisar.
  const escalados = passagens.length + resultado.reserva;
  const carregou = resultado.carregou != null ? fichas.get(resultado.carregou) ?? null : null;

  const manchete = travou
    ? "O combate não anda"
    : vitoria
      ? `O time derruba ${alvoNome}`
      : `${alvoNome} aguenta o time inteiro`;

  return (
    <Panel
      title={<span className="pix">O combate</span>}
      bodyClassName="flex flex-col gap-4"
      style={{ "--tint": TINT } as CSSProperties}
    >
      <div className="flex flex-col gap-3 border border-line-strong bg-surface-2/60 p-4">
        <h3
          className={cn(
            "pix text-[15px] leading-snug sm:text-[17px]",
            travou ? "text-warn" : vitoria ? "text-ok" : "text-danger",
          )}
        >
          {manchete}
        </h3>

        <Segments
          ratio={1 - hpAlvoRestante}
          tint={vitoria ? "var(--color-ok)" : "var(--color-danger)"}
          label={`vida de ${alvoNome} consumida`}
          value={1 - hpAlvoRestante}
          max={1}
        />

        <p className="text-[13px] leading-relaxed text-text-dim">
          {travou ? (
            <>
              Nenhum dos dois lados tem golpe que atravesse o outro. O relógio corre e a vida
              não anda, então não há vencedor a apontar.
            </>
          ) : vitoria ? (
            <>
              Levou {num(segundos, 1)}s e custou{" "}
              {quedas === 0 ? "nenhuma queda" : quedas === 1 ? "uma queda" : `${quedas} quedas`}.
              {resultado.reserva > 0
                ? resultado.reserva === 1
                  ? " Um do time nem chegou a entrar."
                  : ` ${resultado.reserva} do time nem chegaram a entrar.`
                : ""}
            </>
          ) : (
            <>
              O time inteiro caiu em {num(segundos, 1)}s. {alvoNome} terminou com{" "}
              {pct(hpAlvoRestante * 100, 0)} da vida de pé.
            </>
          )}
        </p>
      </div>

      <MetricGrid cols={4}>
        <Metric
          size="sm"
          value={num(segundos, 1)}
          suffix="s"
          label="de combate"
          tint={TINT}
          hint="do primeiro golpe até o fim"
        />
        <Metric
          size="sm"
          value={`${quedas}`}
          suffix={`/${escalados}`}
          label="caíram"
          tint={quedas > 0 ? "var(--color-danger)" : undefined}
          hint="quantos do time foram derrubados"
        />
        <Metric
          size="sm"
          value={compact(Math.round(danoTotal))}
          label="de dano no alvo"
          hint="soma do que o time tirou, sem contar o que passou do zero"
        />
        <Metric
          size="sm"
          value={carregou?.mon.name ?? "—"}
          label="carregou"
          tint={TINT}
          hint="quem tirou o maior pedaço da vida dele"
        />
      </MetricGrid>

      <div className="flex flex-col gap-2">
        <h4 className="pix text-[11px] text-text-mute">A FILA</h4>
        {passagens.map((p) => {
          const fatia = p.hpAlvoAntes - p.hpAlvoDepois;
          return (
            <div
              key={p.slot}
              className="flex items-center gap-2.5 border border-line bg-surface-2/40 px-2.5 py-2"
            >
              <span className="pix w-5 shrink-0 text-[10px] text-text-mute">#{p.slot + 1}</span>
              <Sprite src={spriteUrl(p.mon.pokeId)} alt={p.mon.name} size={30} className="[--sprite:30px]" />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="truncate text-[13px] text-text">{p.mon.name}</span>
                  <span className="pix shrink-0 text-[10px] text-text-mute">
                    {num(p.entrouEm, 0)}s → {num(p.entrouEm + p.segundos, 0)}s
                  </span>
                </div>

                {/* O trecho ANDA: começa onde o membro pegou o boss e termina
                    onde ele deixou. É o que mostra a herança de HP entre um e
                    outro, que é a mecânica da arena. */}
                <div
                  className="relative h-2 w-full overflow-hidden rounded-pix border border-line-strong bg-surface-3"
                  role="img"
                  aria-label={`tirou ${pct(fatia * 100, 0)} da vida do alvo`}
                >
                  <span
                    className="absolute inset-y-0 block"
                    style={{
                      left: `${(1 - p.hpAlvoAntes) * 100}%`,
                      width: `${Math.max(0, fatia) * 100}%`,
                      background: p.derrubou ? "var(--color-ok)" : TINT,
                    }}
                  />
                </div>
              </div>

              <div className="flex w-24 shrink-0 flex-col items-end">
                <span className="tabular text-[13px] text-text">{pct(fatia * 100, fatia >= 0.1 ? 0 : 1)}</span>
                <span
                  className={cn(
                    "pix text-[9px]",
                    p.derrubou ? "text-ok" : p.caiu ? "text-danger" : "text-text-mute",
                  )}
                >
                  {p.inerte ? "NÃO ATRAVESSA" : p.derrubou ? "DERRUBOU" : p.caiu ? "CAIU" : "DE PÉ"}
                </span>
              </div>
            </div>
          );
        })}

        {resultado.reserva > 0 ? (
          <p className="pix text-[10px] text-text-mute">
            {resultado.reserva} NA RESERVA: O COMBATE ACABOU ANTES
          </p>
        ) : null}
      </div>

      {melhor && melhor.fatia > 0 ? (
        <Note flush>
          Melhor opção do time contra {alvoNome}: {melhor.mon.name}, que sozinho leva{" "}
          {pct(melhor.fatia * 100, melhor.fatia >= 0.1 ? 0 : 1)} da vida dele.
        </Note>
      ) : null}

      <Note tone="warn">
        O que ainda falta são os stats do boss: o jogo não publica nenhum. Se os seis
        números do alvo estão marcados como estimados, o tempo de combate é um chute de
        ordem de grandeza — a vida do Ancient Aero é 72 mil, e a projeção sobre a espécie
        dá 4,6 mil. A penalidade de grupo, essa, já está na conta.
      </Note>
    </Panel>
  );
}
