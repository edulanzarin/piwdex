"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Note, Panel, Segmented } from "@/components/ui";
import { CANAIS, CANAL_ROTULO, type Canal, type EstadoHunt } from "@/lib/robo/motor/tipos";

/**
 * O chat do jogo.
 *
 * Ele chega de graça: é o mesmo socket que o robô já segura para caçar. E é a
 * única parte do painel em que o robô fala em nome do jogador, então tudo aqui é
 * manual — nenhuma mensagem sai sozinha.
 *
 * O jogo aceita cerca de uma mensagem por minuto. A tela mostra a espera em vez
 * de deixar o envio falhar calado, porque uma recusa silenciosa aqui parece bug
 * do painel.
 */

const COR = "var(--color-t-robo)";
const MAX = 300;

function hora(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AbaChat({ estado }: { estado: EstadoHunt }) {
  const [canal, setCanal] = useState<Canal>("world");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const fim = useRef<HTMLDivElement | null>(null);

  const mensagens = useMemo(
    () => estado.chat.filter((m) => m.canal === canal),
    [estado.chat, canal],
  );

  // O relógio é próprio: a espera do anti-flood conta sozinha, sem depender de
  // um frame novo chegar do servidor para a tela se atualizar.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Rola para a última só quando o canal ou a contagem mudam: rolar a cada
  // renderização roubaria a leitura de quem subiu para ler o histórico.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [canal, mensagens.length]);

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
        body: JSON.stringify({ texto: texto.trim(), canal }),
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
        <Segmented
          value={canal}
          onChange={setCanal}
          size="sm"
          options={CANAIS.map((c) => ({ value: c, label: CANAL_ROTULO[c] }))}
        />
      </div>

      {!estado.conectado ? (
        <Note className="mt-3">
          O chat chega pela sessão do jogo. Ligue o robô para ler e falar.
        </Note>
      ) : null}

      <div className="mt-3 flex h-[480px] flex-col overflow-y-auto border border-line bg-bg-soft p-2">
        {mensagens.length === 0 ? (
          <Empty
            title="Sem mensagem neste canal"
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
                <span
                  className="shrink-0 font-bold"
                  style={{ color: m.minha ? COR : m.admin ? "var(--color-danger)" : m.vip ? "var(--color-warn)" : "var(--color-accent)" }}
                  title={m.level ? `nível ${m.level}` : undefined}
                >
                  {m.de}
                </span>
                <span className="min-w-0 break-words text-text-dim">{m.texto}</span>
              </li>
            ))}
            <div ref={fim} />
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void mandar();
          }}
          placeholder={`falar em ${CANAL_ROTULO[canal]}…`}
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
