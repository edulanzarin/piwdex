import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { lerTokens, pedirAoJogo, recusaDe } from "@/lib/robo/jogo/auth";
import { lerPokes } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";
import {
  limiteDeContas,
  contaDoUsuario,
  contarContas,
  marcarBloqueado,
  salvarShard,
  salvarTime,
  salvarVinculo,
} from "@/lib/robo/vinculo";
import { contaPedida } from "@/lib/robo/conta";
import { soltarSessao } from "@/lib/robo/motor/sessao";
import { retomarSessoes } from "@/lib/robo/motor/boot";

export const runtime = "nodejs";

/**
 * Liga uma conta do JOGO ao usuario logado no piwdex.
 *
 * Faz DUAS coisas conforme o `?conta=` venha ou nao, e a distincao importa:
 *
 *   sem `?conta=`  ADICIONA uma conta. Passa pelo teto da assinatura.
 *   com `?conta=`  RECONECTA aquela conta — o caminho de quem venceu o token.
 *                  Sem teto (nao entra conta nova) e, se o jogo recusar, a
 *                  recusa tem onde ser gravada.
 *
 * Colar o token da MESMA conta sem `?conta=` tambem reconecta em vez de
 * duplicar: quem decide e o `cmid`, no `salvarVinculo`. Duas linhas pro mesmo
 * personagem seriam dois sockets brigando pela mesma sessao de jogo, cada um
 * derrubando o outro pra sempre.
 *
 * Recebe o token colado (o valor cru do `pokeweb:tokens`, ou os JWT soltos),
 * prova contra `/api/characters/me` — se o jogo aceitar, o token e bom — e grava
 * o vinculo cifrado.
 *
 * Gate de assinatura NO SERVIDOR, e nao so escondendo o botao: vincular e o que
 * destrava o robo, e o robo e o produto pago.
 */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let bruto = "";
  try {
    const body = (await req.json()) as { bruto?: string; raw?: string };
    bruto = String(body?.bruto ?? body?.raw ?? "");
  } catch {
    /* corpo invalido: cai no erro de token abaixo */
  }

  const tokens = lerTokens(bruto);
  if (!tokens) return NextResponse.json({ erro: "token_invalido" }, { status: 400 });

  // Reconexao aponta pra uma conta que ja e dele; adicao passa pelo teto.
  const alvoId = contaPedida(req);
  const alvo = alvoId ? await contaDoUsuario(usuario.id, alvoId) : null;
  if (alvoId && !alvo) return NextResponse.json({ erro: "conta_alheia" }, { status: 404 });

  if (!alvo && (await contarContas(usuario.id)) >= limiteDeContas(usuario)) {
    return NextResponse.json(
      { erro: "limite_de_contas", limite: limiteDeContas(usuario) },
      { status: 409 },
    );
  }

  let r;
  try {
    r = await pedirAoJogo("/api/characters/me", tokens);
  } catch {
    return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  }

  if (!r.res.ok) {
    // Antes (no v1) qualquer falha virava "unauthorized": ban, limite e token
    // vencido no mesmo balde, e o jogador sem saber qual dos tres era.
    const recusa = await recusaDe(r.res);

    if (recusa?.tipo === "blocked") {
      // So da pra gravar a recusa quando se sabe EM QUAL conta ela aconteceu.
      // Numa adicao, o token foi recusado antes de existir linha pra marcar —
      // e inventar uma seria criar um vinculo bloqueado que ninguem pediu.
      if (alvo) await marcarBloqueado(alvo.id, recusa);
      return NextResponse.json(
        { erro: "conta_bloqueada", motivo: recusa.mensagem, status: 403 },
        { status: 403 },
      );
    }
    if (recusa?.tipo === "rate_limited") {
      return NextResponse.json(
        { erro: "muitas_tentativas", motivo: recusa.mensagem, status: 429 },
        { status: 429 },
      );
    }
    // Recusa que nao classificamos: devolve o codigo e a frase do jogo mesmo
    // assim. E o que permite descobrir COMO ele sinaliza cada caso sem chutar —
    // se um ban chegar aqui como 401, a tela mostra o numero e a frase, e a
    // regra se ajusta com evidencia em vez de palpite.
    return NextResponse.json(
      { erro: "token_recusado", status: r.res.status, motivo: recusa?.mensagem },
      { status: 401 },
    );
  }

  const dado = (await r.res.json().catch(() => null)) as Record<string, unknown> | null;
  const personagem = ((dado?.character ?? dado ?? {}) as Record<string, unknown>) || {};
  const nomeJogador = typeof personagem.name === "string" ? personagem.name : null;

  /**
   * O que identifica ESTA conta de jogo entre as do usuario.
   *
   * E o que decide "reconectar" e "adicionar": sem uma identidade estavel,
   * colar o token da mesma conta duas vezes criaria dois vinculos pro mesmo
   * personagem — e dois sockets brigando pela mesma sessao de jogo, cada um
   * derrubando o outro pra sempre.
   *
   * Prefere o id do personagem quando ele vem; cai no nome quando nao vem. O
   * nome e pior (o jogador pode troca-lo, e ai a proxima conexao entra como
   * conta nova), mas e o que existe — e um `null` aqui desligaria a protecao
   * inteira, que e o unico desfecho que nao da pra aceitar.
   */
  const cmid =
    personagem.id != null && personagem.id !== ""
      ? String(personagem.id)
      : nomeJogador
        ? `nome:${nomeJogador}`
        : null;

  // `r.tokens` e nao `tokens`: o `pedirAoJogo` pode ter renovado o par no meio do
  // caminho, e gravar o antigo faria o vinculo nascer vencido.
  const { id: contaId, nova } = await salvarVinculo(usuario.id, r.tokens, {
    cmid,
    nomeJogador,
  });

  // A sessao ANTIGA daquela conta morre aqui, e so a dela. Sem isto o motor
  // seguiria segurando o WebSocket com a credencial velha entre o connect e o
  // proximo "ligar". Antes isso soltava a sessao do usuario — que era a unica;
  // hoje soltar por usuario derrubaria a cacada das OUTRAS contas dele.
  soltarSessao(contaId);

  // Conectar TOMA a sessao de jogo de qualquer jeito (o WS e single-session e
  // chuta a aba aberta). Ja que o preco foi pago, aproveita e le o time agora —
  // depois disso a tela mostra o snapshot sem chutar ninguem de novo.
  //
  // Fora do caminho critico de proposito: se o WS falhar, o vinculo continua bom
  // e o time fica pra um "atualizar".
  try {
    const pokes = await lerPokes(r.tokens, null);
    if (pokes) {
      const todos = normalizarPokes(pokes.pokes);
      const time = todos.filter((p) => p.team).sort((a, b) => a.slot - b.slot);
      await salvarShard(contaId, pokes.shard);
      await salvarTime(contaId, time, todos.length);
    }
  } catch {
    /* o time fica pra depois */
  }

  // Vinculo renovado: se o robo estava LIGADO no banco (a conexao caiu porque o
  // token venceu, e nao porque o dono desligou), ele retoma sozinho. Reconectar
  // passa a ser a unica acao do usuario; o resto volta ao que era.
  setTimeout(() => { void retomarSessoes(contaId).catch(() => {}); }, 1_000);

  return NextResponse.json({ ok: true, conta: contaId, nova, nomeJogador });
}
