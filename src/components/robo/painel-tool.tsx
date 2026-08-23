"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Combobox, Empty, Note, Panel, Sprite } from "@/components/ui";
import { compact, num } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import { estadoParado, type EstadoHunt, type StatusSessao } from "@/lib/robo/motor/tipos";

/**
 * O cockpit.
 *
 * Tudo aqui chega por UM stream (`/api/robo/estado`). A alternativa seria a tela
 * perguntar de tempos em tempos por analyzer, time, fila, vida e status — cinco
 * pollings cuja resposta quase sempre e "nada mudou". Quem sabe que mudou e o
 * servidor, entao e ele que fala.
 */

const COR = "var(--color-t-robo)";

export interface HuntOpcao {
  slug: string;
  nome: string;
  level: number;
  area: string;
}

const ROTULO: Record<StatusSessao, { texto: string; cor: string }> = {
  parado: { texto: "parado", cor: "var(--color-text-mute)" },
  conectando: { texto: "conectando", cor: "var(--color-warn)" },
  rodando: { texto: "caçando", cor: "var(--color-ok)" },
  chutado: { texto: "sessão perdida", cor: "var(--color-warn)" },
  erro: { texto: "erro", cor: "var(--color-danger)" },
  bloqueado: { texto: "conta recusada", cor: "var(--color-danger)" },
};

/** Duracao em h/min, sem virar cronometro de segundos: o numero muda a cada
 *  tique e ninguem le "1h 03min 47s" — le "cerca de uma hora". */
function duracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

function Numero({ rotulo, valor, sufixo }: { rotulo: string; valor: string; sufixo?: string }) {
  return (
    <div className="border border-line bg-bg-soft p-2.5">
      <p className="pix text-[11px] text-text-mute">{rotulo}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[20px] leading-none font-bold tabular text-text">{valor}</span>
        {sufixo ? <span className="pix text-[10px] text-text-mute">{sufixo}</span> : null}
      </p>
    </div>
  );
}

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

export function PainelTool({
  hunts,
  slugInicial,
  temVinculo,
  nomeJogador,
}: {
  hunts: HuntOpcao[];
  slugInicial: string | null;
  temVinculo: boolean;
  nomeJogador: string | null;
}) {
  const [estado, setEstado] = useState<EstadoHunt>(estadoParado);
  const [slug, setSlug] = useState(slugInicial ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Um relogio proprio: o `desdeMs` nao muda, mas "há quanto tempo" muda sozinho.
  const [agora, setAgora] = useState(() => Date.now());
  const fonte = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!temVinculo) return;
    const es = new EventSource("/api/robo/estado");
    fonte.current = es;
    es.addEventListener("estado", (ev) => {
      try {
        setEstado(JSON.parse((ev as MessageEvent).data) as EstadoHunt);
      } catch {
        /* frame torto: mantem o ultimo estado bom */
      }
    });
    // Sem `onerror` desligando nada de proposito: o EventSource reconecta
    // sozinho, e derrubar a fonte aqui trocaria uma falha passageira por uma
    // tela permanentemente morta.
    return () => {
      es.close();
      fonte.current = null;
    };
  }, [temVinculo]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function comandar(rota: string, corpo?: unknown) {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(`/api/robo/${rota}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { erro?: string; motivo?: string };
        setErro(j.motivo || j.erro || "não deu certo");
      }
    } catch {
      setErro("não consegui falar com o servidor");
    } finally {
      setOcupado(false);
    }
  }

  if (!temVinculo) {
    return (
      <Panel className="mx-auto mt-8 max-w-lg p-6">
        <h1 className="pix text-[17px]" style={{ color: COR }}>Painel</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-text-dim">
          Falta ligar a sua conta do jogo. É uma vez só, e a senha não passa por aqui.
        </p>
        <Link
          href="/conectar"
          className="pix mt-5 inline-flex border px-4 py-2 text-[12px] transition-colors hover:brightness-125"
          style={{ borderColor: COR, color: COR }}
        >
          conectar a conta
        </Link>
      </Panel>
    );
  }

  const a = estado.analyzer;
  const rodando = estado.status === "rodando" || estado.status === "conectando";
  const r = ROTULO[estado.status];
  const opcoes = hunts.map((h) => ({
    value: h.slug,
    label: `${h.nome} · nv ${h.level}`,
    keywords: `${h.slug} ${h.area}`,
  }));

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-4">
      {/* ---- comando ---- */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="pix text-[11px] text-text-mute">Hunt</p>
            <div className="mt-1">
              <Combobox
                value={slug}
                onChange={(v) => setSlug(String(v))}
                options={opcoes}
                placeholder="Escolha onde caçar…"
              />
            </div>
          </div>
          {estado.ligado ? (
            <Button variant="danger" size="lg" disabled={ocupado} onClick={() => void comandar("parar")}>
              desligar
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={ocupado || !slug}
              onClick={() => void comandar("ligar", { slug })}
            >
              ligar o robô
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="pix text-[11px]" style={{ color: r.cor }}>
            ● {r.texto}
          </span>
          {estado.slug ? <span className="text-text-mute">em {estado.slug}</span> : null}
          {estado.desdeMs && rodando ? (
            <span className="text-text-mute">há {duracao(agora - estado.desdeMs)}</span>
          ) : null}
          {estado.reconectando && estado.proximaTentativaEm ? (
            <span className="text-warn">
              tentando de novo em {Math.max(0, Math.ceil((estado.proximaTentativaEm - agora) / 1000))}s
            </span>
          ) : null}
          {nomeJogador ? <span className="ml-auto text-text-mute">{nomeJogador}</span> : null}
        </div>

        {estado.status === "bloqueado" ? (
          <Note tone="danger" className="mt-3">
            O jogo recusou esta conta{estado.motivoBloqueio ? `: “${estado.motivoBloqueio}”` : "."} O robô
            parou, e insistir não resolve.
          </Note>
        ) : (
          <Note className="mt-3">
            Enquanto o robô está ligado, a sua aba do jogo fica de fora — o jogo aceita uma sessão por
            conta. Desligue aqui antes de jogar no navegador.
          </Note>
        )}

        <div aria-live="polite">
          {erro ? <Note tone="danger" className="mt-3">{erro}</Note> : null}
        </div>
      </Panel>

      {/* ---- os numeros da sessao ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Numero rotulo="Derrotados" valor={a ? compact(a.kills) : "—"} />
        <Numero rotulo="Capturas" valor={a ? compact(a.captures) : "—"} sufixo={a?.shinyCaptures ? `${a.shinyCaptures} shiny` : undefined} />
        <Numero rotulo="XP/h" valor={a ? compact(Math.round(a.xpPerHour)) : "—"} />
        <Numero rotulo="Ouro/h" valor={a ? compact(Math.round(a.goldPerHour)) : "—"} />
        <Numero rotulo="Saldo" valor={a ? compact(Math.round(a.balance)) : "—"} sufixo="ouro" />
        <Numero rotulo="Bolas" valor={a ? compact(a.ballsUsed) : "—"} sufixo="usadas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* ---- o time ---- */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Time</h2>
            <Button
              variant="outline"
              size="sm"
              disabled={ocupado}
              onClick={() => void comandar("curar")}
            >
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
                        <span className="pix text-[10px]" style={{ color: COR }}>líder</span>
                      ) : null}
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
        </Panel>

        {/* ---- o que esta acontecendo ---- */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pix text-[13px] text-text-dim">Ao vivo</h2>
            {estado.fila.length ? (
              <span className="pix text-[11px] text-text-mute">
                {estado.fila.length} na fila de captura
              </span>
            ) : null}
          </div>

          {estado.eventos.length === 0 ? (
            <Empty
              title="Nada ainda"
              hint={estado.ligado ? "Os primeiros abates aparecem em segundos." : "Ligue o robô numa hunt."}
            />
          ) : (
            <ul className="mt-3 flex max-h-[420px] flex-col gap-1 overflow-y-auto">
              {estado.eventos.map((e, i) => (
                <li
                  key={`${e.em}-${i}`}
                  className="flex items-center gap-2 border-b border-line/60 py-1.5 text-[13px] last:border-0"
                >
                  <span
                    className="pix shrink-0 text-[10px]"
                    style={{ color: e.tipo === "captura" ? COR : "var(--color-text-mute)" }}
                  >
                    {e.tipo === "captura" ? "pegou" : "abateu"}
                  </span>
                  <span className="truncate text-text">
                    {e.especie}
                    {e.shiny ? <span className="ml-1 text-warn">shiny</span> : null}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular text-text-mute">
                    {e.xp > 0 ? `+${compact(e.xp)} xp` : (e.bola ?? "")}
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
