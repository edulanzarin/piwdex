import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { GAME_HOST } from "@/lib/robo/jogo/host";
import { pedirAoJogo, recusaDe, renovarTokens, type Recusa, type Tokens } from "@/lib/robo/jogo/auth";
import { normalizarPokes, type ActivePoke } from "@/lib/robo/jogo/pokes";
import {
  analyzerZerou,
  deltaAnalyzer,
  estadoParado,
  type Analyzer,
  type EstadoHunt,
  type Evento,
  type NaFila,
  type StatusSessao,
} from "@/lib/robo/motor/tipos";
import { marcarBloqueado, salvarTime } from "@/lib/robo/vinculo";
import { salvarStatus } from "@/lib/robo/motor/desejado";
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
 * Protocolo em `parked/bot/docs/ws-protocol.md`, cravado por engenharia reversa.
 */

const WS_BASE = GAME_HOST.replace(/^http/, "ws");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Poll do analyzer. E tambem o keepalive da hunt. */
const ANALYZER_MS = 2_000;
/** Poll da lista de pokemon: alimenta o time ao vivo e o HP fora do campo. */
const POKES_MS = 20_000;

const RECONEXAO_BASE_MS = 5_000;
const RECONEXAO_MAX_MS = 60_000;

/**
 * Quanto a conexao precisa durar pra o robo considerar que GANHOU a sessao.
 *
 * O numero tem um par escondido, e ignorar isso custou uma noite no v1: se o
 * processo viver menos que esta janela, nenhuma conexao "vence" nunca, cada
 * queda conta como sessao roubada, e o robo se pausa sozinho por um motivo
 * inventado. Foi o que aconteceu quando o container reiniciava a cada ~13s por
 * deploy em cima de deploy — 13 < 25, e o log nao dizia nada.
 *
 * Hoje o robo tem servico proprio justamente pra que esse par nunca mais se
 * cruze. A licao esta no Brain: "Processo que guarda conexao viva nao tolera
 * deploy frequente, e o log nao denuncia".
 */
const CONTESTADA_MS = 25_000;

/** Anti-flood do `field-revive` — o frame `field` chega ~2x por segundo. */
const REVIVE_COOLDOWN_MS = 15_000;
/** Sem levantar nesse tempo, desiste do Revive e vai pra Joy. */
const REVIVE_GRACA_MS = 8_000;
/** A Joy e de graca, mas se nao pegar nao adianta martelar. */
const CURA_COOLDOWN_MS = 60_000;

const EVENTOS_MAX = 40;

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
  private inventario = new Map<number, number>();

  private heroHp: number | null = null;
  private heroMaxHp: number | null = null;
  private caidoDesde: number | null = null;
  private reviveEnviadoEm = 0;
  private reviveIds: Set<number> | null = null;
  private reviveVersao: string | null = null;
  private curaEnviadaEm = 0;
  /** Saiu do campo pra curar: alguem tem que voltar pra hunt quando o HP encher. */
  private deveVoltarAoCampo = false;

  private tAnalyzer: ReturnType<typeof setInterval> | null = null;
  private tPokes: ReturnType<typeof setInterval> | null = null;
  private tReconexao: ReturnType<typeof setTimeout> | null = null;
  private tentativa = 0;
  private proximaTentativaEm: number | null = null;
  private tSobrevivencia: ReturnType<typeof setTimeout> | null = null;

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  estado(): EstadoHunt {
    return {
      status: this.status,
      slug: this.slug,
      desdeMs: this.desdeMs,
      analyzer: this.analyzer,
      eventos: this.eventos,
      fila: this.fila,
      time: this.time,
      heroHp: this.heroHp,
      heroMaxHp: this.heroMaxHp,
      caido: this.caidoDesde != null,
      ligado: this.ligado,
      reconectando: this.tReconexao != null,
      proximaTentativaEm: this.proximaTentativaEm,
      motivoBloqueio: this.motivoBloqueio,
    };
  }

  ehDe(userId: string | null | undefined): boolean {
    return !!userId && this.userId === userId;
  }

  // -------------------------------------------------------------------------
  // Comando
  // -------------------------------------------------------------------------

  /** Liga o robo numa hunt. Idempotente: chamar de novo com outro slug troca de
   *  cacada sem derrubar a conexao. */
  comecar(
    userId: string,
    tokens: Tokens,
    shard: number,
    slug: string,
    aoTrocarTokens: (t: Tokens) => Promise<void>,
  ) {
    this.userId = userId;
    this.tokens = tokens;
    this.shard = shard;
    this.aoTrocarTokens = aoTrocarTokens;
    this.ligado = true;
    this.motivoBloqueio = null;

    const trocouDeHunt = this.slug !== slug;
    this.slug = slug;

    if (!this.ws) {
      this.conectar();
      return;
    }
    if (trocouDeHunt) {
      // Trocar de hunt zera a contagem: o proximo analyzer vira a base nova.
      this.refazerBase = true;
      this.eventos = [];
      this.desdeMs = Date.now();
      this.entrarNoCampo(slug);
      this.rearmarTimers();
      this.emitir();
    }
  }

  /** Retoma o que estava desejado (usado pelo boot). Nao mexe em quem ja roda. */
  retomar(
    userId: string,
    tokens: Tokens,
    shard: number,
    slug: string | null,
    aoTrocarTokens: (t: Tokens) => Promise<void>,
  ) {
    if (this.ws) return;
    if (!slug) return;
    this.comecar(userId, tokens, shard, slug, aoTrocarTokens);
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

    ws.addEventListener("open", () => {
      this.tentativa = 0;
      this.proximaTentativaEm = null;
      // Arma a janela de sobrevivencia: durar CONTESTADA_MS significa que o robo
      // ganhou a sessao de verdade.
      if (this.tSobrevivencia) clearTimeout(this.tSobrevivencia);
      this.tSobrevivencia = setTimeout(() => { this.tSobrevivencia = null; }, CONTESTADA_MS);
      this.definirStatus("rodando");
      if (this.slug) this.entrarNoCampo(this.slug);
      this.rearmarTimers();
    });
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (minhaGeracao === this.geracao) this.aoReceber(ev);
    });
    ws.addEventListener("close", (ev: unknown) => {
      if (minhaGeracao === this.geracao) {
        this.aoPerder("chutado", (ev as { code?: number } | undefined)?.code);
      }
    });
    ws.addEventListener("error", () => {
      if (minhaGeracao === this.geracao) this.aoPerder("erro");
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
  }

  private limparTimers() {
    if (this.tAnalyzer) { clearInterval(this.tAnalyzer); this.tAnalyzer = null; }
    if (this.tPokes) { clearInterval(this.tPokes); this.tPokes = null; }
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
        this.registrar({
          em: Date.now(), tipo: "kill", especie: String(m.speciesName ?? "?"),
          shiny: Boolean(m.shiny), xp: Number(m.xpGained ?? 0), loot,
        });
        break;
      }

      case "field":
        this.acompanharCampo(m);
        break;

      case "catch-result":
        if (m.success && this.slug) {
          this.registrar({
            em: Date.now(), tipo: "captura", especie: String(m.speciesName ?? "?"),
            shiny: Boolean(m.shiny), xp: 0, loot: [], bola: String(m.ballName ?? ""),
          });
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
          this.time = normalizarPokes(m.list).filter((p) => p.team).sort((a, b) => a.slot - b.slot);
          const lider = this.time.find((p) => p.leader) ?? this.time[0];
          // Fora do campo, o frame `pokes` e a UNICA fonte de vida: `field` so
          // existe em hunt e `/api/characters/me` nao traz HP.
          if (lider && !this.slug) {
            this.heroHp = lider.hp;
            this.heroMaxHp = lider.maxHp;
          }
          if (lider && lider.maxHp > 0 && lider.hp <= 0) void this.levantarLider(lider.name);
          else this.liderDePe();
          if (this.userId) {
            void salvarTime(this.userId, this.time, this.time.length).catch(() => {});
          }
          this.emitir();
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

      case "joy-healed":
        // O ack nao prova nada: quem confirma e o HP na proxima lista.
        this.enviar({ type: "pokes-get" });
        break;
    }
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
  // Queda e reconexao
  // -------------------------------------------------------------------------

  private aoPerder(status: StatusSessao, code?: number) {
    this.limparTimers();
    this.ws = null;

    // "Chute rapido": abriu e caiu antes de sobreviver a janela. Quase sempre e
    // o proprio dono abrindo o jogo no navegador.
    const chuteRapido = this.tSobrevivencia != null;
    if (this.tSobrevivencia) { clearTimeout(this.tSobrevivencia); this.tSobrevivencia = null; }

    if (this.status === "rodando" || this.status === "conectando") {
      this.definirStatus(status, code != null ? `close ${code}` : undefined);
    }
    if (!this.ligado) return;

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

    // Renova o access ANTES de reabrir. O socket nao tem o retry-em-401 do REST:
    // token vencido e conexao recusada direto, e o backoff subiria a toa.
    if (this.tokens?.refresh) {
      try {
        const novo = await renovarTokens(this.tokens);
        if (novo) {
          this.tokens = novo;
          await this.aoTrocarTokens?.(novo);
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

  private desmontar() {
    this.limparTimers();
    if (this.tSobrevivencia) { clearTimeout(this.tSobrevivencia); this.tSobrevivencia = null; }
    if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    this.inventario.clear();
    this.fila = [];
    this.desdeMs = null;
    this.analyzerBase = null;
    this.refazerBase = false;
    this.caidoDesde = null;
    this.deveVoltarAoCampo = false;
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
