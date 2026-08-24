"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Combobox, Note, Panel, Tabs } from "@/components/ui";
import { compact } from "@/lib/labels";
import { estadoParado, type EstadoHunt, type Mensagem } from "@/lib/robo/motor/tipos";
import { CONFIG_PADRAO, type ConfigAuto } from "@/lib/robo/motor/tipos";
import { BarraTopo } from "@/components/robo/painel-estado";
import { AbaCacada } from "@/components/robo/painel-cacada";
import { AbaAutomacao } from "@/components/robo/painel-automacao";
import { AbaLoja } from "@/components/robo/painel-loja";
import { AbaChat } from "@/components/robo/painel-chat";
import { AbaConta } from "@/components/robo/painel-conta";
import { AbaRegistro } from "@/components/robo/painel-registro";
import { PokeModal, fichaDaConta, type FichaPoke } from "@/components/robo/poke-modal";
import { ProvedorConta, comConta } from "@/components/robo/conta-atual";
import { SeletorDeConta, type ContaNaTela, type ContaViva } from "@/components/robo/seletor-conta";

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

type Aba = "conta" | "cacada" | "automacao" | "loja" | "chat" | "registro";

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
  contas,
  contaAtiva,
}: {
  hunts: HuntOpcao[];
  slugInicial: string | null;
  temVinculo: boolean;
  vinculo: "active" | "expired" | "blocked" | null;
  nomeJogador: string | null;
  configInicial: ConfigAuto | null;
  estadoInicial: EstadoHunt;
  contas: ContaNaTela[];
  /** `null` = nenhuma conta ligada ainda */
  contaAtiva: string | null;
}) {
  const router = useRouter();
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
  /**
   * Quantos eventos gravados ainda não foram vistos.
   *
   * Vem do banco, e não de um contador de memória: o registro sobrevive ao
   * restart, e um "não lido" que zera a cada recarga é ruído, não aviso.
   */
  const [eventosNovos, setEventosNovos] = useState(0);
  const fonte = useRef<EventSource | null>(null);
  /**
   * As contas com o estado VIVO.
   *
   * O servidor manda o cadastro no primeiro render; isto acrescenta "esta
   * conectada agora", que e a metade que muda sozinha. Um minuto de intervalo
   * porque a pergunta e "alguma caiu?", e nao "o que esta acontecendo" — essa
   * ultima ja tem o stream da conta aberta.
   */
  const [vivas, setVivas] = useState<ContaViva[]>(contas);
  const [limite, setLimite] = useState(contas.length);

  useEffect(() => {
    if (!temVinculo) return;
    const ler = () =>
      fetch("/api/robo/contas")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { contas?: ContaViva[]; limite?: number } | null) => {
          if (j?.contas) setVivas(j.contas);
          if (j?.limite) setLimite(j.limite);
        })
        .catch(() => {});
    void ler();
    const t = setInterval(ler, 60_000);
    return () => clearInterval(t);
  }, [temVinculo]);


  useEffect(() => {
    if (!temVinculo) return;
    const es = new EventSource(comConta("/api/robo/estado", contaAtiva));
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
    // `contaAtiva` na lista: trocar de conta tem que FECHAR o stream da anterior.
    // Sem isso a tela receberia dois fluxos ao mesmo tempo, e o estado piscaria
    // entre duas contas sem nada indicar qual e qual.
  }, [temVinculo, contaAtiva]);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!temVinculo) return;
    const ler = () =>
      fetch("/api/robo/eventos?so=contagem")
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { naoLidos?: number } | null) => setEventosNovos(j?.naoLidos ?? 0))
        .catch(() => {});
    void ler();
    // Um minuto: o registro guarda o que aconteceu, não o que está acontecendo.
    const t = setInterval(ler, 60_000);
    return () => clearInterval(t);
  }, [temVinculo]);

  /**
   * O seletor acompanha a caçada que está NO AR.
   *
   * Com objetivo ligado quem escolhe é o robô, e o campo continuava mostrando o
   * que a pessoa tinha digitado da última vez — ou vazio. Ler "escolha onde
   * caçar" enquanto o bicho caça em outro lugar é a tela contradizendo o próprio
   * feed de abates.
   */
  useEffect(() => {
    if (estado.slug && estado.slug !== slug) setSlug(estado.slug);
    // `estado.slug` só: sincronizar com o rascunho local prenderia a digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.slug]);

  // Estar NA aba do chat já é ter lido: a contagem zera enquanto ela está aberta.
  useEffect(() => {
    if (aba === "chat") setLidoAte(Date.now());
  }, [aba, chat.length]);

  const naoLidas = chat.filter((m) => m.em > lidoAte && !m.minha).length;

  const comandar = useCallback(async (rota: string, corpo?: unknown) => {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(comConta(`/api/robo/${rota}`, contaAtiva), {
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
  }, [contaAtiva]);

  /** Salva a config e adota o que VOLTOU: a normalizacao do servidor corrige
   *  alvo abaixo do piso, e mostrar o valor enviado esconderia a correcao. */
  const mudarConfig = useCallback(async (cfg: ConfigAuto) => {
    const res = await fetch(comConta("/api/robo/config", contaAtiva), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { config?: ConfigAuto } | null;
    setConfig(j?.config ?? cfg);
  }, [contaAtiva]);

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
    <ProvedorConta value={contaAtiva}>
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

      {/* Antes das abas: qual conta esta na tela e a pergunta que precede
          qualquer outra. Depois delas, ela viraria rodape de um painel que ja
          foi lido como se fosse "a" conta. */}
      {vivas.length > 1 || limite > 1 ? (
        <SeletorDeConta
          contas={vivas}
          ativa={contaAtiva}
          limite={limite}
          onTrocar={(id) => router.push(`/painel?conta=${encodeURIComponent(id)}`)}
          onAdicionar={() => router.push("/conectar")}
        />
      ) : null}

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "conta", label: "Conta" },
          { value: "cacada", label: "Caçada" },
          { value: "automacao", label: "Automação" },
          { value: "loja", label: "Loja" },
          { value: "chat", label: "Chat", count: naoLidas || undefined },
          { value: "registro", label: "Registro", count: eventosNovos || undefined },
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
          config={config}
          onConfig={mudarConfig}
        />
      ) : null}
      {aba === "automacao" ? <AbaAutomacao estado={estado} /> : null}
      {aba === "loja" ? (
        <AbaLoja estado={estado} config={config} onConfig={mudarConfig} />
      ) : null}
      <PokeModal ficha={ficha} onFechar={() => setFicha(null)} />

      {aba === "conta" ? <AbaConta onFicha={setFicha} /> : null}
      {aba === "chat" ? (
        <AbaChat estado={estado} chat={chat} lidoAte={lidoAte} onFicha={setFicha} />
      ) : null}
      {aba === "registro" ? <AbaRegistro onLido={() => setEventosNovos(0)} /> : null}
    </div>
    </ProvedorConta>
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
