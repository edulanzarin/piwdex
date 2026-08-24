import { NextResponse } from "next/server";
import { exigirUsuarioApi, type UsuarioSessao } from "@/lib/robo/sessao";
import { contaDoUsuario, primeiraConta, type Vinculo } from "@/lib/robo/vinculo";

/**
 * Qual conta de jogo esta rota esta operando.
 *
 * Ate a migration 004 esta pergunta nao existia: havia uma conta por assinante,
 * entao "a conta do usuario logado" era uma frase completa. Com varias, toda
 * rota que toca o jogo precisa de um SEGUNDO portao — e ele nao e cosmetico, e
 * o que impede um uuid vazado de virar acesso a credencial de jogo de outra
 * pessoa. `contaDoUsuario` filtra por dono na propria consulta, em vez de ler e
 * comparar depois: assim nao existe caminho em que o vinculo e carregado antes
 * de o dono ser conferido.
 *
 * O id vem sempre da QUERY STRING, inclusive no POST. O corpo so pode ser lido
 * uma vez, e uma rota que precisa dele pro proprio comando nao pode gasta-lo
 * aqui — o `?conta=` funciona igual nos dois metodos e nao disputa nada.
 *
 * Sem `?conta=`, cai na primeira conta do usuario. Isso mantem de pe todo link
 * antigo e todo `fetch` que ainda nao aprendeu a mandar o parametro, e para
 * quem tem uma conta so a resposta e sempre a certa.
 */

export interface Alvo {
  usuario: UsuarioSessao;
  conta: Vinculo;
}

type Resultado = { alvo: Alvo; resposta?: never } | { alvo?: never; resposta: NextResponse };

export const contaPedida = (req: Request): string | null =>
  new URL(req.url).searchParams.get("conta");

/**
 * O usuario, a assinatura e a conta — os tres portoes numa chamada.
 *
 * `sem_vinculo` (409) quando ele nao tem conta nenhuma ligada, e `conta_alheia`
 * (404, nao 403) quando o id nao e dele: responder "essa conta existe mas nao e
 * sua" confirmaria a existencia do id pra quem estava adivinhando.
 */
export async function exigirConta(req: Request, opts: { vip?: boolean } = {}): Promise<Resultado> {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: opts.vip ?? true });
  if (resposta) return { resposta };

  const pedida = contaPedida(req) ?? (await primeiraConta(usuario.id));
  if (!pedida) return { resposta: NextResponse.json({ erro: "sem_vinculo" }, { status: 409 }) };

  const conta = await contaDoUsuario(usuario.id, pedida);
  if (!conta) return { resposta: NextResponse.json({ erro: "conta_alheia" }, { status: 404 }) };

  return { alvo: { usuario, conta } };
}
