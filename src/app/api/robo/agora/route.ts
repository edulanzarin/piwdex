import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";

export const runtime = "nodejs";

/**
 * Roda as automacoes JA, sem esperar a varredura.
 *
 * Existe pra o usuario poder testar a configuracao que acabou de salvar. Sem
 * isto, ligar "repor bolas" e nao ver nada por um minuto e indistinguivel de
 * "não funciona" — que e exatamente a leitura que este robo precisa parar de
 * produzir.
 */
export async function POST() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const s = espiarSessao(usuario.id);
  if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });

  await s.rodarJobsAgora();
  return NextResponse.json({ ok: true });
}
