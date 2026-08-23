import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";

export const runtime = "nodejs";

/** Desliga o robo e devolve a sessao de jogo pro dono. */
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  // O desejo sai do banco mesmo que nao haja sessao viva neste processo: o
  // usuario pode estar desligando algo que outro processo religou.
  await salvarDesejado(usuario.id, { ligado: false, slug: null });
  espiarSessao(usuario.id)?.parar();

  return NextResponse.json({ ok: true });
}
