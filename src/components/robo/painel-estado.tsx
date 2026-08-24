"use client";

import Link from "next/link";
import { Button, Note, Panel, Sprite } from "@/components/ui";
import { Pokeball } from "@/components/ui/pokeball";
import { compact } from "@/lib/labels";
import { spriteUrl } from "@/lib/sprites";
import { xpProgress } from "@/lib/xp";
import { BolaChip, ICONE, Medidor, TOM } from "@/components/robo/pecas";
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
  /**
   * `rodando` e A SESSAO de pe, e nao uma cacada.
   *
   * O rotulo dizia "caçando" e sobrou de antes da separacao entre ligar o robo
   * (tomar a sessao) e cacar (um trabalho que roda em cima dela). Depois dela o
   * crachá passou a afirmar uma cacada que podia nao existir — e a propria tela
   * se desmentia tres linhas abaixo, mandando "escolha uma caçada acima".
   *
   * Quem sabe se ha cacada e o `slug`, e nao o status: ver `rotuloDe`.
   */
  rodando: { texto: "ligado", cor: "var(--color-ok)" },
  chutado: { texto: "sessão perdida", cor: "var(--color-warn)" },
  erro: { texto: "erro", cor: "var(--color-danger)" },
  bloqueado: { texto: "conta recusada", cor: "var(--color-danger)" },
  vencido: { texto: "token vencido", cor: "var(--color-danger)" },
};

/**
 * O que o crachá diz, olhando o estado inteiro.
 *
 * O status sozinho nao distingue "a sessao e sua" de "ele esta cacando", porque
 * as duas coisas sao `rodando` — cacar e um trabalho em cima da sessao, e nao um
 * estado dela. Quem separa e o `slug`.
 */
export function rotuloDe(estado: EstadoHunt): { texto: string; cor: string } {
  const base = ROTULO[estado.status];
  if (estado.status !== "rodando") return base;
  if (!estado.slug) return base; // sessao de pe, sem cacada: e legitimo
  // Com hunt escolhida mas sem frame de campo, ainda nao e cacada — e entrada.
  return { ...base, texto: estado.campoVivo ? "caçando" : "entrando" };
}

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

/**
 * A barra do topo: o que o robô está fazendo, agora.
 *
 * Ela fica em TODA aba, então só entra aqui o que vale em todas: o estado da
 * sessão, quem está lutando, e a conta. O seletor de caçada saiu — ele é
 * assunto de uma aba só, e ocupava o topo inteiro para quem estava mexendo em
 * automação ou lendo o chat.
 */
export function BarraTopo({
  estado,
  agora,
  nomeJogador,
  vinculo,
  ocupado,
  comandar,
  onAbrirLider,
}: {
  estado: EstadoHunt;
  agora: number;
  nomeJogador: string | null;
  vinculo: "active" | "expired" | "blocked" | null;
  ocupado: boolean;
  comandar: (rota: string, corpo?: unknown) => Promise<void>;
  onAbrirLider: () => void;
}) {
  // A mesma correção do `Diagnostico`: "parado" ao lado de um aviso vermelho de
  // token vencido seria a tela se contradizendo.
  const status =
    estado.status === "parado" && vinculo && vinculo !== "active"
      ? vinculo === "expired"
        ? "vencido"
        : "bloqueado"
      : estado.status;
  // Com o status JA corrigido: `rotuloDe(estado)` cru voltaria a dizer "parado"
  // ao lado do aviso vermelho de token vencido, que e a contradição que o
  // override acima existe pra impedir.
  const r = rotuloDe({ ...estado, status });
  const contando = estado.status === "rodando" || estado.status === "conectando";
  const lider = estado.time.find((p) => p.leader) ?? estado.time[0] ?? null;
  const xp = lider ? xpProgress(lider.level, lider.xp) : null;

  /**
   * O que está EM USO, e não a bolsa inteira.
   *
   * Antes o topo listava as quatro primeiras bolas com estoque — quem olhava não
   * tinha como saber por que aquelas quatro. O que decide a caçada é a bola que o
   * auto-catch usa e a que ele reserva pro shiny; o resto é assunto da aba Conta.
   */
  const bolaDe = (id: number) => estado.bolas.find((b) => b.id === id) ?? null;
  const ativos = [
    { rotulo: "captura", bola: estado.auto?.autoCatch ? bolaDe(estado.auto.autoCatchBallId) : null },
    {
      rotulo: "shiny",
      bola: estado.auto?.autoCatchShiny ? bolaDe(estado.auto.autoCatchShinyBallId) : null,
    },
  ]
    .filter((x): x is { rotulo: string; bola: NonNullable<ReturnType<typeof bolaDe>> } => !!x.bola)
    .map((x) => ({ rotulo: x.rotulo, ...x.bola }));

  return (
    <Panel className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* ---- quem está lutando ---- */}
        {lider ? (
          <button
            type="button"
            onClick={onAbrirLider}
            className="flex min-w-0 items-center gap-3 border border-line bg-bg-soft px-2.5 py-2 text-left transition-colors hover:border-line-strong"
            title="ver a ficha completa"
          >
            <Sprite src={spriteUrl(lider.speciesId, lider.shiny)} alt="" size={40} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2">
                <b className="truncate text-[14px] text-text">{lider.name}</b>
                <span className="pix text-[10px] text-text-mute">nv {lider.level}</span>
                {lider.shiny ? <span className="pix text-[10px] text-warn">shiny</span> : null}
              </span>
              <span className="flex w-40 flex-col gap-0.5">
                <Medidor
                  valor={lider.hp}
                  max={lider.maxHp}
                  compacto
                  cor={
                    lider.maxHp > 0 && lider.hp / lider.maxHp < 0.3
                      ? "var(--color-danger)"
                      : "var(--color-ok)"
                  }
                />
                {xp?.pct != null ? <Medidor valor={xp.pct} max={1} compacto tom="xp" /> : null}
              </span>
            </span>
          </button>
        ) : null}

        {/* ---- o que está acontecendo ---- */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <b className="pix text-[12px]" style={{ color: r.cor }}>
              ● {r.texto}
            </b>
            {estado.slug ? (
              <span className="text-text-dim">
                em <b className="text-text">{estado.slug}</b>
              </span>
            ) : null}
            {estado.desdeMs && contando ? (
              <span className="text-text-mute">há {duracao(agora - estado.desdeMs)}</span>
            ) : null}
            {estado.campoVivo ? (
              <span className="flex items-center gap-1 text-ok">
                <Pokeball size={12} spinning />
                campo ativo
              </span>
            ) : null}
            {estado.reconectando && estado.proximaTentativaEm ? (
              <span className="text-warn">
                tentando de novo em{" "}
                {Math.max(0, Math.ceil((estado.proximaTentativaEm - agora) / 1000))}s
              </span>
            ) : null}
          </span>

          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-mute">
            {nomeJogador ? (
              <span className="flex items-center gap-1.5">
                <b className="text-text-dim">{nomeJogador}</b>
                {estado.nivelTreinador != null ? (
                  <span className="tabular">nv {estado.nivelTreinador}</span>
                ) : null}
              </span>
            ) : null}
            {estado.perfil ? (
              <>
                <span className="flex items-center gap-1 tabular" style={{ color: TOM.ouro }}>
                  <ICONE.ouro size={13} />
                  {compact(estado.perfil.gold)}
                </span>
                <span className="flex items-center gap-1 tabular" style={{ color: TOM.diamante }}>
                  <ICONE.diamante size={13} />
                  {compact(estado.perfil.diamantes)}
                </span>
              </>
            ) : null}
            {ativos.length ? (
              <span className="flex items-center gap-1.5">
                {ativos.map((a) => (
                  <BolaChip
                    key={a.rotulo}
                    nome={`${a.rotulo}: ${a.nome}`}
                    icone={a.icone}
                    quantidade={a.quantidade}
                    infinita={a.infinita}
                    ativa
                  />
                ))}
              </span>
            ) : null}
          </span>
        </div>

        {/* ---- o interruptor ---- */}
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

      <Diagnostico estado={estado} vinculo={vinculo} />
    </Panel>
  );
}
