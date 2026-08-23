import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/robo/auth";

/**
 * Os dois portoes da area logada, num lugar so.
 *
 * O gate se valida no SERVIDOR, em toda rota que toca a sessao de jogo — nunca
 * escondendo o botao. Esconder resolve a tela; o robo e uma API, e uma API que
 * confia na tela nao tem gate nenhum.
 *
 * Sao dois portoes diferentes e a diferenca importa: `exigirUsuario` responde
 * "quem e voce", `exigirVip` responde "voce pagou". Quem esta logado sem
 * assinatura tem conta, historico e tela de pagamento — mandar essa pessoa pro
 * login seria mentir sobre o problema.
 */

export interface UsuarioSessao {
  id: string;
  nome: string | null;
  email: string;
  vip: boolean;
  admin: boolean;
}

export async function usuarioAtual(): Promise<UsuarioSessao | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  return {
    id: s.user.id,
    nome: s.user.name ?? null,
    email: s.user.email ?? "",
    vip: !!s.user.vip,
    admin: !!s.user.admin,
  };
}

/** Pra PAGINA: sem sessao, vai pro login. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  return u;
}

/** Pra PAGINA: sem assinatura ativa, vai pro checkout. */
export async function exigirVip(): Promise<UsuarioSessao> {
  const u = await exigirUsuario();
  if (!u.vip) redirect("/assinatura");
  return u;
}

/**
 * Pra ROTA DE API. Devolve o usuario, ou a resposta pronta pra ser retornada —
 * o chamador so precisa testar qual dos dois veio.
 *
 * Nao redireciona: `fetch` segue redirect sozinho, e a tela receberia o HTML do
 * login com status 200 em vez de saber que a sessao caiu.
 */
export async function exigirUsuarioApi(
  opts: { vip?: boolean } = {},
): Promise<{ usuario: UsuarioSessao; resposta?: never } | { usuario?: never; resposta: NextResponse }> {
  const u = await usuarioAtual();
  if (!u) {
    return { resposta: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  }
  if (opts.vip && !u.vip) {
    return { resposta: NextResponse.json({ erro: "assinatura_inativa" }, { status: 403 }) };
  }
  return { usuario: u };
}
