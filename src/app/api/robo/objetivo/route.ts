import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerVinculo } from "@/lib/robo/vinculo";
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
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const criterio = new URL(req.url).searchParams.get("por") === "xp" ? "xp" : "dolares";
  const viva = espiarSessao(usuario.id)?.estado();
  let time = viva?.time ?? [];
  if (!time.length) {
    const v = await lerVinculo(usuario.id);
    time = v?.time?.lista ?? [];
  }
  if (!time.length) return NextResponse.json({ erro: "sem_time" }, { status: 409 });

  return NextResponse.json({
    recomendacoes: await melhores(time, criterio, { vip: viva?.perfil?.vip }),
  });
}
