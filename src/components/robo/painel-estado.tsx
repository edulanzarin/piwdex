"use client";

import Link from "next/link";
import { Note } from "@/components/ui";
import type { EstadoHunt, StatusSessao } from "@/lib/robo/motor/tipos";

/**
 * O que o robo esta fazendo, e por que.
 *
 * O painel antigo tinha um rotulo so ("sessão perdida") pra seis situacoes
 * diferentes, e nenhuma delas tinha acao. Quem olhava via o robo reconectar em
 * loop sem nenhuma pista de onde travou: token vencido, shard remanejado e queda
 * de rede produziam a mesma frase.
 *
 * Aqui cada estado carrega tres coisas: o que aconteceu, se vale esperar, e o
 * que fazer quando nao vale.
 */

const COR = "var(--color-t-robo)";

export const ROTULO: Record<StatusSessao, { texto: string; cor: string }> = {
  parado: { texto: "parado", cor: "var(--color-text-mute)" },
  conectando: { texto: "conectando", cor: "var(--color-warn)" },
  rodando: { texto: "caçando", cor: "var(--color-ok)" },
  chutado: { texto: "sessão perdida", cor: "var(--color-warn)" },
  erro: { texto: "erro", cor: "var(--color-danger)" },
  bloqueado: { texto: "conta recusada", cor: "var(--color-danger)" },
  vencido: { texto: "token vencido", cor: "var(--color-danger)" },
};

/** Duracao em h/min, sem virar cronometro de segundos: o numero muda a cada
 *  tique e ninguem le "1h 03min 47s". */
export function duracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/**
 * `vinculo` existe porque a sessao viva morre com o processo e o problema nao.
 *
 * Token vencido grava `expired` no banco e o motor para. Depois de um restart a
 * sessao volta como "parado", e sem consultar o vinculo a tela diria so isso —
 * escondendo justamente a unica coisa que o usuario precisa fazer.
 */
export function Diagnostico({
  estado,
  vinculo,
}: {
  estado: EstadoHunt;
  vinculo: "active" | "expired" | "blocked" | null;
}) {
  const { fechamento, explicacao } = estado;
  const status = estado.status === "parado" && vinculo === "expired" ? "vencido" : estado.status;

  if (status === "vencido") {
    return (
      <Note tone="danger" className="mt-3">
        O jogo recusou o token desta conta. Abra o jogo no navegador, copie o{" "}
        <code className="text-text">pokeweb:tokens</code> de novo e cole em{" "}
        <Link href="/conectar" className="underline" style={{ color: COR }}>
          conectar a conta
        </Link>
        . O robô parou sozinho porque nenhuma tentativa daqui gera um token novo.
      </Note>
    );
  }

  if (status === "bloqueado") {
    return (
      <Note tone="danger" className="mt-3">
        O jogo recusou esta conta
        {estado.motivoBloqueio ? `: “${estado.motivoBloqueio}”` : "."} O robô parou, e insistir não
        resolve.
      </Note>
    );
  }

  // Caiu, mas ainda ha o que tentar: mostra o codigo cru do jogo. Ele e a unica
  // pista objetiva de onde travou, e traduzir sem mostrar apagaria a evidencia.
  if ((status === "chutado" || status === "erro") && fechamento) {
    return (
      <Note tone="warn" className="mt-3">
        {explicacao ?? "a conexão caiu"}
        {fechamento.codigo ? (
          <span className="ml-2 text-text-mute">
            (o jogo fechou com {fechamento.codigo}
            {fechamento.frase ? ` ${fechamento.frase}` : ""})
          </span>
        ) : null}
      </Note>
    );
  }

  // Ligado, em campo, e o jogo nao manda combate. O caso mais traicoeiro que
  // existe aqui: tudo verde, zero acontecendo.
  //
  // A carencia nao e enfeite: o primeiro frame `field` leva alguns segundos, e
  // sem ela TODA cacada abriria com um aviso vermelho que se desmente sozinho.
  // Alarme que erra no comeco ensina a ignorar o alarme.
  const noAr = estado.desdeMs ? Date.now() - estado.desdeMs : 0;
  if (status === "rodando" && estado.slug && !estado.campoVivo && noAr > 20_000) {
    return (
      <Note tone="warn" className="mt-3">
        A conexão está aberta e o jogo não está mandando combate. Costuma ser líder desmaiado,
        pokémon fraco demais para o nível da hunt, ou a caçada recusada na entrada.
      </Note>
    );
  }

  // Sessão de pé e nenhuma caçada: é um estado LEGÍTIMO, não uma pendência. Dá
  // para vender, repor e usar o chat assim.
  if (status === "rodando" && !estado.slug) {
    return (
      <Note className="mt-3">
        A sessão do jogo é sua. Escolha uma caçada acima, ou use o robô só para vender, repor e
        acompanhar o chat. A sua aba do jogo fica de fora enquanto isto durar.
      </Note>
    );
  }

  if (status === "parado") {
    return (
      <Note className="mt-3">
        Ligar o robô toma a sessão de jogo desta conta: o jogo aceita uma por vez, e a sua aba fica
        de fora até você desligar aqui.
      </Note>
    );
  }

  // Caçando e tudo em ordem: nada a dizer. Um aviso que nunca muda vira moldura,
  // e moldura é o que faz o aviso seguinte passar batido.
  return null;
}

/** A linha de status: bolinha, frase, onde, ha quanto tempo, shard. */
export function LinhaStatus({
  estado,
  agora,
  nomeJogador,
  vinculo,
}: {
  estado: EstadoHunt;
  agora: number;
  nomeJogador: string | null;
  vinculo: "active" | "expired" | "blocked" | null;
}) {
  // A mesma correcao do `Diagnostico`: "parado" ao lado de um aviso vermelho de
  // token vencido seria a tela se contradizendo.
  const status =
    estado.status === "parado" && vinculo && vinculo !== "active"
      ? vinculo === "expired" ? "vencido" : "bloqueado"
      : estado.status;
  const r = ROTULO[status];
  const contando = estado.status === "rodando" || estado.status === "conectando";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      <span className="pix text-[11px]" style={{ color: r.cor }}>
        ● {r.texto}
      </span>
      {estado.slug ? <span className="text-text-mute">em {estado.slug}</span> : null}
      {estado.desdeMs && contando ? (
        <span className="text-text-mute">há {duracao(agora - estado.desdeMs)}</span>
      ) : null}
      {estado.campoVivo ? <span className="text-ok">campo ativo</span> : null}
      {estado.reconectando && estado.proximaTentativaEm ? (
        <span className="text-warn">
          tentando de novo em {Math.max(0, Math.ceil((estado.proximaTentativaEm - agora) / 1000))}s
        </span>
      ) : null}
      {estado.explicacao && estado.status === "conectando" ? (
        <span className="text-text-mute">{estado.explicacao}</span>
      ) : null}
      <span className="ml-auto flex items-center gap-3 text-text-mute">
        {estado.shard ? <span className="tabular">shard {estado.shard}</span> : null}
        {estado.reconexoes > 0 ? (
          <span className="tabular" title="reconexões desde que foi ligado">
            {estado.reconexoes} religadas
          </span>
        ) : null}
        {nomeJogador ? (
          <span className="text-text-dim">
            {nomeJogador}
            {estado.nivelTreinador != null ? (
              <span className="ml-1.5 tabular text-text-mute">nv {estado.nivelTreinador}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </div>
  );
}
