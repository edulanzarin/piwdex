import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { CANAIS } from "@/lib/robo/motor/tipos";

export const runtime = "nodejs";

/** Teto de tamanho. O jogo tem o proprio limite; barrar aqui evita gastar a
 *  janela do anti-flood com uma mensagem que ele vai recusar por tamanho. */
const MAX = 300;

/**
 * Manda uma mensagem no chat do jogo.
 *
 * Sai pelo socket que o robo ja segura. Nao ha caminho avulso: abrir uma segunda
 * conexao pra falar derrubaria a propria sessao, e o robo passaria a competir
 * consigo mesmo.
 */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let texto = "";
  let canal = "world";
  try {
    const b = (await req.json()) as { texto?: string; canal?: string };
    texto = String(b?.texto ?? "").trim().slice(0, MAX);
    canal = CANAIS.includes(b?.canal as never) ? String(b?.canal) : "world";
  } catch {
    /* corpo invalido: cai no texto vazio abaixo */
  }
  if (!texto) return NextResponse.json({ erro: "vazio" }, { status: 400 });

  const s = espiarSessao(usuario.id);
  if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });

  const r = await s.mandarChat(texto, canal);
  if (r.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ erro: r.motivo, esperaMs: r.esperaMs ?? null }, { status: 409 });
}
