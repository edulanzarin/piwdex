import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { lerTokens, pedirAoJogo, recusaDe } from "@/lib/robo/jogo/auth";
import { lerPokes } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";
import { marcarBloqueado, salvarShard, salvarTime, salvarVinculo } from "@/lib/robo/vinculo";

export const runtime = "nodejs";

/**
 * Vincula a conta do JOGO ao usuario logado no piwdex.
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
      await marcarBloqueado(usuario.id, recusa);
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

  const dado = (await r.res.json().catch(() => null)) as
    | { character?: { name?: string }; name?: string }
    | null;
  const nomeJogador = dado?.character?.name ?? dado?.name ?? null;

  // `r.tokens` e nao `tokens`: o `pedirAoJogo` pode ter renovado o par no meio do
  // caminho, e gravar o antigo faria o vinculo nascer vencido.
  await salvarVinculo(usuario.id, r.tokens, { nomeJogador });

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
      await salvarShard(usuario.id, pokes.shard);
      await salvarTime(usuario.id, time, todos.length);
    }
  } catch {
    /* o time fica pra depois */
  }

  return NextResponse.json({ ok: true, nomeJogador });
}
