"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Combobox, Note, Panel, Tabs } from "@/components/ui";
import { compact } from "@/lib/labels";
import { estadoParado, type EstadoHunt } from "@/lib/robo/motor/tipos";
import { CONFIG_PADRAO, type ConfigAuto } from "@/lib/robo/motor/tipos";
import { Diagnostico, LinhaStatus } from "@/components/robo/painel-estado";
import { AbaCacada } from "@/components/robo/painel-cacada";
import { AbaAutomacao } from "@/components/robo/painel-automacao";
import { AbaChat } from "@/components/robo/painel-chat";
import { AbaConta } from "@/components/robo/painel-conta";
import { AbaRegistro } from "@/components/robo/painel-registro";

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

  const a = estado.analyzer;
  const p = estado.placar;
  const opcoes = hunts.map((h) => ({
    value: h.slug,
    label: `${h.nome} · nv ${h.level}`,
    keywords: `${h.slug} ${h.area}`,
  }));
  const estoqueBolas = estado.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
  const liquido = (a?.balance ?? 0) + p.ouroVendas + p.ouroPokes - p.ouroCompras;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[1400px] flex-col gap-4">
      {/* ---- comando ----
           Duas linhas, e a separacao e o assunto: em cima a SESSAO (ligar o robo
           e tomar a conta do jogo), embaixo a CACADA (um trabalho que roda em
           cima dela). Numa linha so, escolher hunt virava pre-requisito pra usar
           venda, reposicao e chat. */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <LinhaStatus estado={estado} agora={agora} nomeJogador={nomeJogador} vinculo={vinculo} />
          </div>
          {estado.ligado ? (
            <Button variant="danger" size="lg" disabled={ocupado} onClick={() => void comandar("parar")}>
              desligar o robô
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled={ocupado} onClick={() => void comandar("ligar")}>
              ligar o robô
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <div className="min-w-0 flex-1 basis-64">
            <p className="pix text-[11px] text-text-mute">Caçada</p>
            <div className="mt-1">
              <Combobox
                value={slug}
                onChange={(v) => setSlug(String(v))}
                options={opcoes}
                placeholder="Escolha onde caçar…"
              />
            </div>
          </div>
          <Button
            variant={estado.slug === slug && estado.slug ? "outline" : "primary"}
            disabled={ocupado || !slug || !estado.conectado || estado.slug === slug}
            onClick={() => void comandar("cacar", { slug })}
          >
            {estado.slug ? "trocar de caçada" : "começar a caçar"}
          </Button>
          {estado.slug ? (
            <Button variant="outline" disabled={ocupado} onClick={() => void comandar("cacar", {})}>
              parar a caçada
            </Button>
          ) : null}
          {!estado.conectado ? (
            <span className="pb-2 text-[12px] text-text-mute">Ligue o robô para poder caçar.</span>
          ) : null}
        </div>

        <Diagnostico estado={estado} vinculo={vinculo} />

        <div aria-live="polite">{erro ? <Note tone="danger" className="mt-3">{erro}</Note> : null}</div>
      </Panel>

      {/* ---- os numeros da sessao ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Numero rotulo="Derrotados" valor={a ? compact(a.kills) : "—"} />
        <Numero
          rotulo="Capturas"
          valor={a ? compact(a.captures) : "—"}
          sufixo={a?.shinyCaptures ? `${a.shinyCaptures} shiny` : undefined}
        />
        <Numero rotulo="XP/h" valor={a ? compact(Math.round(a.xpPerHour)) : "—"} />
        <Numero rotulo="Ouro/h" valor={a ? compact(Math.round(a.goldPerHour)) : "—"} />
        <Numero
          rotulo="Saldo"
          valor={a ? compact(Math.round(liquido)) : "—"}
          sufixo="ouro"
          tom={liquido < 0 ? "var(--color-danger)" : "var(--color-ok)"}
        />
        <Numero
          rotulo="Bolsa"
          valor={estoqueBolas ? compact(estoqueBolas) : "—"}
          sufixo="bolas"
          tom={estoqueBolas === 0 && estado.ligado ? "var(--color-danger)" : undefined}
        />
        <Numero rotulo="Ouro" valor={estado.ouro != null ? compact(estado.ouro) : "—"} />
        <Numero
          rotulo="Nível"
          valor={estado.nivelLider != null ? String(estado.nivelLider) : "—"}
          sufixo={estado.passoAtual ? `de ${config.nivelAlvo}` : "líder"}
          tom={estado.rotaConcluida ? "var(--color-ok)" : undefined}
        />
      </div>

      {/* O placar das automacoes so aparece quando ha o que contar: uma linha de
          zeros ocuparia espaco pra dizer que nada aconteceu. */}
      {p.ouroCompras || p.ouroVendas || p.ouroPokes ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border border-line bg-bg-soft px-3 py-2 text-[12px]">
          <span className="pix text-[10px] text-text-mute">nesta sessão</span>
          {p.bolasCompradas ? <span className="text-text-dim">{compact(p.bolasCompradas)} bolas repostas</span> : null}
          {p.pocoesCompradas ? <span className="text-text-dim">{compact(p.pocoesCompradas)} poções</span> : null}
          {p.revivesComprados ? <span className="text-text-dim">{compact(p.revivesComprados)} revives</span> : null}
          {p.itensVendidos ? (
            <span className="text-ok">
              {compact(p.itensVendidos)} itens vendidos por {compact(p.ouroVendas)}
            </span>
          ) : null}
          {p.pokesVendidos ? (
            <span className="text-ok">
              {compact(p.pokesVendidos)} pokémons vendidos por {compact(p.ouroPokes)}
            </span>
          ) : null}
          {p.ouroCompras ? <span className="text-warn">−{compact(p.ouroCompras)} em compras</span> : null}
        </div>
      ) : null}

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "conta", label: "Conta" },
          { value: "cacada", label: "Caçada" },
          { value: "automacao", label: "Automação" },
          { value: "chat", label: "Chat", count: estado.chat.length || undefined },
          { value: "registro", label: "Registro" },
        ]}
      />

      {aba === "cacada" ? <AbaCacada estado={estado} ocupado={ocupado} comandar={comandar} /> : null}
      {aba === "automacao" ? (
        <AbaAutomacao estado={estado} config={config} onConfig={mudarConfig} erro={null} />
      ) : null}
      {aba === "conta" ? <AbaConta /> : null}
      {aba === "chat" ? <AbaChat estado={estado} /> : null}
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
