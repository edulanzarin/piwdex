import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { salvarDesejado } from "@/lib/robo/motor/desejado";

export const runtime = "nodejs";

/** Desliga o robo e devolve a sessao de jogo pro dono. */
export async function POST(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { usuario, conta: v } = alvo;

  // O desejo sai do banco mesmo que nao haja sessao viva neste processo: o
  // usuario pode estar desligando algo que outro processo religou.
  await salvarDesejado(v.id, { ligado: false, slug: null });
  espiarSessao(v.id)?.parar();

  return NextResponse.json({ ok: true });
}
