"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Loading, Modal, Note, Panel, SearchInput, Segmented, Sprite } from "@/components/ui";
import { compact, num, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR } from "@/lib/rarity";
import { spriteUrl } from "@/lib/sprites";
import { xpProgress } from "@/lib/xp";
import type { ActivePoke } from "@/lib/robo/jogo/pokes";
import type { EstadoHunt, Evento } from "@/lib/robo/motor/tipos";

interface NoBox extends ActivePoke {
  /** a venda automatica levaria este, com a config de agora */
  vendavel: boolean;
}

type Ordem = "qualidade" | "iv" | "nivel" | "valor" | "nome";

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

/**
 * O quanto falta para o próximo nível.
 *
 * A curva de XP do jogo é fechada e pública (`lib/xp.ts`), então dá para mostrar
 * o progresso mesmo quando o frame não manda o XP acumulado: sem ele a barra
 * some, e o número de nível continua de pé.
 */
function BarraXp({ level, xp }: { level: number; xp: number | null }) {
  const p = xpProgress(level, xp);
  // Sem o XP acumulado o jogo ainda deixa dizer o TAMANHO do nível, e essa é a
  // leitura honesta: barra vazia diria "zero por cento", que é outra coisa.
  if (p.pct == null) {
    return (
      <span className="flex items-center gap-2 text-[10px] tabular text-text-mute">
        <span className="pix text-[10px]">nível custa</span>
        {compact(p.need)} xp
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-1 w-full overflow-hidden bg-surface-3" aria-hidden="true">
        <span style={{ width: `${p.pct * 100}%`, backgroundColor: COR }} />
      </span>
      <span className="shrink-0 text-[10px] tabular text-text-mute">{Math.round(p.pct * 100)}%</span>
    </span>
  );
}

/** A faixa de qualidade, com a cor da escada do jogo. */
function Qualidade({ quality }: { quality: number }) {
  if (!quality) return null;
  const t = qualityTier(quality);
  return (
    <span className="pix shrink-0 text-[10px]" style={{ color: TIER_COLOR[t] }} title={`${quality.toFixed(2)}x`}>
      {TIER_LABEL[t]}
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

/**
 * O box, sob demanda.
 *
 * Fora do stream de estado de propósito: são centenas de bichos, e empurrar isso
 * uma vez por segundo por SSE seria pagar banda contínua por um dado que só esta
 * janela abre.
 *
 * A marca de "vendável" vem do servidor, calculada pela mesma função que o motor
 * usa para decidir. Recalcular aqui seria uma segunda implementação da regra, e
 * a tela passaria a mentir sobre o que o robô vai fazer.
 */
function ModalBox({
  aberto,
  onFechar,
  ocupado,
  comandar,
}: {
  aberto: boolean;
  onFechar: () => void;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
}) {
  const [box, setBox] = useState<NoBox[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("qualidade");

  const carregar = useCallback(async () => {
    const j = (await fetch("/api/robo/box")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as { box?: NoBox[] } | null;
    setBox(j?.box ?? []);
  }, []);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const termo = busca.trim().toLowerCase();
  const ordenar: Record<Ordem, (a: NoBox, b: NoBox) => number> = {
    qualidade: (a, b) => b.quality - a.quality || b.ivTotal - a.ivTotal,
    iv: (a, b) => b.ivTotal - a.ivTotal || b.quality - a.quality,
    nivel: (a, b) => b.level - a.level || b.ivTotal - a.ivTotal,
    valor: (a, b) => b.sellValue - a.sellValue,
    nome: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
  };
  const lista = (box ?? [])
    .filter((p) => !termo || p.name.toLowerCase().includes(termo))
    .sort(ordenar[ordem]);
  const marcados = (box ?? []).filter((p) => p.vendavel).length;

  return (
    <Modal open={aberto} onClose={onFechar} title="Box" eyebrow="fora do time" size="lg">
      {!box ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="filtrar por nome…"
              className="min-w-0 flex-1"
            />
            <Segmented
              value={ordem}
              onChange={setOrdem}
              size="sm"
              options={[
                { value: "qualidade", label: "qualidade" },
                { value: "iv", label: "IV" },
                { value: "nivel", label: "nível" },
                { value: "valor", label: "valor" },
                { value: "nome", label: "nome" },
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => void carregar()}>
              atualizar
            </Button>
          </div>
          <p className="text-[12px] text-text-mute">
            {box.length} no box{lista.length !== box.length ? ` · ${lista.length} no filtro` : ""}.
          </p>

          {marcados > 0 ? (
            <Note tone="warn">
              {marcados} {marcados === 1 ? "está marcado" : "estão marcados"} para a venda automática
              com a configuração de agora.
            </Note>
          ) : null}

          {lista.length === 0 ? (
            <Empty
              title={box.length ? "Nada com esse nome" : "Box vazio"}
              hint={box.length ? undefined : "Ligue o robô: a lista chega no primeiro ciclo da sessão."}
            />
          ) : (
            <ul className="flex max-h-[440px] flex-col gap-1 overflow-y-auto">
              {lista.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border border-line bg-bg-soft p-2"
                  style={p.vendavel ? { borderColor: "color-mix(in srgb, var(--color-danger) 40%, transparent)" } : undefined}
                >
                  <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[13px] text-text">
                      {p.name}
                      <span className="pix text-[10px] text-text-mute">nv {p.level}</span>
                      {p.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                      {p.locked ? <span className="pix text-[10px] text-text-mute">cadeado</span> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] tabular text-text-mute">
                      <Qualidade quality={p.quality} />
                      <span>IV {p.ivTotal}</span>
                      <span>poder {compact(p.power)}</span>
                      <span>vale {compact(p.sellValue)}</span>
                      <span>{num(p.hp, 0)}/{num(p.maxHp, 0)} de vida</span>
                    </p>
                  </div>
                  {p.vendavel ? (
                    <span className="pix shrink-0 text-[10px] text-danger">sai na venda</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={ocupado}
                    onClick={async () => {
                      await comandar("mover", { pokeId: p.id, dir: "withdraw" });
                      void carregar();
                    }}
                  >
                    pro time
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export function AbaCacada({
  estado,
  ocupado,
  comandar,
}: {
  estado: EstadoHunt;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
}) {
  const [boxAberto, setBoxAberto] = useState(false);
  const drops = estado.analyzer?.drops ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ModalBox
        aberto={boxAberto}
        onFechar={() => setBoxAberto(false)}
        ocupado={ocupado}
        comandar={comandar}
      />
      {/* ---- o time ---- */}
      <div className="flex flex-col gap-4">
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="pix text-[13px] text-text-dim">Time</h2>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!estado.conectado}
                onClick={() => setBoxAberto(true)}
              >
                box ({estado.noBox})
              </Button>
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void comandar("curar")}>
                curar na Joy
              </Button>
            </div>
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
                <li
                  key={p.id}
                  className="flex items-center gap-3 border border-line bg-bg-soft p-2"
                  style={p.leader ? { borderColor: "color-mix(in srgb, var(--color-t-robo) 45%, transparent)" } : undefined}
                >
                  <Sprite src={spriteUrl(p.speciesId, p.shiny)} alt="" size={p.leader ? 44 : 36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-text">
                      <span className="truncate">{p.name}</span>
                      <span className="pix text-[10px] text-text-mute">nv {p.level}</span>
                      {p.leader ? (
                        <span className="pix text-[10px]" style={{ color: COR }}>
                          líder
                        </span>
                      ) : null}
                      {p.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
                      <Qualidade quality={p.quality} />
                      <span className="pix text-[10px] text-text-mute">IV {p.ivTotal}</span>
                    </p>
                    <span className="mt-1 flex items-center gap-2">
                      <BarraVida hp={p.hp} maxHp={p.maxHp} />
                      <span className="shrink-0 text-[11px] tabular text-text-mute">
                        {num(p.hp, 0)}/{num(p.maxHp, 0)}
                      </span>
                    </span>
                    <span className="mt-1 block">
                      <BarraXp level={p.level} xp={p.xp} />
                    </span>
                  </div>
                  {!p.leader ? (
                    <span className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void comandar("lider", { pokeId: p.id })}
                      >
                        caçar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void comandar("mover", { pokeId: p.id, dir: "store" })}
                      >
                        guardar
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

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
      <div className="flex min-w-0 flex-col gap-4">
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

      {/* ---- o que a caçada rendeu ----
           O analyzer conta item a item com o preço do NPC junto. É a lista que
           responde o que marcar na venda automática. */}
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="pix text-[13px] text-text-dim">Drops desta caçada</h2>
          {drops.length ? (
            <span className="pix text-[11px] text-text-mute">
              {compact(drops.reduce((soma, d) => soma + d.gold, 0))} de ouro
            </span>
          ) : null}
        </div>
        {drops.length === 0 ? (
          <Empty
            title="Nada caiu ainda"
            hint={estado.slug ? "O analyzer conta a partir do primeiro abate." : "Comece uma caçada."}
          />
        ) : (
          <ul className="mt-3 flex max-h-[280px] flex-col gap-1 overflow-y-auto">
            {[...drops]
              .sort((a, b) => b.gold - a.gold)
              .map((d) => (
                <li
                  key={d.itemId}
                  className="flex items-center gap-2 border-b border-line/60 py-1.5 text-[13px] last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-text">{d.name}</span>
                  <span className="shrink-0 text-[11px] tabular text-text-mute">{compact(d.qty)}x</span>
                  <span className="w-20 shrink-0 text-right text-[11px] tabular text-ok">
                    {compact(d.gold)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Panel>
      </div>
    </div>
  );
}
