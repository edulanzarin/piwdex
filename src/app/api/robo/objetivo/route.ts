import { NextResponse } from "next/server";
import { exigirConta } from "@/lib/robo/conta";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { melhores } from "@/lib/robo/motor/objetivo";

export const runtime = "nodejs";

/**
 * Com qual dos meus, e onde.
 *
 * Responde ANTES de ligar qualquer coisa: decidir se concorda com a recomendacao
 * depois de o robo comecar a segui-la e a ordem errada pra um robo que joga
 * sozinho por horas. A rota `/config` e que liga o objetivo; esta so calcula.
 *
 * O time sai da sessao viva quando ha uma; sem ela, do snapshot gravado no
 * vinculo — que e o suficiente pra tela mostrar a conta antes de o robo subir.
 */
export async function GET(req: Request) {
  const { alvo, resposta } = await exigirConta(req);
  if (resposta) return resposta;
  const { conta: v } = alvo;

  const criterio = new URL(req.url).searchParams.get("por") === "xp" ? "xp" : "dolares";
  const viva = espiarSessao(v.id)?.estado();
  let time = viva?.time ?? [];
  // Sem sessao viva, o time sai do snapshot gravado no vinculo — abrir um WS so
  // pra montar recomendacao tomaria a sessao de jogo da conta.
  if (!time.length) time = v.time?.lista ?? [];
  if (!time.length) return NextResponse.json({ erro: "sem_time" }, { status: 409 });

  return NextResponse.json({
    recomendacoes: await melhores(time, criterio, { vip: viva?.perfil?.vip }),
  });
}
