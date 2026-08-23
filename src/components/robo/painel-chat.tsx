"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Note, Panel, Segmented, Select, Sprite } from "@/components/ui";
import { compact, TIER_LABEL } from "@/lib/labels";
import { qualityTier, TIER_COLOR } from "@/lib/rarity";
import { TOM } from "@/components/robo/pecas";
import { fichaDoChat, type FichaPoke } from "@/components/robo/poke-modal";
import { lerMensagemDoChat, type ItemDoChat, type PokeDoChat } from "@/lib/robo/chat-links";
import { CANAIS, CANAL_ROTULO, type Canal, type EstadoHunt } from "@/lib/robo/motor/tipos";

/**
 * O chat do jogo.
 *
 * Ele chega de graça: é o mesmo socket que o robô já segura para caçar. E é a
 * única parte do painel em que o robô fala em nome do jogador, então tudo aqui é
 * manual — nenhuma mensagem sai sozinha.
 *
 * Duas decisões que a versão anterior não tinha:
 *
 * - **Ler e falar são escolhas separadas.** Acompanhar os três canais de uma vez
 *   e mandar no de troca é o uso normal; um seletor só obrigava a trocar de aba
 *   de leitura para responder no lugar certo.
 * - **Os cartões são decodificados.** O jogo embute pokémon e item como blocos
 *   `[poke!…]`/`[item!…]`, e sem decodificar a mensagem vira trezentos
 *   caracteres de base64 no meio da conversa.
 */

const COR = "var(--color-t-robo)";
const MAX = 300;

const CANAL_COR: Record<string, string> = {
  world: "var(--color-accent)",
  trade: TOM.ouro,
  help: TOM.diamante,
};

function hora(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** O cartão de pokémon colado na mensagem. Abre a MESMA ficha do time e do box. */
function CartaoPoke({ p, onFicha }: { p: PokeDoChat; onFicha: (f: FichaPoke) => void }) {
  const tier = qualityTier(p.quality);
  return (
    <button
      type="button"
      onClick={() => onFicha(fichaDoChat(p))}
      className="my-0.5 inline-flex max-w-full items-center gap-2 border bg-bg-soft px-2 py-1 text-left align-middle transition-colors hover:brightness-125"
      style={{ borderColor: `color-mix(in srgb, ${TIER_COLOR[tier]} 45%, transparent)` }}
      title="ver a ficha completa"
    >
      <b className="truncate text-[12px] text-text">{p.nome}</b>
      <span className="pix shrink-0 text-[10px] text-text-mute">nv {p.level}</span>
      {p.shiny ? <span className="pix shrink-0 text-[10px] text-warn">shiny</span> : null}
      <span className="pix shrink-0 text-[10px]" style={{ color: TIER_COLOR[tier] }}>
        {TIER_LABEL[tier]}
      </span>
      <span className="shrink-0 text-[11px] tabular text-text-mute">IV {p.ivTotal}</span>
      <span className="shrink-0 text-[11px] tabular" style={{ color: COR }}>
        {compact(p.power)}
      </span>
    </button>
  );
}

/** O cartão de item. Sem modal próprio: o que se quer saber dele cabe na linha. */
function CartaoItem({ i }: { i: ItemDoChat }) {
  return (
    <span
      className="my-0.5 inline-flex max-w-full items-center gap-2 border border-line bg-bg-soft px-2 py-1 align-middle"
      title={i.descricao || i.nome}
    >
      {i.icone ? <Sprite src={i.icone} alt="" size={18} /> : null}
      <b className="truncate text-[12px] text-text">{i.nome}</b>
      {i.npc > 0 ? (
        <span className="shrink-0 text-[11px] tabular" style={{ color: TOM.ouro }}>
          {compact(i.npc)}
        </span>
      ) : null}
    </span>
  );
}

function Corpo({ texto, onFicha }: { texto: string; onFicha: (f: FichaPoke) => void }) {
  const pedacos = useMemo(() => lerMensagemDoChat(texto), [texto]);
  return (
    <span className="min-w-0 break-words text-text-dim">
      {pedacos.map((p, i) =>
        p.tipo === "texto" ? (
          <span key={i}>{p.texto}</span>
        ) : p.tipo === "poke" ? (
          <CartaoPoke key={i} p={p} onFicha={onFicha} />
        ) : (
          <CartaoItem key={i} i={p} />
        ),
      )}
    </span>
  );
}

type Filtro = Canal | "todos";

export function AbaChat({
  estado,
  onFicha,
}: {
  estado: EstadoHunt;
  onFicha: (f: FichaPoke) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [destino, setDestino] = useState<Canal>("world");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const fim = useRef<HTMLDivElement | null>(null);

  const mensagens = useMemo(
    () => (filtro === "todos" ? estado.chat : estado.chat.filter((m) => m.canal === filtro)),
    [estado.chat, filtro],
  );
  const porCanal = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of estado.chat) c[m.canal] = (c[m.canal] ?? 0) + 1;
    return c;
  }, [estado.chat]);

  // O relógio é próprio: a espera do anti-flood conta sozinha, sem depender de
  // um frame novo chegar do servidor para a tela se atualizar.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Rola para a última só quando o filtro ou a contagem mudam: rolar a cada
  // renderização roubaria a leitura de quem subiu para ler o histórico.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [filtro, mensagens.length]);

  const esperaMs = estado.chatLiberadoEm ? Math.max(0, estado.chatLiberadoEm - agora) : 0;
  const espera = Math.ceil(esperaMs / 1000);
  const podeFalar = estado.conectado && !enviando && !esperaMs && texto.trim().length > 0;

  async function mandar() {
    if (!podeFalar) return;
    setEnviando(true);
    setRecado(null);
    try {
      const res = await fetch("/api/robo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), canal: destino }),
      });
      if (res.ok) {
        setTexto("");
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { erro?: string };
      setRecado(MOTIVO[j.erro ?? ""] ?? "não consegui mandar");
    } catch {
      setRecado("não consegui falar com o servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pix text-[13px] text-text-dim">Chat do jogo</h2>
        <span className="flex items-center gap-2">
          <span className="pix text-[10px] text-text-mute">lendo</span>
          <Segmented
            value={filtro}
            onChange={setFiltro}
            size="sm"
            options={[
              { value: "todos", label: `todos ${estado.chat.length || ""}`.trim() },
              ...CANAIS.map((c) => ({
                value: c,
                label: `${CANAL_ROTULO[c]}${porCanal[c] ? ` ${porCanal[c]}` : ""}`,
              })),
            ]}
          />
        </span>
      </div>

      {!estado.conectado ? (
        <Note className="mt-3">O chat chega pela sessão do jogo. Ligue o robô para ler e falar.</Note>
      ) : null}

      <div className="mt-3 flex h-[480px] flex-col overflow-y-auto border border-line bg-bg-soft p-2">
        {mensagens.length === 0 ? (
          <Empty
            title={filtro === "todos" ? "Sem mensagem ainda" : "Sem mensagem neste canal"}
            hint={
              estado.conectado
                ? "O jogo manda o histórico ao conectar e o resto ao vivo."
                : "Ligue o robô para receber."
            }
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {mensagens.map((m, i) => (
              <li key={m.id ?? `${m.em}-${i}`} className="flex gap-2 text-[13px] leading-snug">
                <span className="shrink-0 text-[11px] tabular text-text-mute">{hora(m.em)}</span>
                {/* O canal aparece SEMPRE, e não só no filtro unificado: sem ele,
                    trocar de filtro muda o significado da mesma linha. */}
                <span
                  className="pix w-12 shrink-0 text-[10px]"
                  style={{ color: CANAL_COR[m.canal] ?? "var(--color-text-mute)" }}
                  title={`canal ${CANAL_ROTULO[m.canal] ?? m.canal}`}
                >
                  {CANAL_ROTULO[m.canal] ?? m.canal}
                </span>
                <b
                  className="shrink-0"
                  style={{
                    color: m.minha
                      ? COR
                      : m.admin
                        ? TOM.perigo
                        : m.vip
                          ? TOM.ouro
                          : "var(--color-accent)",
                  }}
                  title={m.level ? `nível ${m.level}` : undefined}
                >
                  {m.de}
                </b>
                <Corpo texto={m.texto} onFicha={onFicha} />
              </li>
            ))}
            <div ref={fim} />
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex shrink-0 items-center gap-2">
          <span className="pix text-[10px] text-text-mute">falar em</span>
          <Select
            value={destino}
            onChange={setDestino}
            options={CANAIS.map((c) => ({ value: c, label: CANAL_ROTULO[c] }))}
            className="w-32"
          />
        </span>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void mandar();
          }}
          placeholder={`mensagem para ${CANAL_ROTULO[destino]}…`}
          disabled={!estado.conectado || enviando}
          className="min-w-0 flex-1"
        />
        <Button variant="primary" disabled={!podeFalar} onClick={() => void mandar()}>
          {esperaMs ? `${espera}s` : "mandar"}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-text-mute">
        {esperaMs
          ? `O jogo aceita cerca de uma mensagem por minuto. Faltam ${espera}s.`
          : `${texto.length}/${MAX} caracteres. Nada sai daqui sozinho.`}
      </p>

      <div aria-live="polite">{recado ? <Note tone="danger" className="mt-2">{recado}</Note> : null}</div>
    </Panel>
  );
}

const MOTIVO: Record<string, string> = {
  sem_sessao: "ligue o robô primeiro",
  vazio: "escreva alguma coisa antes de mandar",
  espera: "o jogo aceita cerca de uma mensagem por minuto",
  recusado: "o jogo recusou essa mensagem",
  sem_eco: "o jogo não confirmou o envio; pode ter entrado mesmo assim",
  ocupado: "ainda estou mandando a anterior",
};
