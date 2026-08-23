import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { contarNaoLidos, listarEventos, marcarLidos } from "@/lib/robo/motor/eventos";

export const runtime = "nodejs";

/** O que o robo fez — inclusive nas horas em que ninguem estava olhando. */
export async function GET(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const q = new URL(req.url).searchParams;
  // `?so=contagem`: o painel pergunta isso de minuto em minuto so pra pintar o
  // numero na aba, e nao precisa da lista pra isso.
  if (q.get("so") === "contagem") {
    return NextResponse.json({ naoLidos: await contarNaoLidos(usuario.id) });
  }
  const eventos = await listarEventos(usuario.id, Number(q.get("n") ?? 120));
  return NextResponse.json({ eventos, naoLidos: await contarNaoLidos(usuario.id) });
}

/** Abrir o registro e ter lido: a tela marca ao entrar. */
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;
  await marcarLidos(usuario.id);
  return NextResponse.json({ ok: true });
}
