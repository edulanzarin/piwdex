import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { listarEventos } from "@/lib/robo/motor/eventos";

export const runtime = "nodejs";

/** O que o robo fez — inclusive nas horas em que ninguem estava olhando. */
export async function GET(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const limite = Number(new URL(req.url).searchParams.get("n") ?? 60);
  return NextResponse.json({ eventos: await listarEventos(usuario.id, limite) });
}
