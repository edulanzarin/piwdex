import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/robo/sessao";
import { ehConsumivel, lerLoja, lerMochila } from "@/lib/robo/jogo/loja";
import { separarConsumivel } from "@/lib/robo/motor/jobs";
import { atualizarTokens, lerVinculo } from "@/lib/robo/vinculo";

export const runtime = "nodejs";

/**
 * O catalogo da loja, a mochila e o que a bolsa tem de consumivel.
 *
 * A tela de loja precisa dos tres pra deixar de ser um formulario de ids: qual
 * bola repor sai do catalogo, o que marcar pra venda sai do que a mochila de
 * fato tem, e o piso ("abaixo de 25 pocoes") so vira decisao ao lado do numero
 * que ele compara. Escolher item por numero, e chutar estoque de cabeca, era o
 * que fazia essa configuracao ficar desligada pra sempre.
 *
 * O estoque e contado pela MESMA funcao que decide a compra (`separarConsumivel`
 * em `motor/jobs.ts`). Uma segunda contagem aqui daria uma tela dizendo 30 e um
 * robo comprando como se fossem 12 — e a que ninguem revisa seria a de la.
 */
export async function GET() {
  const { usuario, resposta } = await exigirUsuarioApi({ vip: true });
  if (resposta) return resposta;

  const v = await lerVinculo(usuario.id);
  if (!v) return NextResponse.json({ erro: "sem_vinculo" }, { status: 409 });

  const [loja, mochila] = await Promise.all([lerLoja(v.tokens), lerMochila(v.tokens)]);
  if (!loja) return NextResponse.json({ erro: "jogo_fora_do_ar" }, { status: 502 });
  if (loja.mudou) await atualizarTokens(usuario.id, loja.tokens).catch(() => {});

  const itens = mochila?.itens ?? [];
  const bolsa = await separarConsumivel(itens);

  return NextResponse.json({
    loja: loja.loja,
    // So DROP. Pocao, revive e bola ficam de fora: sao o que a cacada gasta, e
    // oferecer os dois na mesma lista de venda e como a bolsa fica vazia por um
    // clique em "marcar tudo".
    //
    // Ordenado pelo que rende mais: a decisao de "o que deixo o robo vender" e
    // sobre o que enche a mochila, e o topo da lista e onde ela se resolve.
    mochila: itens
      .filter((i) => i.quantidade > 0 && !ehConsumivel(i.categoria))
      .sort((a, b) => b.quantidade * b.precoNpc - a.quantidade * a.precoNpc),
    /**
     * O que a bolsa tem de pocao e de revive, ITEM A ITEM.
     *
     * Vai sem somar de proposito: quem soma e `estoqueDoAlvo`, a mesma funcao
     * que o motor usa pra decidir a compra, e ela conta diferente quando ha um
     * item escolhido. Mandar um total pronto daqui seria uma segunda contagem —
     * e a que a tela mostra nao pode discordar da que o robo executa.
     *
     * `null` quando o catalogo do jogo nao respondeu: a tela precisa poder dizer
     * "não sei" em vez de desenhar um zero, que e o mesmo numero de uma bolsa
     * vazia e leva a mexer no piso pra resolver o problema errado.
     */
    bolsa: bolsa ? { pocoes: bolsa.heal, revives: bolsa.revive } : null,
  });
}
