"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Combobox, Note, Panel, Tabs } from "@/components/ui";
import { compact } from "@/lib/labels";
import { estadoParado, type EstadoHunt, type Mensagem } from "@/lib/robo/motor/tipos";
import { CONFIG_PADRAO, type ConfigAuto } from "@/lib/robo/motor/tipos";
import { BarraTopo } from "@/components/robo/painel-estado";
import { AbaCacada } from "@/components/robo/painel-cacada";
import { AbaAutomacao } from "@/components/robo/painel-automacao";
import { AbaChat } from "@/components/robo/painel-chat";
import { AbaConta } from "@/components/robo/painel-conta";
import { AbaRegistro } from "@/components/robo/painel-registro";
import { PokeModal, fichaDaConta, type FichaPoke } from "@/components/robo/poke-modal";

/**
 * O cockpit.
 *
 * Tudo que muda sozinho chega por UM stream (`/api/robo/estado`). A alternativa
 * seria a tela perguntar de tempos em tempos por analyzer, time, fila, vida,
 * ouro e status: seis pollings cuja resposta quase sempre e "nada mudou". Quem
 * sabe que mudou e o servidor, entao e ele que fala.
 *
 * O que NAO vem pelo stream vem por GET sob demanda, e a linha entre os dois e o
 * tamanho: a lista da loja e o box tem centenas de itens e mudam de hora em
 * hora. Empurrar isso uma vez por segundo seria pagar banda continua por dado
 * parado.
 */

const COR = "var(--color-t-robo)";

export interface HuntOpcao {
  slug: string;
  nome: string;
  level: number;
  area: string;
}

type Aba = "conta" | "cacada" | "automacao" | "chat" | "registro";

function Numero({
  rotulo,
  valor,
  sufixo,
  tom,
}: {
  rotulo: string;
  valor: string;
  sufixo?: string;
  tom?: string;
}) {
  return (
    <div className="border border-line bg-bg-soft p-2.5">
      <p className="pix text-[11px] text-text-mute">{rotulo}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span
          className="text-[20px] leading-none font-bold tabular"
          style={{ color: tom ?? "var(--color-text)" }}
        >
          {valor}
        </span>
        {sufixo ? <span className="pix text-[10px] text-text-mute">{sufixo}</span> : null}
      </p>
    </div>
  );
}

export function PainelTool({
  hunts,
  slugInicial,
  temVinculo,
  vinculo,
  nomeJogador,
  configInicial,
  estadoInicial,
}: {
  hunts: HuntOpcao[];
  slugInicial: string | null;
  temVinculo: boolean;
  vinculo: "active" | "expired" | "blocked" | null;
  nomeJogador: string | null;
  configInicial: ConfigAuto;
  estadoInicial: EstadoHunt;
}) {
  const [estado, setEstado] = useState<EstadoHunt>(estadoInicial ?? estadoParado());
  const [slug, setSlug] = useState(slugInicial ?? "");
  const [aba, setAba] = useState<Aba>("conta");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigAuto>(configInicial ?? CONFIG_PADRAO);
  // Um relogio proprio: o `desdeMs` nao muda, mas "há quanto tempo" muda sozinho.
  const [agora, setAgora] = useState(() => Date.now());
  // O modal de pokémon mora AQUI, e não em cada aba: ele é aberto do topo, da
  // caçada, da conta e do chat, e uma cópia por origem daria quatro fichas
  // ligeiramente diferentes do mesmo bicho.
  const [ficha, setFicha] = useState<FichaPoke | null>(null);
  // O chat chega por um evento próprio do stream: ele muda devagar e o estado
  // muda a cada segundo, e juntá-los reenviaria a conversa inteira sessenta
  // vezes por minuto.
  const [chat, setChat] = useState<Mensagem[]>([]);
  /**
   * Até quando o chat já foi lido.
   *
   * A contagem na aba é de NÃO LIDAS. "60" fixo não é aviso, é decoração: um
   * número que nunca muda para de ser olhado, e aí a mensagem que importa passa
   * junto com ele.
   */
  const [lidoAte, setLidoAte] = useState(() => Date.now());
  const fonte = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!temVinculo) return;
    const es = new EventSource("/api/robo/estado");
    fonte.current = es;
    es.addEventListener("chat", (ev) => {
      try {
        setChat(JSON.parse((ev as MessageEvent).data) as Mensagem[]);
      } catch {
        /* frame torto: mantem o ultimo chat bom */
      }
    });
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

  // Estar NA aba do chat já é ter lido: a contagem zera enquanto ela está aberta.
  useEffect(() => {
    if (aba === "chat") setLidoAte(Date.now());
  }, [aba, chat.length]);

  const naoLidas = chat.filter((m) => m.em > lidoAte && !m.minha).length;

  const comandar = useCallback(async (rota: string, corpo?: unknown) => {
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
        setErro(MENSAGEM[j.erro ?? ""] ?? j.motivo ?? j.erro ?? "não deu certo");
      }
    } catch {
      setErro("não consegui falar com o servidor");
    } finally {
      setOcupado(false);
    }
  }, []);

  /** Salva a config e adota o que VOLTOU: a normalizacao do servidor corrige
   *  alvo abaixo do piso, e mostrar o valor enviado esconderia a correcao. */
  const mudarConfig = useCallback(async (cfg: ConfigAuto) => {
    const res = await fetch("/api/robo/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { config?: ConfigAuto } | null;
    setConfig(j?.config ?? cfg);
  }, []);

  if (!temVinculo) {
    return (
      <Panel className="mx-auto mt-8 max-w-lg p-6">
        <h1 className="pix text-[17px]" style={{ color: COR }}>
          Painel
        </h1>
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

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[1400px] flex-col gap-4">
      <BarraTopo
        estado={estado}
        agora={agora}
        nomeJogador={nomeJogador}
        vinculo={vinculo}
        ocupado={ocupado}
        comandar={comandar}
        onAbrirLider={() => {
          const l = estado.time.find((p) => p.leader) ?? estado.time[0];
          if (l) setFicha(fichaDaConta(l, "líder da caçada"));
        }}
      />

      <div aria-live="polite">{erro ? <Note tone="danger">{erro}</Note> : null}</div>

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "conta", label: "Conta" },
          { value: "cacada", label: "Caçada" },
          { value: "automacao", label: "Automação" },
          { value: "chat", label: "Chat", count: naoLidas || undefined },
          { value: "registro", label: "Registro" },
        ]}
      />

      {aba === "cacada" ? (
        <AbaCacada
          estado={estado}
          ocupado={ocupado}
          comandar={comandar}
          hunts={hunts}
          slug={slug}
          setSlug={setSlug}
          onFicha={setFicha}
        />
      ) : null}
      {aba === "automacao" ? (
        <AbaAutomacao estado={estado} config={config} onConfig={mudarConfig} erro={null} />
      ) : null}
      <PokeModal ficha={ficha} onFechar={() => setFicha(null)} />

      {aba === "conta" ? <AbaConta onFicha={setFicha} /> : null}
      {aba === "chat" ? (
        <AbaChat estado={estado} chat={chat} lidoAte={lidoAte} onFicha={setFicha} />
      ) : null}
      {aba === "registro" ? <AbaRegistro /> : null}
    </div>
  );
}

/** As recusas das rotas, em portugues de gente. Sem isto a tela mostra o nome da
 *  constante do servidor, que nao diz a ninguem o que fazer a seguir. */
const MENSAGEM: Record<string, string> = {
  sem_hunt: "escolha uma hunt primeiro",
  sem_sessao: "ligue o robô primeiro",
  vazio: "escreva alguma coisa antes de mandar",
  espera: "o jogo aceita cerca de uma mensagem por minuto",
  recusado: "o jogo recusou essa mensagem",
  sem_eco: "o jogo não confirmou o envio",
  ocupado: "ainda estou mandando a anterior",
  hunt_desconhecida: "essa hunt não existe no catálogo do jogo",
  sem_vinculo: "conecte a sua conta do jogo antes",
  vinculo_vencido: "o token do jogo venceu: reconecte a conta",
  conta_bloqueada: "o jogo recusou esta conta",
  shard_nao_encontrado: "não achei o shard da conta no jogo; tente de novo em instantes",
  assinatura_inativa: "a assinatura não está ativa",
};
