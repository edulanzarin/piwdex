import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { GAME_HOST } from "@/lib/robo/jogo/host";
import { pedirAoJogo, recusaDe, renovarTokens, type Recusa, type Tokens } from "@/lib/robo/jogo/auth";
import { normalizarPerfil, normalizarPokes, type ActivePoke } from "@/lib/robo/jogo/pokes";
import { lerBolas } from "@/lib/robo/jogo/auto";
import { lerPokes } from "@/lib/robo/jogo/ws";
import {
  analyzerZerou,
  deltaAnalyzer,
  estadoParado,
  placarZero,
  type Analyzer,
  type BolaEstoque,
  type EstadoAuto,
  type EstadoHunt,
  type Evento,
  type Fechamento,
  type Mensagem,
  type NaFila,
  type PassoRota,
  type Perfil,
  type Placar,
  type StatusSessao,
} from "@/lib/robo/motor/tipos";
import { marcarBloqueado, marcarVencido, salvarShard, salvarTime } from "@/lib/robo/vinculo";
import { salvarStatus } from "@/lib/robo/motor/desejado";
import { CONFIG_PADRAO, type ConfigAuto } from "@/lib/robo/motor/config";
import { rodarCompras, rodarVendaDrops, rodarVendaPokes, type Recado } from "@/lib/robo/motor/jobs";
import { registrarEvento } from "@/lib/robo/motor/eventos";
import { passoDoNivel, planejarRota } from "@/lib/robo/motor/rota";
import { fetchSource } from "@/lib/source";

export * from "@/lib/robo/motor/tipos";

/**
 * A sessao de jogo do robo — uma por usuario, viva em memoria.
 *
 * ## A regra que explica o desenho inteiro
 *
 * O WebSocket **e** a sessao de jogo, e o jogo aceita UMA por conta: a conexao
 * mais nova ganha e a anterior recebe "conta em uso". Ou seja, enquanto o robo
 * segura o socket, a aba do jogo do proprio dono fica de fora. Nao ha arranjo
 * que evite isso — so ha escolher quem ganha, e a escolha (do Eduardo, no v1) e
 * que o robo SEGURA ate o usuario desligar. Quem quer jogar no navegador desliga
 * o robo antes.
 *
 * Por consequencia, tudo que muta a conta durante a cacada sai POR ESTE socket.
 * Abrir um segundo pra "so mandar um comando" derrubaria a propria cacada.
 *
 * A excecao sao as automacoes de loja (comprar, vender): elas sao REST, e REST
 * nao disputa sessao. E o que permite repor bola no meio da hunt sem derrubar
 * nada — ver `motor/jobs.ts`.
 *
 * ## O que ele NAO fazia, e agora faz
 *
 * O motor anterior recebia o `close` do jogo e jogava fora o codigo. 4001
 * (token recusado) e 4003 (shard errado) viravam ambos "sessão perdida, tentando
 * de novo em 3s" — e nos dois casos tentar de novo e exatamente o que nao
 * resolve. O robo reconectava pra sempre, a tela nao dizia por que, e a unica
 * leitura possivel do lado de fora era "nao funciona".
 *
 * Hoje o codigo de fechamento e a informacao mais importante que chega aqui:
 * ele decide entre redescobrir o shard, renovar o token, parar de vez, ou
 * insistir. Ver `aoFechar`.
 *
 * Protocolo em `parked/bot/docs/ws-protocol.md`, cravado por engenharia reversa.
 */

const WS_BASE = GAME_HOST.replace(/^http/, "ws");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Poll do analyzer. E tambem o keepalive da hunt. */
const ANALYZER_MS = 2_000;
/** Poll da lista de pokemon: alimenta o time ao vivo e o HP fora do campo. */
const POKES_MS = 20_000;
/** Varredura das automacoes de loja (o gatilho ao vivo e o principal). */
const JOBS_MS = 60_000;
/** Perfil do treinador (ouro e nivel) — REST, nao disputa a sessao. */
const PERFIL_MS = 45_000;

const RECONEXAO_BASE_MS = 5_000;
const RECONEXAO_MAX_MS = 60_000;

/**
 * Teto pra abrir o socket.
 *
 * Sem ele, uma conexao que nunca completa o handshake deixa o motor em
 * "conectando" pra sempre: nao ha `open`, nao ha `close`, nao ha `error`, e o
 * agendador de reconexao nunca e chamado porque, formalmente, nada falhou. Na
 * tela isso aparece como "conectando há 6s", depois 40s, depois minutos — o
 * estado mais dificil de diagnosticar que este motor produzia.
 */
const ABERTURA_MS = 15_000;

/**
 * Quanto a conexao precisa durar pra o robo considerar que GANHOU a sessao.
 *
 * O numero tem um par escondido, e ignorar isso custou uma noite no v1: se o
 * processo viver menos que esta janela, nenhuma conexao "vence" nunca, cada
 * queda conta como sessao roubada, e o robo se pausa sozinho por um motivo
 * inventado. Foi o que aconteceu quando o container reiniciava a cada ~13s por
 * deploy em cima de deploy — 13 < 25, e o log nao dizia nada.
 */
const CONTESTADA_MS = 25_000;

/** Sem frame `field` por este tempo, a hunt esta ligada e parada. */
const CAMPO_MUDO_MS = 12_000;

/** Anti-flood do `field-revive` — o frame `field` chega ~2x por segundo. */
const REVIVE_COOLDOWN_MS = 15_000;
/** Sem levantar nesse tempo, desiste do Revive e vai pra Joy. */
const REVIVE_GRACA_MS = 8_000;
/** A Joy e de graca, mas se nao pegar nao adianta martelar. */
const CURA_COOLDOWN_MS = 60_000;

/** O frame `balls` dispara no maximo uma compra neste intervalo. */
const COMPRA_GATILHO_MS = 3 * 60_000;

const EVENTOS_MAX = 60;
/** Mensagens de chat guardadas. O ring existe porque o `history` do jogo repete
 *  o backlog inteiro a cada reconexao. */
const CHAT_MAX = 60;
/**
 * Teto da fila no estado que vai pra tela.
 *
 * O jogo reenvia a lista inteira a cada mudanca, e com o auto-catch desligado
 * ela so cresce. O estado vai pro navegador uma vez por segundo enquanto a
 * cacada roda: sem teto, uma fila de trezentos corpos vira trezentos objetos por
 * segundo, por aba aberta, durante horas. A tela mostra quarenta.
 */
const FILA_NO_ESTADO = 60;
/** Anti-flood do chat do JOGO (~1 msg/min). Barrar aqui evita gastar a janela
 *  do servidor com uma mensagem que ele vai recusar. */
const CHAT_COOLDOWN_MS = 60_000;

/**
 * O que cada codigo de fechamento significa, e o que fazer com ele.
 *
 * Os 4xxx sao do JOGO (o WebSocket reserva a faixa pra aplicacao) e foram
 * confirmados contra o servidor: token invalido fecha 4001 "unauthorized",
 * shard errado fecha 4003 "wrong-shard". Os demais sao da propria pilha de
 * rede e significam so "caiu".
 *
 * `acao` e a unica coluna que o motor consulta:
 *   token   renova o par antes de tentar de novo (e desiste se nao adiantar)
 *   shard   o numero cacheado esta errado: redescobre antes de tentar
 *   parar   terminal, nao ha o que tentar
 *   tentar  queda comum, backoff normal
 */
const FECHAMENTOS: Record<number, { acao: "token" | "shard" | "parar" | "tentar"; frase: string }> = {
  4001: { acao: "token", frase: "o jogo recusou o token desta conexão" },
  4002: { acao: "tentar", frase: "o jogo encerrou a conexão" },
  4003: { acao: "shard", frase: "shard errado — a conta foi remanejada" },
  4004: { acao: "parar", frase: "o jogo recusou a conta" },
  1008: { acao: "token", frase: "o jogo recusou a credencial" },
  1011: { acao: "tentar", frase: "erro interno do jogo" },
};

export class SessaoJogo extends EventEmitter {
  private userId: string | null = null;
  private tokens: Tokens | null = null;
  private shard = 0;
  private aoTrocarTokens: ((t: Tokens) => Promise<void>) | null = null;

  private ws: WebSocket | null = null;
  /** Geracao do socket: handler de socket velho nao pode mexer no novo. */
  private geracao = 0;

  private status: StatusSessao = "parado";
  private motivoBloqueio: string | null = null;
  /** O usuario QUER o robo rodando. Sobrevive a queda; so `parar()` desliga. */
  private ligado = false;
  private slug: string | null = null;
  private desdeMs: number | null = null;

  private analyzer: Analyzer | null = null;
  private analyzerBase: Analyzer | null = null;
  private refazerBase = false;

  private eventos: Evento[] = [];
  private fila: NaFila[] = [];
  private time: ActivePoke[] = [];
  private box: ActivePoke[] = [];
  private inventario = new Map<number, number>();
  private bolas: BolaEstoque[] = [];
  private auto: EstadoAuto | null = null;

  private chat: Mensagem[] = [];
  private chatIds = new Set<string>();
  private chatTextos = new Map<string, number>();
  private chatEnviadoEm = 0;
  private meuNome: string | null = null;
  /** envio aguardando o eco do jogo: so o eco confirma que a mensagem entrou */
  private chatPendente: { texto: string; resolver: (r: "ok" | "recusado") => void } | null = null;

  private perfil: Perfil | null = null;
  private ouro: number | null = null;
  private nivelTreinador: number | null = null;
  private nivelLider: number | null = null;

  private rota: PassoRota[] = [];
  private rotaConcluida = false;
  private rotaPlanejadaPara: string | null = null;
  private rotaTrocandoEm = 0;

  private heroHp: number | null = null;
  private heroMaxHp: number | null = null;
  private caidoDesde: number | null = null;
  private reviveEnviadoEm = 0;
  private reviveIds: Set<number> | null = null;
  private reviveVersao: string | null = null;
  private curaEnviadaEm = 0;
  /** Saiu do campo pra curar: alguem tem que voltar pra hunt quando o HP encher. */
  private deveVoltarAoCampo = false;

  // --- diagnostico ---
  private fechamento: Fechamento | null = null;
  private explicacao: string | null = null;
  private ultimoCampoEm = 0;
  private reconexoes = 0;
  /** Quantas vezes seguidas o jogo recusou o token. Dois = o refresh nao resolve. */
  private recusasDeToken = 0;
  /** Quantas vezes seguidas o shard veio errado. Evita varrer os 64 em loop. */
  private shardErrado = 0;

  // --- automacoes ---
  private cfg: ConfigAuto = CONFIG_PADRAO;
  private placar: Placar = placarZero();
  private compraGatilhoEm = 0;
  private jobRodando = false;
  private vendaRodando = false;

  private tAnalyzer: ReturnType<typeof setInterval> | null = null;
  private tPokes: ReturnType<typeof setInterval> | null = null;
  private tJobs: ReturnType<typeof setInterval> | null = null;
  private tPerfil: ReturnType<typeof setInterval> | null = null;
  private tReconexao: ReturnType<typeof setTimeout> | null = null;
  private tentativa = 0;
  private proximaTentativaEm: number | null = null;
  private tSobrevivencia: ReturnType<typeof setTimeout> | null = null;
  private tAbertura: ReturnType<typeof setTimeout> | null = null;

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  estado(): EstadoHunt {
    const campoVivo = !!this.slug && Date.now() - this.ultimoCampoEm < CAMPO_MUDO_MS;
    return {
      status: this.status,
      slug: this.slug,
      desdeMs: this.desdeMs,
      analyzer: this.analyzer,
      eventos: this.eventos,
      fila: this.fila.slice(0, FILA_NO_ESTADO),
      time: this.time,
      heroHp: this.heroHp,
      heroMaxHp: this.heroMaxHp,
      caido: this.caidoDesde != null,
      ligado: this.ligado,
      reconectando: this.tReconexao != null,
      proximaTentativaEm: this.proximaTentativaEm,
      motivoBloqueio: this.motivoBloqueio,

      fechamento: this.fechamento,
      explicacao: this.explicacao ?? this.lerExplicacao(campoVivo),
      conectado: !!this.ws,
      campoVivo,
      reconexoes: this.reconexoes,
      shard: this.shard || null,

      ouro: this.ouro,
      nivelTreinador: this.nivelTreinador,
      nivelLider: this.nivelLider,
      bolas: this.bolas,
      auto: this.auto,
      noBox: this.box.length,

      perfil: this.perfil,
      rota: this.rota,
      passoAtual: this.nivelLider != null ? passoDoNivel(this.rota, this.nivelLider) : null,
      rotaConcluida: this.rotaConcluida,

      chat: this.chat,
      chatLiberadoEm: this.chatEnviadoEm ? this.chatEnviadoEm + CHAT_COOLDOWN_MS : null,

      placar: this.placar,
    };
  }

  /** O box AO VIVO — fora do estado do stream de proposito: pode ter centenas de
   *  bichos, e mandar isso 1x por segundo por SSE seria pagar banda por um dado
   *  que so a modal de time abre. */
  boxAoVivo(): ActivePoke[] {
    return this.ws ? this.box : [];
  }

  ehDe(userId: string | null | undefined): boolean {
    return !!userId && this.userId === userId;
  }

  /**
   * A frase que a tela mostra.
   *
   * Existe porque status sozinho nao explica nada: "rodando" com o campo mudo e
   * um robo travado, e a tela precisa saber a diferenca. A ordem dos testes vai
   * do mais grave pro mais banal.
   */
  private lerExplicacao(campoVivo: boolean): string | null {
    if (this.status === "bloqueado") return this.motivoBloqueio ?? "o jogo recusou esta conta";
    if (this.status === "vencido") return "o token do jogo venceu — reconecte a conta";
    if (this.status === "parado") return null;
    if (this.status === "conectando") return "abrindo a sessão de jogo";
    if (this.status === "chutado" || this.status === "erro") {
      const f = this.fechamento;
      if (f?.codigo && FECHAMENTOS[f.codigo]) return FECHAMENTOS[f.codigo].frase;
      if (f?.codigo) return `o jogo fechou a conexão (código ${f.codigo})`;
      return "a conexão caiu";
    }
    if (!this.slug) return "sessão segurada, sem caçada escolhida";
    if (this.caidoDesde != null) return "o líder desmaiou — levantando";
    if (!campoVivo) return "no campo, mas o jogo não está mandando combate";
    return null;
  }

  // -------------------------------------------------------------------------
  // Comando
  // -------------------------------------------------------------------------

  /**
   * Liga o robo: TOMA a sessao de jogo da conta e segura.
   *
   * Nao pede hunt, e a mudanca importa. Ligar o robo e ganhar a sessao; cacar,
   * vender, comprar e falar no chat sao trabalhos que rodam em cima dela. Quando
   * as duas coisas eram uma so, escolher uma hunt virava pre-requisito pra
   * qualquer outra funcao, e trocar de cacada passava por desligar tudo.
   *
   * Idempotente: chamar com a sessao viva so atualiza credencial e config.
   */
  segurar(
    userId: string,
    tokens: Tokens,
    shard: number,
    aoTrocarTokens: (t: Tokens) => Promise<void>,
    cfg?: ConfigAuto,
    nomeJogador?: string | null,
  ) {
    this.userId = userId;
    this.tokens = tokens;
    this.shard = shard;
    this.aoTrocarTokens = aoTrocarTokens;
    this.ligado = true;
    this.motivoBloqueio = null;
    this.recusasDeToken = 0;
    this.shardErrado = 0;
    if (cfg) this.cfg = cfg;
    if (nomeJogador) this.meuNome = nomeJogador;

    if (!this.ws) {
      this.conectar();
      return;
    }
    this.emitir();
  }

  /**
   * Entra numa cacada com a sessao que ja esta de pe.
   *
   * Trocar de hunt nao derruba a conexao: sai do campo antigo, zera a contagem e
   * entra no novo. `false` quer dizer que nao ha sessao — quem chama liga primeiro.
   */
  cacar(slug: string, porRota = false): boolean {
    if (!this.ws) return false;
    const trocou = this.slug !== slug;
    if (this.slug && trocou) this.enviar({ type: "leave-hunt" });
    this.slug = slug;
    if (trocou) {
      // Cacada nova zera a contagem do ANALYZER: ele e por cacada.
      this.refazerBase = true;
      this.analyzer = null;
      this.desdeMs = Date.now();
      this.ultimoCampoEm = 0;
      // O feed e o placar das automacoes NAO zeram numa troca de rota: a rota
      // troca de alvo varias vezes numa subida, e zerar a cada faixa apagaria o
      // registro da sessao inteira algumas vezes por hora.
      if (!porRota) {
        this.eventos = [];
        this.placar = placarZero();
      }
    }
    this.entrarNoCampo(slug);
    this.rearmarTimers();
    void this.gravarStatus();
    this.emitir();
    return true;
  }

  /**
   * Sai do campo e mantem a sessao.
   *
   * `leave-hunt` e obrigatorio: sem ele o personagem segue cacando no servidor, e
   * o campo so morre quando a conexao inteira cai.
   */
  pararCacada(): boolean {
    if (!this.ws) return false;
    if (this.slug) this.enviar({ type: "leave-hunt" });
    this.slug = null;
    this.analyzer = null;
    this.analyzerBase = null;
    this.refazerBase = false;
    this.fila = [];
    this.ultimoCampoEm = 0;
    this.deveVoltarAoCampo = false;
    this.rearmarTimers();
    this.emitir();
    return true;
  }

  /**
   * Retoma o que estava desejado (usado pelo boot). Nao mexe em quem ja roda.
   *
   * Segura a sessao mesmo SEM hunt: o desejo gravado e "quero o robo ligado", e
   * exigir uma cacada pra retomar deixaria de fora quem usa o robo pra vender,
   * repor ou acompanhar o chat.
   */
  retomar(
    userId: string,
    tokens: Tokens,
    shard: number,
    slug: string | null,
    aoTrocarTokens: (t: Tokens) => Promise<void>,
    cfg?: ConfigAuto,
    nomeJogador?: string | null,
  ) {
    if (this.ws) return;
    this.slug = slug;
    this.segurar(userId, tokens, shard, aoTrocarTokens, cfg, nomeJogador);
  }

  /** A config mudou na tela: o motor passa a decidir por ela na proxima varredura. */
  usarConfig(cfg: ConfigAuto) {
    this.cfg = cfg;
    this.emitir();
  }

  /**
   * Desliga: sai do campo, larga a sessao e para de reconectar.
   *
   * `leave-hunt` ANTES de fechar o socket, e nao so fechar: sem esse frame o
   * personagem continua cacando no servidor, e o campo so morria quando a
   * conexao caia sozinha.
   */
  parar() {
    this.ligado = false;
    this.cancelarReconexao();
    if (this.ws && this.slug) this.enviar({ type: "leave-hunt" });
    this.slug = null;
    this.desmontar();
    void this.gravarStatus();
  }

  /** Cura o time pela Joy, a pedido do usuario. So funciona FORA do campo. */
  curarAgora(): boolean {
    if (!this.ws) return false;
    this.irParaJoy();
    return true;
  }

  /** Troca o lider pelo socket que ja esta aberto — abrir um segundo derrubaria
   *  a propria cacada. */
  trocarLider(pokeId: string): boolean {
    if (!this.ws) return false;
    this.enviar({ type: "poke-summon", pokeId });
    setTimeout(() => this.enviar({ type: "pokes-get" }), 500);
    return true;
  }

  /** Move um poke entre BOX e TIME pela sessao viva. */
  moverPoke(pokeId: string, dir: "store" | "withdraw"): boolean {
    if (!this.ws) return false;
    this.enviar({ type: dir === "store" ? "poke-store" : "poke-withdraw", pokeId });
    setTimeout(() => this.enviar({ type: "pokes-get" }), 500);
    return true;
  }

  /**
   * Manda uma mensagem no chat e espera o VEREDITO.
   *
   * O jogo nao responde ack: ele ECOA a mensagem aceita como um frame `chat`
   * normal, com o seu nome. Recusada (conteudo barrado), volta um frame de
   * sistema sem remetente. Por isso o veredito vem do proximo frame e nao do
   * envio — e por isso so envio CONFIRMADO arma o cooldown: recusa nao gasta a
   * janela, o texto se corrige e vai de novo na hora.
   */
  async mandarChat(
    texto: string,
    canal: string,
  ): Promise<{ ok: boolean; motivo?: "sem_sessao" | "vazio" | "ocupado" | "espera" | "recusado" | "sem_eco"; esperaMs?: number }> {
    if (!this.ws || this.status !== "rodando") return { ok: false, motivo: "sem_sessao" };
    const t = texto.trim();
    if (!t) return { ok: false, motivo: "vazio" };
    if (this.chatPendente) return { ok: false, motivo: "ocupado" };
    const desde = this.chatEnviadoEm ? Date.now() - this.chatEnviadoEm : Infinity;
    if (desde < CHAT_COOLDOWN_MS) {
      return { ok: false, motivo: "espera", esperaMs: CHAT_COOLDOWN_MS - desde };
    }

    this.enviar({ type: "send", channel: canal, body: t });
    const veredito = await new Promise<"ok" | "recusado" | "silencio">((resolve) => {
      const prazo = setTimeout(() => {
        this.chatPendente = null;
        resolve("silencio");
      }, 6_000);
      this.chatPendente = {
        texto: t,
        resolver: (r) => {
          clearTimeout(prazo);
          this.chatPendente = null;
          resolve(r);
        },
      };
    });

    if (veredito === "ok") {
      this.chatEnviadoEm = Date.now();
      this.emitir();
      return { ok: true };
    }
    return { ok: false, motivo: veredito === "recusado" ? "recusado" : "sem_eco" };
  }

  /** Roda as automacoes AGORA, a pedido da tela. */
  async rodarJobsAgora(): Promise<void> {
    await this.rodarJobs(true);
  }

  // -------------------------------------------------------------------------
  // Conexao
  // -------------------------------------------------------------------------

  private conectar() {
    if (!this.tokens) return;
    this.definirStatus("conectando");
    this.desdeMs = Date.now();
    // Conexao nova = analyzer do jogo zerado. Sem base, o frame JA e so desta hunt.
    this.analyzerBase = null;
    this.refazerBase = false;

    const url =
      `${WS_BASE}/ws${this.shard}?token=${encodeURIComponent(this.tokens.access)}` +
      `&cmid=${crypto.randomBytes(16).toString("hex")}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url, {
        headers: { Origin: GAME_HOST, "User-Agent": UA },
      } as unknown as string[]);
    } catch (e) {
      this.definirStatus("erro", String(e));
      if (this.ligado) this.agendarReconexao();
      return;
    }

    this.ws = ws;
    const minhaGeracao = ++this.geracao;

    // O teto de abertura: sem `open` ate aqui, a tentativa morre e o backoff
    // corre. Um socket que nunca abre nao emite `close` nem `error`.
    if (this.tAbertura) clearTimeout(this.tAbertura);
    this.tAbertura = setTimeout(() => {
      this.tAbertura = null;
      if (minhaGeracao !== this.geracao || this.status !== "conectando") return;
      this.registrarFechamento(null, "o jogo não respondeu ao pedido de conexão");
      try { ws.close(); } catch { /* nem chegou a abrir */ }
      this.ws = null;
      this.definirStatus("erro", "sem resposta");
      if (this.ligado) this.agendarReconexao();
    }, ABERTURA_MS);

    ws.addEventListener("open", () => {
      if (minhaGeracao !== this.geracao) return;
      if (this.tAbertura) { clearTimeout(this.tAbertura); this.tAbertura = null; }
      this.tentativa = 0;
      this.proximaTentativaEm = null;
      // Abriu: o shard esta certo e o token foi aceito. Zera os dois contadores
      // que decidem desistir — senao um episodio ruim de ontem condena a sessao
      // de hoje.
      this.shardErrado = 0;
      this.recusasDeToken = 0;
      // Arma a janela de sobrevivencia: durar CONTESTADA_MS significa que o robo
      // ganhou a sessao de verdade.
      if (this.tSobrevivencia) clearTimeout(this.tSobrevivencia);
      this.tSobrevivencia = setTimeout(() => { this.tSobrevivencia = null; }, CONTESTADA_MS);
      this.definirStatus("rodando");
      if (this.slug) this.entrarNoCampo(this.slug);
      this.rearmarTimers();
      void this.lerPerfil();
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (minhaGeracao === this.geracao) this.aoReceber(ev);
    });
    ws.addEventListener("close", (ev: unknown) => {
      if (minhaGeracao !== this.geracao) return;
      const e = ev as { code?: number; reason?: string } | undefined;
      this.aoFechar(e?.code ?? null, e?.reason ?? null);
    });
    ws.addEventListener("error", () => {
      if (minhaGeracao === this.geracao) this.aoFechar(null, "erro de rede");
    });
  }

  private enviar(obj: unknown) {
    try { this.ws?.send(JSON.stringify(obj)); } catch { /* socket ja foi */ }
  }

  /**
   * Entra no campo como o cliente do jogo faz: `enter-hunt` e o `pending-get`
   * logo atras.
   *
   * O segundo nao e enfeite — o jogo so REENVIA a fila de captura quando ela
   * muda, entao sem o pedido inicial a fila apareceria vazia ate o primeiro kill.
   *
   * E sem isto NADA acontece: uma conexao que nao entra no campo recebe so o
   * snapshot, e o analyzer fica zerado pra sempre.
   */
  private entrarNoCampo(slug: string) {
    // Com o lider caido o jogo RECUSA a entrada. Entrar em cima do corpo era a
    // hunt "ligada" que nao matava nada. Levanta primeiro; a volta e automatica.
    if (this.liderCaido()) {
      this.deveVoltarAoCampo = true; // divida registrada ANTES de tentar levantar
      void this.levantarLider();
      return;
    }
    this.enviar({ type: "enter-hunt", slug });
    this.enviar({ type: "pending-get" });
    this.enviar({ type: "balls-get" });
    this.enviar({ type: "inv-get" });
    this.enviar({ type: "autohelper-get" });
    this.deveVoltarAoCampo = false;
  }

  private liderCaido(): boolean {
    if (this.caidoDesde != null) return true;
    const lider = this.time.find((p) => p.leader) ?? this.time[0];
    return !!lider && lider.maxHp > 0 && lider.hp <= 0;
  }

  private rearmarTimers() {
    this.limparTimers();
    if (this.slug) {
      this.enviar({ type: "analyzer-get" });
      this.tAnalyzer = setInterval(() => this.enviar({ type: "analyzer-get" }), ANALYZER_MS);
    }
    setTimeout(() => this.enviar({ type: "pokes-get" }), 500);
    this.tPokes = setInterval(() => this.enviar({ type: "pokes-get" }), POKES_MS);
    this.tJobs = setInterval(() => void this.rodarJobs(), JOBS_MS);
    this.tPerfil = setInterval(() => void this.lerPerfil(), PERFIL_MS);
  }

  private limparTimers() {
    if (this.tAnalyzer) { clearInterval(this.tAnalyzer); this.tAnalyzer = null; }
    if (this.tPokes) { clearInterval(this.tPokes); this.tPokes = null; }
    if (this.tJobs) { clearInterval(this.tJobs); this.tJobs = null; }
    if (this.tPerfil) { clearInterval(this.tPerfil); this.tPerfil = null; }
  }

  // -------------------------------------------------------------------------
  // Frames
  // -------------------------------------------------------------------------

  private aoReceber(ev: MessageEvent) {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
    } catch {
      return;
    }

    switch (m.type) {
      case "analyzer": {
        const bruto = m as unknown as Analyzer;
        if (this.refazerBase) {
          this.analyzerBase = bruto;
          this.refazerBase = false;
        } else if (this.analyzerBase && analyzerZerou(bruto, this.analyzerBase)) {
          this.analyzerBase = null; // o jogo reiniciou a contagem: larga a base
        }
        this.analyzer = deltaAnalyzer(bruto, this.analyzerBase);
        this.emitir();
        break;
      }

      case "field-kill": {
        // Hunt desligada: ignora. O personagem ainda pode estar saindo do campo.
        if (!this.slug) break;
        const loot = Array.isArray(m.loot)
          ? (m.loot as Record<string, unknown>[]).map((l) => ({
              itemId: Number(l.itemId ?? 0),
              name: String(l.name ?? ""),
              qty: Number(l.qty ?? 0),
            }))
          : [];
        if (Number.isFinite(Number(m.level))) {
          const antes = this.nivelLider;
          this.nivelLider = Number(m.level);
          // Subiu de nivel: e o unico instante em que a rota pode precisar trocar.
          // Testar aqui evita esperar os 20s do proximo `pokes`.
          if (m.leveledUp || (antes != null && this.nivelLider > antes)) void this.cuidarDaRota();
        }
        this.registrar({
          em: Date.now(), tipo: "kill", especie: String(m.speciesName ?? "?"),
          shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot,
        });
        break;
      }

      case "field":
        this.ultimoCampoEm = Date.now();
        this.acompanharCampo(m);
        break;

      case "field-init":
        this.ultimoCampoEm = Date.now();
        this.emitir();
        break;

      case "poke-xp":
        if (Number.isFinite(Number(m.level))) {
          this.nivelLider = Number(m.level);
          this.emitir();
        }
        break;

      case "catch-result":
        if (m.success && this.slug) {
          const especie = String(m.speciesName ?? "?");
          const shiny = Boolean(m.shiny);
          this.registrar({
            em: Date.now(), tipo: "captura", especie,
            shiny, xp: 0, loot: [], bola: String(m.ballName ?? ""),
          });
          if (shiny && this.userId) {
            void registrarEvento(this.userId, {
              tipo: "shiny",
              titulo: `Shiny ${especie} capturado`,
              corpo: String(m.ballName ?? "") || null,
              dado: { especie, bola: m.ballName ?? null, slug: this.slug },
            });
          }
        }
        break;

      case "pending":
        if (Array.isArray(m.list)) {
          this.fila = (m.list as Record<string, unknown>[]).map((p) => ({
            id: Number(p.id ?? 0),
            speciesId: Number(p.pokeId ?? 0), // no frame, `pokeId` e a ESPECIE
            nome: String(p.name ?? "?"),
            level: Number(p.level ?? 0),
            shiny: Boolean(p.shiny),
            em: Number(p.at ?? Date.now()),
          }));
          this.emitir();
        }
        break;

      case "pokes":
        if (Array.isArray(m.list)) {
          const todos = normalizarPokes(m.list);
          this.time = todos.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
          this.box = todos.filter((p) => !p.team);
          const lider = this.time.find((p) => p.leader) ?? this.time[0];
          // Fora do campo, o frame `pokes` e a UNICA fonte de vida: `field` so
          // existe em hunt e `/api/characters/me` nao traz HP.
          if (lider && !this.slug) {
            this.heroHp = lider.hp;
            this.heroMaxHp = lider.maxHp;
          }
          if (lider) this.nivelLider = lider.level;
          if (lider && lider.maxHp > 0 && lider.hp <= 0) void this.levantarLider(lider.name);
          else this.liderDePe();
          if (this.userId) {
            void salvarTime(this.userId, this.time, todos.length).catch(() => {});
          }
          this.emitir();
          // A venda de pokemon le a lista que ACABOU de chegar: vender assim que
          // coleta e o que impede o box de encher entre uma varredura e outra.
          if (this.cfg.venderPoke) void this.rodarVendaPokes();
          // A rota tambem: o nivel do lider so muda aqui e no `field-kill`.
          void this.cuidarDaRota();
        }
        break;

      case "inventory": {
        const itens = Array.isArray(m.items) ? (m.items as Record<string, unknown>[]) : [];
        this.inventario.clear();
        for (const it of itens) {
          this.inventario.set(Number(it.itemId ?? 0), Number(it.quantity ?? it.qty ?? 0));
        }
        break;
      }

      case "balls":
        this.bolas = lerBolas(m);
        if (Number.isFinite(Number(m.gold))) this.ouro = Number(m.gold);
        this.emitir();
        // O estoque ao vivo e o melhor gatilho de compra que existe: uma hunt boa
        // queima centenas de bolas por hora, e uma varredura de minuto em minuto
        // deixaria a fila de captura travada em zero no meio do caminho.
        this.talvezComprar();
        break;

      case "autohelper":
        this.auto = {
          autoCatch: Boolean(m.autoCatch),
          autoCatchBallId: Number(m.autoCatchBallId ?? 0),
          autoCatchShiny: Boolean(m.autoCatchShiny),
          autoCatchShinyBallId: Number(m.autoCatchShinyBallId ?? 0),
          autoPotion: Boolean(m.autoPotion),
          autoPotionThreshold: Number(m.autoPotionThreshold ?? 0),
          autoRevive: Boolean(m.autoRevive),
          selectedBallId: Number(m.selectedBallId ?? 0),
          vipNoJogo: Boolean(m.isVip),
        };
        if (Array.isArray(m.balls)) this.bolas = lerBolas(m.balls);
        this.emitir();
        break;

      case "chat":
      case "history":
        this.pegarChat(m);
        break;

      case "joy-healed":
        // O ack nao prova nada: quem confirma e o HP na proxima lista.
        this.enviar({ type: "pokes-get" });
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------------

  private static texto(o: Record<string, unknown>, chaves: string[]): string | null {
    for (const k of chaves) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  }

  /**
   * Uma mensagem, de qualquer formato que o jogo use.
   *
   * O parser aceita varios nomes de campo porque o formato de chat nao esta
   * documentado em lugar nenhum: foi lido de captura. Tolerar aqui custa uma
   * lista de sinonimos; nao tolerar custa o chat inteiro sumir quando eles
   * renomearem um campo.
   */
  private lerMensagem(o: Record<string, unknown>, canalPadrao?: string): Mensagem | null {
    const texto = SessaoJogo.texto(o, ["body", "text", "message", "content"]);
    if (!texto) return null;
    const de =
      SessaoJogo.texto(o, [
        "fromName", "from", "name", "player", "author", "sender", "playerName", "user", "username",
      ]) ?? "?";
    const canal = SessaoJogo.texto(o, ["channel", "chan", "room"]) ?? canalPadrao ?? "world";
    const bruto = o.at ?? o.ts ?? o.time ?? o.createdAt ?? o.timestamp ?? o.date;
    let em = Date.now();
    if (typeof bruto === "number" && Number.isFinite(bruto)) em = bruto < 1e12 ? bruto * 1000 : bruto;
    else if (typeof bruto === "string") {
      const parseado = Date.parse(bruto);
      if (Number.isFinite(parseado)) em = parseado;
    }
    return {
      em, de, texto, canal,
      id: SessaoJogo.texto(o, ["id"]) ?? undefined,
      level: typeof o.level === "number" && Number.isFinite(o.level) ? o.level : undefined,
      vip: o.isVip === true || undefined,
      admin: o.isAdmin === true || undefined,
      minha: !!this.meuNome && de.toLowerCase() === this.meuNome.toLowerCase(),
    };
  }

  /** Guarda no ring. Dois dedupes, e os dois sao necessarios: o `history` repete o
   *  backlog inteiro a cada reconexao (id), e a mensagem propria pode voltar do
   *  servidor com id novo (conteudo, numa janela curta). */
  private guardarMensagem(msg: Mensagem): boolean {
    this.conferirPendente(msg);
    if (msg.id) {
      if (this.chatIds.has(msg.id)) return false;
      this.chatIds.add(msg.id);
      if (this.chatIds.size > CHAT_MAX * 3) this.chatIds.clear();
    }
    const chave = `${msg.de}|${msg.texto}`;
    const antes = this.chatTextos.get(chave);
    if (antes != null && Math.abs(msg.em - antes) < 60_000) return false;
    this.chatTextos.set(chave, msg.em);
    if (this.chatTextos.size > CHAT_MAX * 3) this.chatTextos.clear();

    this.chat.push(msg);
    this.chat.sort((a, b) => a.em - b.em);
    if (this.chat.length > CHAT_MAX) this.chat.splice(0, this.chat.length - CHAT_MAX);
    return true;
  }

  /** O eco com o SEU nome e o mesmo texto confirma o envio. Frame de sistema (sem
   *  remetente) enquanto ha envio pendente e recusa. */
  private conferirPendente(msg: Mensagem) {
    const p = this.chatPendente;
    if (!p) return;
    if (this.meuNome && msg.de.toLowerCase() === this.meuNome.toLowerCase() && msg.texto === p.texto) {
      p.resolver("ok");
    } else if (msg.de === "?") {
      p.resolver("recusado");
    }
  }

  /** `chat` traz uma mensagem em `msg`; `history` traz um array POR CANAL, e a
   *  chave do array (world/trade/help) e o canal dos itens. */
  private pegarChat(m: Record<string, unknown>) {
    let pegou = false;
    if (m.msg && typeof m.msg === "object" && !Array.isArray(m.msg)) {
      const p = this.lerMensagem(m.msg as Record<string, unknown>);
      if (p && this.guardarMensagem(p)) pegou = true;
    }
    for (const [chave, valor] of Object.entries(m)) {
      if (!Array.isArray(valor)) continue;
      for (const o of valor as Record<string, unknown>[]) {
        if (!o || typeof o !== "object") continue;
        const p = this.lerMensagem(o, chave);
        if (p && this.guardarMensagem(p)) pegou = true;
      }
    }
    if (!pegou) {
      const p = this.lerMensagem(m);
      if (p && this.guardarMensagem(p)) pegou = true;
    }
    if (pegou) this.emitir();
  }

  private registrar(e: Evento) {
    this.eventos.unshift(e);
    if (this.eventos.length > EVENTOS_MAX) this.eventos.length = EVENTOS_MAX;
    this.emitir();
  }

  // -------------------------------------------------------------------------
  // Desmaio do lider
  // -------------------------------------------------------------------------

  private acompanharCampo(m: Record<string, unknown>) {
    const hp = Number(m.heroHp);
    const maxHp = Number(m.heroMaxHp);
    if (Number.isFinite(maxHp) && maxHp > 0) this.heroMaxHp = maxHp;
    if (Number.isFinite(hp)) this.heroHp = Math.max(0, hp);

    // `fainted` e a palavra do servidor. `hp <= 0` so vale se o HP veio NESTE
    // frame: frame parcial nao pode "matar" o lider por leitura velha.
    const caido =
      Boolean(m.fainted) ||
      (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp <= 0);

    if (!caido) {
      this.liderDePe();
      return;
    }
    void this.levantarLider(typeof m.heroName === "string" ? m.heroName : undefined);
  }

  /**
   * O lider caiu.
   *
   * O jogo nao deixa cacar assim, nem entrar em outra hunt ("Cure-o com a Nurse
   * Joy ou use um Revive antes de ir cacar"). E a Joy NAO levanta ninguem com o
   * personagem em campo — foi exatamente isso que fez o robo do v1 "curar" em
   * loop com o pokemon caido no chao. A ordem, entao:
   *
   *   1. `field-revive`: gasta um Revive da bolsa e levanta sem sair da hunt;
   *   2. sem Revive (ou ele nao pegou a tempo): `leave-hunt` + `joy-heal`, que e
   *      de graca e so funciona fora do campo;
   *   3. HP de volta -> a hunt e retomada sozinha.
   */
  private async levantarLider(_nome?: string) {
    const agora = Date.now();
    if (this.caidoDesde == null) {
      this.caidoDesde = agora;
      this.emitir();
    }
    if (!this.ws) return;

    // 1) Revive da bolsa. So faz sentido EM campo — `deveVoltarAoCampo` significa
    //    que ja saimos dele.
    if (this.slug && !this.deveVoltarAoCampo && agora - this.reviveEnviadoEm >= REVIVE_COOLDOWN_MS && this.temRevive()) {
      this.reviveEnviadoEm = agora;
      this.enviar({ type: "field-revive" });
      return; // quem confirma e o proximo `field` com fainted:false, nao o ack
    }

    // 2) Joy, de graca, fora do campo.
    if (agora - this.caidoDesde >= REVIVE_GRACA_MS && agora - this.curaEnviadaEm >= CURA_COOLDOWN_MS) {
      this.irParaJoy();
    }
  }

  /** Sai do campo (pre-condicao da Joy) e cura. Guarda a divida de voltar. */
  private irParaJoy() {
    if (!this.ws) return;
    if (this.slug && !this.deveVoltarAoCampo) this.enviar({ type: "leave-hunt" });
    if (this.slug) this.deveVoltarAoCampo = true;
    this.curaEnviadaEm = Date.now();
    this.enviar({ type: "joy-heal" });
    this.registrar({
      em: Date.now(), tipo: "cura", especie: "time", shiny: false, xp: 0, loot: [],
    });
    this.emitir();
  }

  /** De pe: fecha o episodio e paga a divida — de volta pra mesma hunt. */
  private liderDePe() {
    if (this.caidoDesde == null && !this.deveVoltarAoCampo) return;
    this.caidoDesde = null;
    if (this.deveVoltarAoCampo && this.slug && this.ws) {
      this.deveVoltarAoCampo = false;
      this.enviar({ type: "enter-hunt", slug: this.slug });
      this.enviar({ type: "pending-get" });
      this.rearmarTimers();
    }
    this.emitir();
  }

  /**
   * Ha Revive na bolsa?
   *
   * Os ids saem do catalogo publico do jogo (categoria `revive`), que a camada
   * da dex ja carrega e mantem fresco por ETag. Nao da pra fixar os dois ids que
   * existem hoje: item novo entra em patch, e esta sessao vive o processo
   * inteiro — por isso o conjunto carrega a VERSAO do catalogo que o produziu e
   * se refaz quando ela muda.
   *
   * Na duvida responde SIM. Mandar o frame e barato; errar pro outro lado manda
   * o robo pra Joy — perdendo alguns segundos de hunt — com um Revive no bolso.
   */
  private temRevive(): boolean {
    // Fora do caminho: a resposta desta chamada usa o conjunto que a chamada
    // ANTERIOR carregou. Esperar o catalogo aqui atrasaria a resposta a um
    // pokemon caido por causa de um `fetch`.
    void fetchSource()
      .then((d) => {
        if (this.reviveVersao === d.version) return;
        this.reviveIds = new Set(d.items.filter((i) => i.category === "revive").map((i) => i.id));
        this.reviveVersao = d.version;
      })
      .catch(() => { /* segue com o conjunto anterior */ });

    if (!this.reviveIds) return true; // ainda nao sei quais sao
    if (!this.inventario.size) return true; // inventario ainda nao chegou nesta conexao
    for (const [id, qtd] of this.inventario) if (qtd > 0 && this.reviveIds.has(id)) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  // A cacada automatica
  // -------------------------------------------------------------------------

  /**
   * Planeja a subida do lider ate o nivel alvo, e troca de hunt sozinho.
   *
   * O calculo e o MESMO da ferramenta publica de rota (`motor/rota.ts` chama
   * `buildRoute`): dano, ameaca e XP por hora nivel a nivel. O robo nao ganha uma
   * segunda opiniao sobre onde cacar — ele ganha as pernas pra executar a que ja
   * existe.
   *
   * Replaneja quando o LIDER muda, e nao a cada nivel: a rota ja e calculada
   * nivel a nivel ate o alvo, entao refazer a cada subida so gastaria CPU pra
   * chegar no mesmo plano.
   */
  private async cuidarDaRota(): Promise<void> {
    if (!this.cfg.autoRota || !this.ws) return;
    const lider = this.time.find((p) => p.leader) ?? this.time[0];
    if (!lider) return;

    const assinatura = `${lider.id}|${this.cfg.nivelAlvo}`;
    if (this.rotaPlanejadaPara !== assinatura) {
      this.rotaPlanejadaPara = assinatura;
      this.rota = [];
      this.rotaConcluida = false;
      const plano = await planejarRota(lider, this.cfg.nivelAlvo, { vip: this.perfil?.vip });
      if (this.rotaPlanejadaPara !== assinatura) return; // o lider trocou no meio
      if (!plano) {
        // Sem plano: ou o lider ja passou do alvo, ou a especie nao tem alvo
        // alcancavel. Os dois casos param a rota — insistir so trocaria de hunt
        // a esmo.
        this.rotaConcluida = lider.level >= this.cfg.nivelAlvo;
        this.emitir();
        return;
      }
      this.rota = plano.passos;
      this.emitir();
    }

    if (lider.level >= this.cfg.nivelAlvo) {
      if (!this.rotaConcluida) {
        this.rotaConcluida = true;
        this.registrar({
          em: Date.now(), tipo: "aviso", especie: `${lider.name} chegou ao nível ${lider.level}`,
          shiny: false, xp: 0, loot: [],
        });
        if (this.userId) {
          void registrarEvento(this.userId, {
            tipo: "meta",
            titulo: `${lider.name} chegou ao nível ${this.cfg.nivelAlvo}`,
            corpo: "A caçada automática terminou. O robô segue segurando a sessão.",
          });
        }
        // Chegou na meta: sai do campo e NAO escolhe outra hunt. Continuar cacando
        // depois do alvo seria o robo decidindo por conta o que fazer com o tempo
        // do dono.
        this.pararCacada();
      }
      return;
    }

    const passo = passoDoNivel(this.rota, lider.level);
    if (!passo || passo.slug === this.slug) return;
    // Anti-oscilacao: o `pokes` chega a cada 20s e o nivel pode empatar na
    // fronteira de duas faixas. Uma troca por minuto e teto de sobra pra uma rota
    // que muda de alvo a cada varios niveis.
    const agora = Date.now();
    if (agora - this.rotaTrocandoEm < 60_000) return;
    this.rotaTrocandoEm = agora;

    this.registrar({
      em: Date.now(), tipo: "aviso",
      especie: `rota: nível ${lider.level}, agora em ${passo.alvo}`,
      shiny: false, xp: 0, loot: [],
    });
    this.cacar(passo.slug, true);
  }

  // -------------------------------------------------------------------------
  // As automacoes de loja (REST — nao disputam a sessao)
  // -------------------------------------------------------------------------

  /**
   * O perfil do treinador: ouro e nivel.
   *
   * Vem por REST porque o WebSocket so manda ouro de raspao (no frame `balls`),
   * e o painel precisa do numero mesmo com a hunt parada. Como e REST, ler nao
   * custa a sessao de ninguem.
   */
  private async lerPerfil(): Promise<void> {
    if (!this.tokens) return;
    try {
      const r = await pedirAoJogo("/api/characters/me", this.tokens);
      if (r.mudou) {
        this.tokens = r.tokens;
        await this.aoTrocarTokens?.(r.tokens);
      }
      if (!r.res.ok) return;
      const perfil = normalizarPerfil(await r.res.json().catch(() => null));
      if (!perfil) return;
      this.perfil = perfil;
      this.ouro = perfil.gold;
      this.nivelTreinador = perfil.level;
      if (!this.meuNome) this.meuNome = perfil.nome;
      this.emitir();
    } catch {
      /* leitura de enfeite: nunca derruba a cacada */
    }
  }

  /** O frame `balls` chegou com o estoque baixo. Compra, com anti-flood. */
  private talvezComprar() {
    if (!this.cfg.comprarBola) return;
    const agora = Date.now();
    if (agora - this.compraGatilhoEm < COMPRA_GATILHO_MS) return;
    const estoque = this.bolas.reduce((s, b) => (b.infinita ? s : s + b.quantidade), 0);
    if (estoque > this.cfg.pisoBola) return;
    this.compraGatilhoEm = agora;
    void this.rodarJobs();
  }

  /**
   * Uma rodada de automacao.
   *
   * A trava de concorrencia nao e higiene: o gatilho ao vivo (frame `balls`) e a
   * varredura periodica podem coincidir, e duas rodadas em paralelo comprariam
   * duas vezes a mesma reposicao — cada uma lendo o estoque de ANTES da outra.
   */
  private async rodarJobs(forcado = false): Promise<void> {
    if (this.jobRodando || !this.tokens || !this.userId) return;
    if (!forcado && !this.ligado) return;
    this.jobRodando = true;
    try {
      const recados: Recado[] = [];
      const trocar = async (t: Tokens) => {
        this.tokens = t;
        await this.aoTrocarTokens?.(t);
      };

      if (this.cfg.comprarBola || this.cfg.comprarPocao || this.cfg.comprarRevive) {
        recados.push(...(await rodarCompras(this.tokens, this.cfg, this.bolas, this.inventario, trocar)));
      }
      if (this.cfg.venderDrop) {
        recados.push(...(await rodarVendaDrops(this.tokens, this.cfg, trocar)));
      }
      this.aplicarRecados(recados);
    } catch (e) {
      console.error("[robo] automação falhou:", e);
    } finally {
      this.jobRodando = false;
    }
  }

  private async rodarVendaPokes(): Promise<void> {
    if (!this.tokens || !this.userId || !this.cfg.venderPoke) return;
    // A trava importa mais aqui que nas compras: um comando qualquer pede
    // `pokes-get` de confirmacao, e esse frame chega a meio segundo do poll. Sem
    // ela, as duas rodadas leem o MESMO box e mandam vender os mesmos ids.
    if (this.vendaRodando) return;
    this.vendaRodando = true;
    const trocar = async (t: Tokens) => {
      this.tokens = t;
      await this.aoTrocarTokens?.(t);
    };
    try {
      const recados = await rodarVendaPokes(this.tokens, this.cfg, this.box, trocar);
      this.aplicarRecados(recados);
      if (recados.some((r) => r.ok)) this.enviar({ type: "pokes-get" });
    } catch (e) {
      console.error("[robo] venda de pokemon falhou:", e);
    } finally {
      this.vendaRodando = false;
    }
  }

  /** Uma automacao terminou: soma no placar, conta pra tela, grava o que merece
   *  sobreviver ao processo. */
  private aplicarRecados(recados: Recado[]) {
    if (!recados.length) return;
    for (const r of recados) {
      if (r.ok) {
        if (r.tipo === "compra") {
          this.placar.ouroCompras += r.ouro;
          this.placar.bolasCompradas += r.bolas ?? 0;
          this.placar.pocoesCompradas += r.pocoes ?? 0;
          this.placar.revivesComprados += r.revives ?? 0;
        } else if (r.tipo === "venda-item") {
          this.placar.itensVendidos += r.quantidade ?? 0;
          this.placar.ouroVendas += r.ouro;
        } else if (r.tipo === "venda-poke") {
          this.placar.pokesVendidos += r.quantidade ?? 0;
          this.placar.ouroPokes += r.ouro;
        }
      }
      this.registrar({
        em: Date.now(),
        tipo: r.ok ? (r.tipo === "compra" ? "compra" : "venda") : "aviso",
        especie: r.texto,
        shiny: false,
        xp: 0,
        loot: [],
        ouro: r.ok ? (r.tipo === "compra" ? -r.ouro : r.ouro) : undefined,
      });
      if (this.userId) {
        void registrarEvento(this.userId, {
          tipo: r.ok ? (r.tipo === "compra" ? "compra" : r.tipo === "venda-item" ? "venda-item" : "venda-poke") : "falha",
          titulo: r.texto,
          corpo: r.detalhe ?? null,
          dado: { ouro: r.ouro, quantidade: r.quantidade ?? null },
        });
      }
    }
    // Compra e venda mudam o ouro: pede o numero novo em vez de estimar.
    void this.lerPerfil();
  }

  // -------------------------------------------------------------------------
  // Queda e reconexao
  // -------------------------------------------------------------------------

  private registrarFechamento(codigo: number | null, frase: string | null) {
    this.fechamento = { codigo, frase: frase || null, em: Date.now() };
  }

  /**
   * O socket morreu — e o CODIGO diz o que fazer.
   *
   * Esta e a funcao que faltava. Antes, todo fechamento virava "chutado" e o
   * backoff corria igual pra tudo; um token vencido e um shard remanejado
   * produziam a mesma tela ("sessão perdida, tentando de novo") e o mesmo
   * resultado (nunca mais cacar). Cada caso pede o oposto:
   *
   *   4003 shard  o numero cacheado ficou velho. Redescobrir e voltar — insistir
   *               no mesmo shard erra 100% das vezes.
   *   4001 token  renovar o par. Se ja renovamos e ele recusou de novo, o
   *               vinculo morreu: parar e PEDIR reconexao, porque nenhuma
   *               tentativa nossa produz um token novo.
   *   4004        recusa de conta: terminal.
   *   resto       queda comum, backoff.
   */
  private aoFechar(codigo: number | null, frase: string | null) {
    this.limparTimers();
    if (this.tAbertura) { clearTimeout(this.tAbertura); this.tAbertura = null; }
    this.ws = null;
    this.registrarFechamento(codigo, frase);

    // "Chute rapido": abriu e caiu antes de sobreviver a janela. Quase sempre e
    // o proprio dono abrindo o jogo no navegador.
    const chuteRapido = this.tSobrevivencia != null;
    if (this.tSobrevivencia) { clearTimeout(this.tSobrevivencia); this.tSobrevivencia = null; }

    const regra = codigo != null ? FECHAMENTOS[codigo] : undefined;
    console.warn(
      `[robo] socket fechou user=${this.userId ?? "?"} shard=${this.shard} code=${codigo ?? "-"} ` +
        `reason=${frase ?? "-"} acao=${regra?.acao ?? "tentar"}`,
    );

    if (this.status === "rodando" || this.status === "conectando") {
      this.definirStatus("chutado", codigo != null ? `close ${codigo}` : (frase ?? undefined));
    }
    if (!this.ligado) return;

    if (regra?.acao === "parar") {
      void this.recusadoDeVez(frase ?? regra.frase);
      return;
    }

    if (regra?.acao === "shard") {
      this.shardErrado++;
      // Tres varreduras seguidas sem acertar o shard nao e shard: e o token
      // sendo recusado com outro nome. Cai pro caminho do token.
      if (this.shardErrado <= 3) {
        void this.redescobrirShard();
        return;
      }
    }

    if (regra?.acao === "token" || this.shardErrado > 3) {
      this.recusasDeToken++;
      if (this.recusasDeToken >= 2) {
        void this.tokenMorreu();
        return;
      }
    }

    // A politica e SEGURAR a sessao: o robo nao cede pro navegador, e quem quer
    // jogar desliga o robo antes. Ceder sozinho (o desenho antigo) fazia o robo
    // se desligar sem o dono saber por que.
    //
    // Por isso o chute rapido zera o backoff: reclamar a sessao na hora, e nao
    // daqui a um minuto. Backoff exponencial fica pros chutes por rede, onde
    // insistir rapido so queima tentativa.
    if (chuteRapido) this.tentativa = 0;
    this.agendarReconexao();
  }

  /**
   * O shard cacheado esta errado — descobre o certo e volta.
   *
   * A sondagem paralela abre os 64 e resolve no primeiro que responde (~300ms
   * contra ~20s de varredura sequencial). Ela toma a sessao de jogo, o que aqui
   * nao custa nada: a sessao ja caiu.
   */
  private async redescobrirShard(): Promise<void> {
    if (!this.tokens || !this.ligado) return;
    this.explicacao = "procurando o shard certo da conta";
    this.emitir();
    const r = await lerPokes(this.tokens, null).catch(() => null);
    if (!this.ligado) return;
    if (!r) {
      this.explicacao = null;
      this.agendarReconexao();
      return;
    }
    this.shard = r.shard;
    this.explicacao = null;
    if (this.userId) await salvarShard(this.userId, r.shard).catch(() => {});
    console.warn(`[robo] shard redescoberto user=${this.userId ?? "?"} shard=${r.shard}`);
    this.tentativa = 0;
    this.conectar();
  }

  /**
   * O token nao serve mais, e renovar nao resolveu.
   *
   * Estado terminal do ponto de vista do motor: so o dono da conta produz um
   * token novo (colando o `pokeweb:tokens` de novo). Insistir aqui e a diferenca
   * entre uma tela que pede uma acao de 10 segundos e uma tela que reconecta
   * pra sempre sem explicar nada.
   */
  private async tokenMorreu(): Promise<void> {
    this.ligado = false;
    this.cancelarReconexao();
    this.limparTimers();
    this.definirStatus("vencido", "token recusado pelo jogo");
    if (this.userId) {
      await marcarVencido(this.userId).catch(() => {});
      void registrarEvento(this.userId, {
        tipo: "recusado",
        titulo: "O jogo recusou o token",
        corpo: "Reconecte a conta no painel: cole o token novo do jogo.",
      });
    }
    this.emitir();
  }

  private agendarReconexao() {
    if (this.tReconexao) return;
    const espera = Math.min(RECONEXAO_MAX_MS, RECONEXAO_BASE_MS * 2 ** this.tentativa);
    this.tentativa++;
    this.proximaTentativaEm = Date.now() + espera;
    this.emitir();
    this.tReconexao = setTimeout(() => {
      this.tReconexao = null;
      void this.tentarReconectar();
    }, espera);
  }

  private cancelarReconexao() {
    if (this.tReconexao) { clearTimeout(this.tReconexao); this.tReconexao = null; }
    this.tentativa = 0;
    this.proximaTentativaEm = null;
  }

  private async tentarReconectar() {
    if (!this.ligado || this.ws) return;
    this.reconexoes++;

    // Renova o access ANTES de reabrir. O socket nao tem o retry-em-401 do REST:
    // token vencido e conexao recusada direto, e o backoff subiria a toa.
    if (this.tokens?.refresh) {
      try {
        const novo = await renovarTokens(this.tokens);
        if (novo) {
          this.tokens = novo;
          await this.aoTrocarTokens?.(novo);
        } else if (this.recusasDeToken >= 1) {
          // O jogo recusou o token E o refresh nao produziu par novo. Nao ha
          // terceira coisa a tentar.
          await this.tokenMorreu();
          return;
        }
      } catch {
        /* tenta com o token atual */
      }
    }

    // PERGUNTA antes de martelar. O WebSocket nao sabe dizer "voce esta banido":
    // ele so fecha, e o motor leria isso como queda de rede e reconectaria pra
    // sempre. Uma chamada REST responde com codigo, e 403 encerra a tentativa.
    if (await this.recusadoPeloJogo()) return;

    this.conectar();
  }

  /** true = o jogo recusou a conta (e o caso ja foi tratado). */
  private async recusadoPeloJogo(): Promise<boolean> {
    if (!this.tokens) return false;
    try {
      const r = await pedirAoJogo("/api/characters/me", this.tokens);
      const recusa = await recusaDe(r.res);
      if (recusa?.tipo === "blocked") {
        await this.bloqueadoPeloJogo(recusa);
        return true;
      }
      if (recusa?.tipo === "expired") {
        await this.tokenMorreu();
        return true;
      }
    } catch {
      // Rede ou jogo fora do ar nao e recusa da conta: segue pro backoff normal.
    }
    return false;
  }

  /** Estado TERMINAL. Desliga o desejo (senao o proximo boot religa e recomeca a
   *  bater na porta), para tudo e grava o motivo pra tela poder explicar. */
  private async bloqueadoPeloJogo(recusa: Recusa) {
    this.ligado = false;
    this.cancelarReconexao();
    this.limparTimers();
    if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    this.motivoBloqueio = recusa.mensagem || null;
    this.definirStatus("bloqueado", recusa.mensagem || undefined);
    if (this.userId) await marcarBloqueado(this.userId, recusa).catch(() => {});
    this.emitir();
  }

  /** O jogo fechou com um codigo que significa recusa, sem passar pela REST. */
  private async recusadoDeVez(frase: string) {
    await this.bloqueadoPeloJogo({ tipo: "blocked", status: 403, mensagem: frase });
  }

  private desmontar() {
    this.limparTimers();
    if (this.tSobrevivencia) { clearTimeout(this.tSobrevivencia); this.tSobrevivencia = null; }
    if (this.tAbertura) { clearTimeout(this.tAbertura); this.tAbertura = null; }
    if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    this.inventario.clear();
    this.fila = [];
    this.chat = [];
    this.chatIds.clear();
    this.chatTextos.clear();
    this.chatPendente = null;
    this.desdeMs = null;
    this.analyzerBase = null;
    this.refazerBase = false;
    this.caidoDesde = null;
    this.deveVoltarAoCampo = false;
    this.ultimoCampoEm = 0;
    this.explicacao = null;
    this.definirStatus("parado");
  }

  private definirStatus(s: StatusSessao, erro?: string) {
    this.status = s;
    void this.gravarStatus(erro);
    this.emitir();
  }

  private gravarStatus(erro?: string | null) {
    if (!this.userId) return Promise.resolve();
    return salvarStatus(this.userId, this.status, erro ?? null).catch(() => {});
  }

  private emitir() {
    this.emit("mudou");
  }
}

// ---------------------------------------------------------------------------
// O registro — uma sessao por usuario
// ---------------------------------------------------------------------------

/**
 * No `globalThis` porque o HMR do `next dev` reavalia o modulo a cada save: sem
 * isso, cada alteracao de codigo criaria um registro novo e abandonaria os
 * sockets do antigo, ainda abertos e ainda disputando a conta.
 */
const global_ = globalThis as unknown as { _piwSessoes?: Map<string, SessaoJogo> };
const sessoes: Map<string, SessaoJogo> = (global_._piwSessoes ??= new Map());

export function sessaoDe(userId: string): SessaoJogo {
  let s = sessoes.get(userId);
  if (!s) {
    s = new SessaoJogo();
    sessoes.set(userId, s);
  }
  return s;
}

/** A sessao SE existir — nao cria. Pra quem so quer ler o estado. */
export function espiarSessao(userId: string): SessaoJogo | null {
  return sessoes.get(userId) ?? null;
}

export function estadoDe(userId: string): EstadoHunt {
  return espiarSessao(userId)?.estado() ?? estadoParado();
}

/** Descarta a sessao (usado ao trocar de conta vinculada: a anterior morre AQUI,
 *  senao o motor segue segurando o WS do personagem velho). */
export function soltarSessao(userId: string): void {
  const s = sessoes.get(userId);
  if (!s) return;
  s.parar();
  sessoes.delete(userId);
}

export function sessoesVivas(): { userId: string; sessao: SessaoJogo }[] {
  return [...sessoes.entries()].map(([userId, sessao]) => ({ userId, sessao }));
}
