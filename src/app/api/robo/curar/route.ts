import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { atualizarTokens, lerVinculo } from "@/lib/robo/vinculo";
import { curarTime } from "@/lib/robo/jogo/ws";
import { normalizarPokes } from "@/lib/robo/jogo/pokes";

export const runtime = "nodejs";

/**
 * Passa na enfermeira Joy.
 *
 * Dois caminhos, e a escolha nao e detalhe: com o robo rodando o comando SAI PELO
 * SOCKET QUE JA ESTA ABERTO. Abrir um segundo derrubaria a propria cacada — o
 * jogo aceita uma conexao por conta.
 */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  const viva = espiarSessao(v.id);
  if (viva?.curarAgora()) return NextResponse.json({ ok: true, por: "sessao" });

  // Sem shard nao da pra falar com o jogo por fora da sessao: a chamada
  // avulsa precisa saber em qual servidor a conta vive.
  if (!v.shard) return NextResponse.json({ erro: "sem_shard" }, { status: 409 });

  const lista = await curarTime(v.tokens, v.shard);
  if (!lista) return NextResponse.json({ erro: "nao_confirmou" }, { status: 502 });

  await atualizarTokens(v.id, v.tokens).catch(() => {});
  return NextResponse.json({ ok: true, por: "avulsa", time: normalizarPokes(lista).filter((p) => p.team) });
}
