import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
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
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const viva = espiarSessao(usuario.id);
  if (viva?.curarAgora()) return NextResponse.json({ ok: true, por: "sessao" });

  const v = await lerVinculo(usuario.id);
  if (!v?.shard) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const lista = await curarTime(v.tokens, v.shard);
  if (!lista) return NextResponse.json({ erro: "nao_confirmou" }, { status: 502 });

  await atualizarTokens(usuario.id, v.tokens).catch(() => {});
  return NextResponse.json({ ok: true, por: "avulsa", time: normalizarPokes(lista).filter((p) => p.team) });
}
