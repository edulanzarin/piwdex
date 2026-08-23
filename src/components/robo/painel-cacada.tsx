"use client";

import { Button, Empty, Note, Panel, Sprite } from "@/components/ui";
import { compact, num } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import type { EstadoHunt, Evento } from "@/lib/robo/motor/tipos";

/** A aba da caçada: quem luta, o que está na fila, o que acabou de acontecer. */

const COR = "var(--color-t-robo)";

function BarraVida({ hp, maxHp }: { hp: number; maxHp: number }) {
  const razao = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  // A cor e degrau, e nao gradiente: "está no vermelho" é uma leitura de estado,
  // e um gradiente contínuo obriga a comparar matizes pra saber em qual se está.
  const cor = razao <= 0 ? "var(--color-danger)" : razao < 0.3 ? "var(--color-warn)" : "var(--color-ok)";
  return (
    <span className="flex h-1.5 w-full overflow-hidden bg-surface-3" aria-hidden="true">
      <span style={{ width: `${razao * 100}%`, backgroundColor: cor }} />
    </span>
  );
}

/** O rotulo de cada linha do feed, e a cor que ele carrega. */
const LINHA: Record<Evento["tipo"], { texto: string; cor: string }> = {
  kill: { texto: "abateu", cor: "var(--color-text-mute)" },
  captura: { texto: "pegou", cor: COR },
  compra: { texto: "comprou", cor: "var(--color-warn)" },
  venda: { texto: "vendeu", cor: "var(--color-ok)" },
  cura: { texto: "curou", cor: "var(--color-accent)" },
  aviso: { texto: "falhou", cor: "var(--color-danger)" },
};

export function AbaCacada({
  estado,
  ocupado,
  comandar,
}: {
  estado: EstadoHunt;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---- o time ---- */}
      <div className="flex flex-col gap-4">
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Time</h2>
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void comandar("curar")}>
              curar na Joy
            </Button>
          </div>

          {estado.caido ? (
            <Note tone="warn" className="mt-3">
              O líder desmaiou. O robô usa um Revive da bolsa; sem Revive, sai do campo, cura de graça
              e volta sozinho.
            </Note>
          ) : null}

          {estado.time.length === 0 ? (
            <Empty title="Time ainda não carregou" hint="Ele chega no primeiro ciclo da sessão." />
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {estado.time.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border border-line bg-bg-soft p-2">
                  <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[13px] text-text">
                      {p.name}
                      <span className="pix text-[10px] text-text-mute">nv {p.level}</span>
                      {p.leader ? (
                        <span className="pix text-[10px]" style={{ color: COR }}>
                          líder
                        </span>
                      ) : null}
                      {p.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                    </p>
                    <span className="mt-1 flex items-center gap-2">
                      <BarraVida hp={p.hp} maxHp={p.maxHp} />
                      <span className="shrink-0 text-[11px] tabular text-text-mute">
                        {num(p.hp, 0)}/{num(p.maxHp, 0)}
                      </span>
                    </span>
                  </div>
                  {!p.leader ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={ocupado}
                      onClick={() => void comandar("lider", { pokeId: p.id })}
                    >
                      caçar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {estado.noBox > 0 ? (
            <p className="mt-3 text-[12px] text-text-mute">
              {estado.noBox} {estado.noBox === 1 ? "pokémon" : "pokémons"} no box.
            </p>
          ) : null}
        </Panel>

        {/* ---- a fila de captura ---- */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Fila de captura</h2>
            <span className="pix text-[11px] text-text-mute">{estado.fila.length} corpos</span>
          </div>
          {estado.fila.length === 0 ? (
            <Empty
              title="Fila vazia"
              hint="Os corpos entram aqui a cada abate e saem conforme o auto-catch processa."
            />
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {estado.fila.slice(0, 40).map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-1.5 border border-line bg-bg-soft px-2 py-1"
                  title={`${f.nome} nv ${f.level}`}
                >
                  <Sprite src={spriteUrl(f.speciesId, f.shiny)} alt="" size={22} />
                  <span className="pix text-[10px] text-text-mute">nv {f.level}</span>
                  {f.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- o que esta acontecendo ---- */}
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="pix text-[13px] text-text-dim">Ao vivo</h2>
          {estado.analyzer?.drops.length ? (
            <span className="pix text-[11px] text-text-mute">
              {estado.analyzer.drops.length} tipos de drop
            </span>
          ) : null}
        </div>

        {estado.eventos.length === 0 ? (
          <Empty
            title="Nada ainda"
            hint={estado.ligado ? "Os primeiros abates aparecem em segundos." : "Ligue o robô numa hunt."}
          />
        ) : (
          <ul className="mt-3 flex max-h-[560px] flex-col gap-1 overflow-y-auto">
            {estado.eventos.map((e, i) => {
              const l = LINHA[e.tipo];
              return (
                <li
                  key={`${e.em}-${i}`}
                  className="flex items-center gap-2 border-b border-line/60 py-1.5 text-[13px] last:border-0"
                >
                  <span className="pix shrink-0 text-[10px]" style={{ color: l.cor }}>
                    {l.texto}
                  </span>
                  <span className="truncate text-text">
                    {e.especie}
                    {e.shiny ? <span className="ml-1 text-warn">shiny</span> : null}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular text-text-mute">
                    {e.ouro != null
                      ? `${e.ouro < 0 ? "−" : "+"}${compact(Math.abs(e.ouro))} ouro`
                      : e.xp > 0
                        ? `+${compact(e.xp)} xp`
                        : (e.bola ?? "")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
