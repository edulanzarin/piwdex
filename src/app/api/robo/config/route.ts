import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { espiarSessao } from "@/lib/robo/motor/sessao";
import { lerConfig, salvarConfig } from "@/lib/robo/motor/config";

export const runtime = "nodejs";

/** As travas das automacoes. */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;
  return NextResponse.json({ config: await lerConfig(usuario.id) });
}

/**
 * Grava e APLICA na hora.
 *
 * O banco sozinho nao basta: a sessao viva ja carrega a config antiga em
 * memoria, e sem o empurrao ela so leria a nova no proximo restart — o usuario
 * desligaria a venda automatica e ela continuaria vendendo.
 *
 * Devolve o que ficou GRAVADO, e nao o que chegou: a normalizacao corrige alvo
 * abaixo do piso, e a tela precisa mostrar o valor corrigido.
 */
export async function POST(req: Request) {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  let bruto: unknown = {};
  try {
    bruto = await req.json();
  } catch {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  const cfg = await salvarConfig(usuario.id, bruto);
  espiarSessao(usuario.id)?.usarConfig(cfg);
  return NextResponse.json({ config: cfg });
}
